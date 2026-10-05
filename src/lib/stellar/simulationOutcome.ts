/**
 * Soroban simulation outcome classifier (#896).
 *
 * Normalises a raw `simulateTransaction` JSON-RPC response into one of a small
 * set of outcome kinds so UI code and tests can branch on *why* a simulation
 * failed (auth vs. resource budget vs. archived state) instead of pattern
 * matching error strings at every call site.
 *
 * The classifier only reads plain JSON — it never decodes XDR — so it is safe
 * to run on untrusted RPC payloads and in any environment (browser, Node,
 * Playwright route handlers).
 */

export type SimulationOutcomeKind =
  | 'success'
  | 'auth_failure'
  | 'resource_exhaustion'
  | 'restore_required'
  | 'simulation_error'
  | 'rpc_error'
  | 'invalid_response';

export type SorobanResourceName = 'cpuInstructions' | 'memoryBytes';

export interface SorobanResourceLimits {
  cpuInstructions: number;
  memoryBytes: number;
}

/**
 * Per-transaction limits used to flag resource pressure. These mirror the
 * published Soroban network settings at the time of writing; pass explicit
 * limits when the target network is configured differently.
 */
export const DEFAULT_SOROBAN_RESOURCE_LIMITS: Readonly<SorobanResourceLimits> = Object.freeze({
  cpuInstructions: 100_000_000,
  memoryBytes: 41_943_040,
});

/** Usage at or above this fraction of a limit produces a warning. */
export const RESOURCE_WARNING_RATIO = 0.9;

export interface SimulationOutcome {
  kind: SimulationOutcomeKind;
  ok: boolean;
  message: string;
  /** Resource that was exhausted, when `kind === 'resource_exhaustion'`. */
  exhaustedResource?: SorobanResourceName;
  usage?: SorobanResourceLimits;
  warnings: string[];
  latestLedger?: number;
  minResourceFee?: string;
}

const AUTH_PATTERNS = [/Error\(Auth,/i, /\bInvalidAction\b.*auth/i, /require_auth/i, /not authorized/i];
const BUDGET_PATTERNS = [/Error\(Budget,/i, /ExceededLimit/i, /ResourceLimitExceeded/i, /budget exceeded/i];

function toFiniteNumber(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function detectExhaustedResource(message: string): SorobanResourceName | undefined {
  if (/mem/i.test(message)) return 'memoryBytes';
  if (/cpu|instruction/i.test(message)) return 'cpuInstructions';
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Classify a raw Soroban `simulateTransaction` response.
 *
 * Accepts either the full JSON-RPC envelope (`{ jsonrpc, id, result | error }`)
 * or just its `result` object. Never throws: malformed input yields
 * `kind: 'invalid_response'`.
 */
export function classifySimulationResponse(
  raw: unknown,
  limits: SorobanResourceLimits = DEFAULT_SOROBAN_RESOURCE_LIMITS
): SimulationOutcome {
  const fail = (kind: SimulationOutcomeKind, message: string, extra: Partial<SimulationOutcome> = {}) => ({
    kind,
    ok: false,
    message,
    warnings: [],
    ...extra,
  });

  if (!isRecord(raw)) {
    return fail('invalid_response', 'Simulation response must be a JSON object.');
  }

  if (isRecord(raw.error)) {
    const message = typeof raw.error.message === 'string' ? raw.error.message : 'Unknown RPC error';
    return fail('rpc_error', message);
  }

  const isEnvelope = 'jsonrpc' in raw || isRecord(raw.result);
  const result = isEnvelope ? raw.result : raw;
  if (!isRecord(result)) {
    return fail('invalid_response', 'Simulation response has no result object.');
  }

  const latestLedger = toFiniteNumber(result.latestLedger);

  if (typeof result.error === 'string') {
    const message = result.error;
    if (BUDGET_PATTERNS.some((p) => p.test(message))) {
      return fail('resource_exhaustion', message, {
        latestLedger,
        exhaustedResource: detectExhaustedResource(message),
      });
    }
    if (AUTH_PATTERNS.some((p) => p.test(message))) {
      return fail('auth_failure', message, { latestLedger });
    }
    return fail('simulation_error', message, { latestLedger });
  }

  if (isRecord(result.restorePreamble)) {
    return fail('restore_required', 'Archived ledger entries must be restored before invoking this contract.', {
      latestLedger,
      minResourceFee: typeof result.minResourceFee === 'string' ? result.minResourceFee : undefined,
    });
  }

  if (typeof result.transactionData !== 'string' || result.transactionData.length === 0) {
    return fail('invalid_response', 'Successful simulation is missing transactionData.', { latestLedger });
  }

  const cost = isRecord(result.cost) ? result.cost : {};
  const cpu = toFiniteNumber(cost.cpuInsns);
  const mem = toFiniteNumber(cost.memBytes);
  const usage = cpu !== undefined && mem !== undefined ? { cpuInstructions: cpu, memoryBytes: mem } : undefined;

  const warnings: string[] = [];
  if (usage) {
    for (const resource of ['cpuInstructions', 'memoryBytes'] as const) {
      const limit = limits[resource];
      if (!(limit > 0)) continue;
      if (usage[resource] > limit) {
        return fail('resource_exhaustion', `${resource} usage ${usage[resource]} exceeds limit ${limit}.`, {
          latestLedger,
          usage,
          exhaustedResource: resource,
        });
      }
      if (usage[resource] >= limit * RESOURCE_WARNING_RATIO) {
        warnings.push(`${resource} usage is at ${Math.round((usage[resource] / limit) * 100)}% of the network limit.`);
      }
    }
  }

  return {
    kind: 'success',
    ok: true,
    message: 'Simulation succeeded.',
    usage,
    warnings,
    latestLedger,
    minResourceFee: typeof result.minResourceFee === 'string' ? result.minResourceFee : undefined,
  };
}
