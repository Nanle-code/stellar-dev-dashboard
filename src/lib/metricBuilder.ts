/**
 * Custom Metric Builder (#864)
 * ============================
 * Allows users to compose reusable metrics from Horizon fields and saved
 * expressions. Formulas reference dot-path field names from Horizon API
 * responses (the same keys used in `ReportDataSet` from `customReports.ts`)
 * and combine them with basic arithmetic operators.
 *
 * Design decisions:
 * - Expression evaluation uses a hand-written recursive-descent parser
 *   rather than `eval()` or `Function()` to prevent code injection.
 * - Saved formulas are persisted in localStorage under a namespaced key and
 *   fall back to an in-memory store when localStorage is unavailable (e.g.
 *   SSR, privacy mode, or headless test environments).
 * - All public functions validate inputs eagerly and throw typed
 *   `MetricBuilderError` instances so callers can distinguish user errors
 *   from system failures.
 *
 * Integration points:
 * - Works with `ReportDataSet` from `customReports.ts` as the data source.
 * - `evaluateFormula` resolves field references against a generic record so
 *   it can also be used with `buildAnalyticsSnapshot` output from
 *   `analytics.ts`.
 *
 * @see CUSTOM_METRIC_BUILDER_GUIDE.md — full usage guide
 * @see src/lib/customReports.ts — report infrastructure this extends
 */

// ─── Error types ─────────────────────────────────────────────────────────────

export type MetricBuilderErrorCode =
  | 'invalid_formula'
  | 'invalid_input'
  | 'field_not_found'
  | 'division_by_zero'
  | 'storage_unavailable'
  | 'duplicate_id'
  | 'not_found'
  | 'limit_exceeded';

export class MetricBuilderError extends Error {
  readonly code: MetricBuilderErrorCode;
  constructor(code: MetricBuilderErrorCode, message: string) {
    super(message);
    this.name = 'MetricBuilderError';
    this.code = code;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** Supported Horizon resource categories for field discovery. */
export type MetricFieldSource =
  | 'account'
  | 'transactions'
  | 'network'
  | 'activity'
  | 'risks';

/** A single field that can be referenced in a formula. */
export interface MetricField {
  /** Dot-separated path, e.g. `account.xlmBalance`. */
  path: string;
  /** Human-readable label shown in the builder UI. */
  label: string;
  /** Source category. */
  source: MetricFieldSource;
  /** Brief description. */
  description: string;
}

/** A saved, reusable metric formula. */
export interface SavedMetricFormula {
  /** Unique identifier. */
  id: string;
  /** User-visible name (e.g. "Fee Efficiency Ratio"). */
  name: string;
  /** Optional description. */
  description: string;
  /** The expression string, e.g. `account.xlmBalance / transactions.totalTransactions`. */
  formula: string;
  /** Optional display format. */
  format?: MetricDisplayFormat;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last update timestamp. */
  updatedAt: string;
  /** User-defined tags for categorisation. */
  tags: string[];
}

/** Display format for computed values. */
export type MetricDisplayFormat = 'number' | 'percentage' | 'stroops' | 'xlm';

/** Result of evaluating a metric formula. */
export interface MetricEvaluationResult {
  /** The computed numeric value. */
  value: number;
  /** The formatted display string. */
  formatted: string;
  /** Field paths that were resolved during evaluation. */
  resolvedFields: string[];
}

// ─── Horizon field catalogue ─────────────────────────────────────────────────

/**
 * Catalogue of known Horizon fields available in the metric builder.
 * These paths align with the output of `buildAnalyticsSnapshot()` from
 * `analytics.ts` and the `ReportDataSet` type from `customReports.ts`.
 */
export const METRIC_FIELD_CATALOGUE: MetricField[] = [
  // Account fields
  { path: 'account.xlmBalance', label: 'XLM Balance', source: 'account', description: 'Native XLM balance of the account' },
  { path: 'account.trustlineCount', label: 'Trustline Count', source: 'account', description: 'Number of non-native trustlines' },
  { path: 'account.totalAssets', label: 'Total Assets', source: 'account', description: 'Total number of balance entries including native' },
  { path: 'account.nonNativeBalanceCount', label: 'Non-Native Funded Count', source: 'account', description: 'Number of non-native trustlines with a positive balance' },

  // Transaction fields
  { path: 'transactions.totalTransactions', label: 'Total Transactions', source: 'transactions', description: 'Total number of transactions' },
  { path: 'transactions.successfulTransactions', label: 'Successful Transactions', source: 'transactions', description: 'Number of successful transactions' },
  { path: 'transactions.failedTransactions', label: 'Failed Transactions', source: 'transactions', description: 'Number of failed transactions' },
  { path: 'transactions.successRate', label: 'Success Rate', source: 'transactions', description: 'Ratio of successful to total transactions (0–1)' },
  { path: 'transactions.weeklyActivity', label: 'Weekly Activity', source: 'transactions', description: 'Transaction count in the last 7 days' },
  { path: 'transactions.averageOperationsPerTx', label: 'Avg Ops per Tx', source: 'transactions', description: 'Average number of operations per transaction' },

  // Network fields
  { path: 'network.latestLedgerSequence', label: 'Latest Ledger', source: 'network', description: 'Sequence number of the most recent ledger' },
  { path: 'network.baseFee', label: 'Base Fee', source: 'network', description: 'Last ledger base fee in stroops' },
  { path: 'network.p90Fee', label: 'P90 Fee', source: 'network', description: '90th percentile accepted fee in stroops' },
  { path: 'network.txSuccessCount', label: 'Ledger Tx Success Count', source: 'network', description: 'Successful transaction count in the latest ledger' },
  { path: 'network.txFailedCount', label: 'Ledger Tx Failed Count', source: 'network', description: 'Failed transaction count in the latest ledger' },
  { path: 'network.operationCount', label: 'Ledger Operation Count', source: 'network', description: 'Total operations in the latest ledger' },
  { path: 'network.averageCloseSeconds', label: 'Avg Close Time', source: 'network', description: 'Average ledger close time in seconds' },
];

// ─── Expression parser & evaluator ──────────────────────────────────────────
//
// A minimal recursive-descent parser for safe arithmetic expressions.
//
// Grammar:
//   expr     → term (('+' | '-') term)*
//   term     → unary (('*' | '/') unary)*
//   unary    → '-' unary | primary
//   primary  → NUMBER | FIELD_PATH | '(' expr ')'
//
// Field paths match /^[a-zA-Z_][a-zA-Z0-9_.]*$/
// Numbers match /^\d+(\.\d+)?$/

interface Token {
  type: 'number' | 'field' | 'op' | 'lparen' | 'rparen';
  value: string;
}

const MAX_FORMULA_LENGTH = 1024;
const MAX_FIELD_DEPTH = 5;
const MAX_TOKENS = 256;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literal
    if (/\d/.test(ch)) {
      let num = '';
      while (i < input.length && /[\d.]/.test(input[i])) {
        num += input[i++];
      }
      // Validate number
      if (num.split('.').length > 2 || num.endsWith('.')) {
        throw new MetricBuilderError('invalid_formula', `Invalid number literal: "${num}"`);
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Identifier / field path
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_.]/.test(input[i])) {
        ident += input[i++];
      }
      // Validate field depth
      const parts = ident.split('.');
      if (parts.length > MAX_FIELD_DEPTH) {
        throw new MetricBuilderError('invalid_formula', `Field path too deep (max ${MAX_FIELD_DEPTH} segments): "${ident}"`);
      }
      if (parts.some(p => p === '')) {
        throw new MetricBuilderError('invalid_formula', `Invalid field path: "${ident}"`);
      }
      tokens.push({ type: 'field', value: ident });
      continue;
    }

    // Operators
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }

    throw new MetricBuilderError('invalid_formula', `Unexpected character: "${ch}" at position ${i}`);
  }

  if (tokens.length > MAX_TOKENS) {
    throw new MetricBuilderError('invalid_formula', `Formula too complex (max ${MAX_TOKENS} tokens)`);
  }

  return tokens;
}

class Parser {
  private pos = 0;
  private resolvedFields: string[] = [];

  constructor(
    private tokens: Token[],
    private data: Record<string, unknown>,
  ) {}

  parse(): { value: number; resolvedFields: string[] } {
    if (this.tokens.length === 0) {
      throw new MetricBuilderError('invalid_formula', 'Formula is empty');
    }
    const value = this.expr();
    if (this.pos < this.tokens.length) {
      throw new MetricBuilderError(
        'invalid_formula',
        `Unexpected token after end of expression: "${this.tokens[this.pos].value}"`,
      );
    }
    return { value, resolvedFields: Array.from(new Set(this.resolvedFields)) };
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: Token['type'], value?: string): Token {
    const token = this.peek();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      throw new MetricBuilderError(
        'invalid_formula',
        `Expected ${value ?? type} but got ${token ? `"${token.value}"` : 'end of input'}`,
      );
    }
    return this.advance();
  }

  // expr → term (('+' | '-') term)*
  private expr(): number {
    let left = this.term();
    while (this.peek()?.type === 'op' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.advance().value;
      const right = this.term();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  // term → unary (('*' | '/') unary)*
  private term(): number {
    let left = this.unary();
    while (this.peek()?.type === 'op' && (this.peek()!.value === '*' || this.peek()!.value === '/')) {
      const op = this.advance().value;
      const right = this.unary();
      if (op === '/') {
        if (right === 0) {
          throw new MetricBuilderError('division_by_zero', 'Division by zero in formula');
        }
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  // unary → '-' unary | primary
  private unary(): number {
    if (this.peek()?.type === 'op' && this.peek()!.value === '-') {
      this.advance();
      return -this.unary();
    }
    return this.primary();
  }

  // primary → NUMBER | FIELD_PATH | '(' expr ')'
  private primary(): number {
    const token = this.peek();
    if (!token) {
      throw new MetricBuilderError('invalid_formula', 'Unexpected end of expression');
    }

    if (token.type === 'number') {
      this.advance();
      return Number(token.value);
    }

    if (token.type === 'field') {
      this.advance();
      return this.resolveField(token.value);
    }

    if (token.type === 'lparen') {
      this.advance();
      const value = this.expr();
      this.expect('rparen', ')');
      return value;
    }

    throw new MetricBuilderError('invalid_formula', `Unexpected token: "${token.value}"`);
  }

  private resolveField(path: string): number {
    this.resolvedFields.push(path);
    const parts = path.split('.');
    let current: unknown = this.data;

    for (const part of parts) {
      if (current == null || typeof current !== 'object') {
        throw new MetricBuilderError('field_not_found', `Field not found: "${path}" (failed at "${part}")`);
      }
      current = (current as Record<string, unknown>)[part];
    }

    if (current == null) {
      throw new MetricBuilderError('field_not_found', `Field "${path}" resolved to null or undefined`);
    }

    const num = Number(current);
    if (!Number.isFinite(num)) {
      throw new MetricBuilderError(
        'invalid_input',
        `Field "${path}" resolved to a non-numeric value: ${JSON.stringify(current)}`,
      );
    }

    return num;
  }
}

// ─── Public formula helpers ──────────────────────────────────────────────────

/**
 * Validate a formula string without evaluating it.
 * Returns a list of field paths referenced in the formula.
 *
 * @throws MetricBuilderError with code `invalid_formula` when the expression
 *         cannot be parsed.
 */
export function validateFormula(formula: string): { valid: true; fields: string[] } {
  if (typeof formula !== 'string') {
    throw new MetricBuilderError('invalid_input', 'Formula must be a string');
  }
  const trimmed = formula.trim();
  if (trimmed.length === 0) {
    throw new MetricBuilderError('invalid_formula', 'Formula must not be empty');
  }
  if (trimmed.length > MAX_FORMULA_LENGTH) {
    throw new MetricBuilderError(
      'invalid_formula',
      `Formula exceeds maximum length (${MAX_FORMULA_LENGTH} characters)`,
    );
  }

  const tokens = tokenize(trimmed);
  // Dry-run parse with 1s for all fields to validate structure.
  // Using 1 (not 0) prevents false division-by-zero errors when the formula
  // divides by a field reference.
  const dummyData = new Proxy({} as Record<string, unknown>, {
    get: (_target, _prop) => {
      return new Proxy({} as Record<string, unknown>, {
        get: () => 1,
      });
    },
  });

  const parser = new Parser(tokens, dummyData);
  parser.parse();

  const fields = tokens.filter(t => t.type === 'field').map(t => t.value);
  return { valid: true, fields: Array.from(new Set(fields)) };
}

/**
 * Evaluate a formula against a data object (e.g. analytics snapshot).
 *
 * @param formula — The expression string.
 * @param data    — A record whose nested keys resolve field references.
 * @param format  — Optional display format for the result.
 * @returns The numeric result along with the formatted display string.
 *
 * @throws MetricBuilderError on parse errors, missing fields, division by
 *         zero, or non-numeric resolved values.
 */
export function evaluateFormula(
  formula: string,
  data: Record<string, unknown>,
  format: MetricDisplayFormat = 'number',
): MetricEvaluationResult {
  if (typeof formula !== 'string' || formula.trim().length === 0) {
    throw new MetricBuilderError('invalid_formula', 'Formula must be a non-empty string');
  }
  if (!data || typeof data !== 'object') {
    throw new MetricBuilderError('invalid_input', 'Data must be a non-null object');
  }

  const trimmed = formula.trim();
  if (trimmed.length > MAX_FORMULA_LENGTH) {
    throw new MetricBuilderError(
      'invalid_formula',
      `Formula exceeds maximum length (${MAX_FORMULA_LENGTH} characters)`,
    );
  }

  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens, data);
  const { value, resolvedFields } = parser.parse();

  if (!Number.isFinite(value)) {
    throw new MetricBuilderError('invalid_input', `Formula evaluated to a non-finite value: ${value}`);
  }

  return {
    value,
    formatted: formatMetricValue(value, format),
    resolvedFields,
  };
}

/**
 * Format a numeric metric value for display.
 */
export function formatMetricValue(value: number, format: MetricDisplayFormat = 'number'): string {
  switch (format) {
    case 'percentage':
      return `${(value * 100).toFixed(1)}%`;
    case 'stroops':
      return `${Math.round(value)} stroops`;
    case 'xlm':
      return `${(value / 10_000_000).toFixed(7)} XLM`;
    case 'number':
    default:
      // Use locale-aware formatting for readability
      if (Number.isInteger(value)) return value.toLocaleString('en-US');
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
}

// ─── Saved formula storage ───────────────────────────────────────────────────

const STORAGE_KEY = 'stellar-dev-dashboard-saved-metric-formulas';
const MAX_SAVED_FORMULAS = 100;

let inMemoryStore: SavedMetricFormula[] = [];

function getStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  const storage = (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
  return storage ?? null;
}

function readFromStorage(): SavedMetricFormula[] {
  const storage = getStorage();
  if (!storage) return inMemoryStore;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return inMemoryStore;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return inMemoryStore;
    inMemoryStore = parsed as SavedMetricFormula[];
    return inMemoryStore;
  } catch {
    return inMemoryStore;
  }
}

function writeToStorage(formulas: SavedMetricFormula[]): void {
  inMemoryStore = formulas;
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(formulas));
  } catch {
    // Quota exceeded or storage disabled — the in-memory copy is still usable
  }
}

// ─── CRUD operations ─────────────────────────────────────────────────────────

function validateFormulaId(id: string): void {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new MetricBuilderError('invalid_input', 'Formula id must be a non-empty string');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new MetricBuilderError(
      'invalid_input',
      'Formula id may only contain alphanumeric characters, hyphens, and underscores',
    );
  }
}

function validateFormulaName(name: string): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new MetricBuilderError('invalid_input', 'Formula name must be a non-empty string');
  }
  if (name.length > 128) {
    throw new MetricBuilderError('invalid_input', 'Formula name must be 128 characters or fewer');
  }
}

/**
 * Save a new metric formula. The formula expression is validated before
 * persisting. Throws if the id is already taken or the save limit is reached.
 */
export function saveMetricFormula(input: {
  id: string;
  name: string;
  description?: string;
  formula: string;
  format?: MetricDisplayFormat;
  tags?: string[];
}): SavedMetricFormula {
  validateFormulaId(input.id);
  validateFormulaName(input.name);
  validateFormula(input.formula);

  const existing = readFromStorage();
  if (existing.some(f => f.id === input.id)) {
    throw new MetricBuilderError('duplicate_id', `A formula with id "${input.id}" already exists`);
  }
  if (existing.length >= MAX_SAVED_FORMULAS) {
    throw new MetricBuilderError(
      'limit_exceeded',
      `Cannot save more than ${MAX_SAVED_FORMULAS} formulas. Delete unused formulas first.`,
    );
  }

  const now = new Date().toISOString();
  const formula: SavedMetricFormula = {
    id: input.id,
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    formula: input.formula.trim(),
    format: input.format ?? 'number',
    createdAt: now,
    updatedAt: now,
    tags: input.tags ?? [],
  };

  writeToStorage([...existing, formula]);
  return formula;
}

/**
 * Update an existing saved formula by id. Returns the updated formula.
 */
export function updateMetricFormula(
  id: string,
  updates: Partial<Pick<SavedMetricFormula, 'name' | 'description' | 'formula' | 'format' | 'tags'>>,
): SavedMetricFormula {
  validateFormulaId(id);

  if (updates.name !== undefined) validateFormulaName(updates.name);
  if (updates.formula !== undefined) validateFormula(updates.formula);

  const stored = readFromStorage();
  const index = stored.findIndex(f => f.id === id);
  if (index === -1) {
    throw new MetricBuilderError('not_found', `No saved formula with id "${id}"`);
  }

  const updated: SavedMetricFormula = {
    ...stored[index],
    ...(updates.name !== undefined && { name: updates.name.trim() }),
    ...(updates.description !== undefined && { description: updates.description.trim() }),
    ...(updates.formula !== undefined && { formula: updates.formula.trim() }),
    ...(updates.format !== undefined && { format: updates.format }),
    ...(updates.tags !== undefined && { tags: updates.tags }),
    updatedAt: new Date().toISOString(),
  };

  const next = [...stored];
  next[index] = updated;
  writeToStorage(next);
  return updated;
}

/**
 * Delete a saved formula by id.
 * @returns `true` if the formula was found and removed.
 */
export function deleteMetricFormula(id: string): boolean {
  validateFormulaId(id);
  const stored = readFromStorage();
  const next = stored.filter(f => f.id !== id);
  if (next.length === stored.length) {
    return false;
  }
  writeToStorage(next);
  return true;
}

/**
 * Retrieve a saved formula by id, or `undefined` if not found.
 */
export function getMetricFormula(id: string): SavedMetricFormula | undefined {
  validateFormulaId(id);
  return readFromStorage().find(f => f.id === id);
}

/**
 * List all saved formulas, optionally filtered by tags.
 */
export function listMetricFormulas(filterTags?: string[]): SavedMetricFormula[] {
  const all = readFromStorage();
  if (!filterTags || filterTags.length === 0) return [...all];
  return all.filter(f => filterTags.some(tag => f.tags.includes(tag)));
}

/**
 * Delete all saved formulas. Useful for testing and reset flows.
 */
export function clearAllMetricFormulas(): void {
  writeToStorage([]);
}

// ─── Integration helpers ─────────────────────────────────────────────────────

/**
 * Evaluate a saved formula by id against a data snapshot.
 * Combines `getMetricFormula` + `evaluateFormula` in one call.
 */
export function evaluateSavedFormula(
  id: string,
  data: Record<string, unknown>,
): MetricEvaluationResult {
  const formula = getMetricFormula(id);
  if (!formula) {
    throw new MetricBuilderError('not_found', `No saved formula with id "${id}"`);
  }
  return evaluateFormula(formula.formula, data, formula.format);
}

/**
 * Evaluate multiple saved formulas at once against the same data snapshot.
 * Returns a map of formula id → result. Formulas that fail are captured
 * as error strings so a single failure does not block the others.
 */
export function evaluateBatch(
  ids: string[],
  data: Record<string, unknown>,
): Map<string, MetricEvaluationResult | { error: string }> {
  const results = new Map<string, MetricEvaluationResult | { error: string }>();

  for (const id of ids) {
    try {
      results.set(id, evaluateSavedFormula(id, data));
    } catch (err) {
      results.set(id, { error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

/**
 * Export saved formulas to a portable JSON string for backup or sharing.
 */
export function exportMetricFormulas(): string {
  return JSON.stringify(readFromStorage(), null, 2);
}

/**
 * Import formulas from a JSON string. Existing formulas with the same id
 * are overwritten; others are preserved.
 */
export function importMetricFormulas(json: string): { imported: number; skipped: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new MetricBuilderError('invalid_input', 'Import data is not valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new MetricBuilderError('invalid_input', 'Import data must be a JSON array');
  }

  const existing = readFromStorage();
  const byId = new Map(existing.map(f => [f.id, f]));
  let imported = 0;
  let skipped = 0;

  for (const entry of parsed) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as SavedMetricFormula).id !== 'string' ||
      typeof (entry as SavedMetricFormula).name !== 'string' ||
      typeof (entry as SavedMetricFormula).formula !== 'string'
    ) {
      skipped++;
      continue;
    }

    try {
      validateFormula((entry as SavedMetricFormula).formula);
    } catch {
      skipped++;
      continue;
    }

    byId.set((entry as SavedMetricFormula).id, entry as SavedMetricFormula);
    imported++;
  }

  if (byId.size > MAX_SAVED_FORMULAS) {
    throw new MetricBuilderError(
      'limit_exceeded',
      `Import would exceed the ${MAX_SAVED_FORMULAS}-formula limit`,
    );
  }

  writeToStorage(Array.from(byId.values()));
  return { imported, skipped };
}
