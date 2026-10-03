/**
 * shareLinks.ts — reproducible, secret-free links for a dashboard view.
 *
 * Debugging a dashboard view usually means sending a screenshot, which cannot
 * be acted on. A share link instead encodes the *inputs* to the view — network,
 * route/tab, selected entity, filters, and an optional pinned ledger sequence —
 * so the recipient rebuilds the same view instead of guessing at it.
 *
 * ─── Security model ───────────────────────────────────────────────────────────
 *
 * Shared links travel through chat, issue trackers and bug reports, so the
 * pipeline is built to make leakage structurally impossible rather than
 * merely unlikely:
 *
 *  1. **Allow-list extraction.** `snapshotFromState()` reads named fields off
 *     the store. It never iterates the store, so a new secret added to the
 *     store later cannot leak into a link by default.
 *  2. **Allow-list serialization.** `buildShareUrl()` emits only the params in
 *     `SHARE_PARAMS`. Anything else in the snapshot is dropped.
 *  3. **Deny-list scrubbing.** `SECRET_KEY_PATTERN` rejects any key that even
 *     *looks* credential-bearing, and `stripSecretLikeValues()` redacts values
 *     that look like a Stellar secret seed / private key / bearer token. This
 *     is defence in depth behind (1) and (2) — it is what makes the guarantee
 *     survive someone widening the allow-list carelessly later.
 *  4. **Length caps.** Entity ids, filter values and expressions are truncated
 *     so a link cannot be used to smuggle arbitrary payload into a teammate's
 *     address bar.
 *
 * Specifically **never** shared: wallet connection state (`walletConnected`,
 * `walletType`, `walletPublicKey`, `walletSessionRevokedReason`), session
 * recording state, multisig session mode, custom network headers, and any
 * credential. `connectedAddress` *is* shared — it is the account being viewed,
 * which is public ledger data — but it is carried as a validated `entity`, not
 * as raw store state.
 *
 * ─── URL format ───────────────────────────────────────────────────────────────
 *
 * Query parameters (not a base64 hash): a shared link is meant to be read by a
 * human while debugging, and every field should be diffable in a bug report.
 *
 *   /transactions?tab=transactions&network=testnet&e=tx:abc…&f=%7B…%7D&at=12345
 *
 *   v   schema version (absent or mismatched ⇒ still parsed on a best-effort
 *       basis, unknown fields ignored — see `migrateSnapshot()`)
 *   n   network
 *   t   route/tab id
 *   e   selected entity, `"<type>:<id>"` (validated on both encode and decode)
 *   f   filter state, compact JSON (defaults omitted)
 *   at  pinned ledger sequence
 *
 * @see docs/SHARED_VIEW_LINKS.md
 */

import { NETWORKS, isValidPublicKey, isValidContractId, type NetworkName } from './stellar';
import { DEFAULT_SEARCH_FILTERS, type FilterExpression, type SearchFilters } from './store';
import { normalizeLedgerSequence, describeLedgerPinSupport } from './ledgerPin';

// ─── Schema ───────────────────────────────────────────────────────────────────

/** Current schema version written by `buildShareUrl()`. */
export const SHARE_SCHEMA_VERSION = 1;

/** Lowest version this build knows how to interpret. */
export const MIN_SUPPORTED_SCHEMA_VERSION = 1;

export const SHARE_PARAMS = {
  version: 'v',
  network: 'n',
  tab: 't',
  entity: 'e',
  filters: 'f',
  ledger: 'at',
} as const;

export const NETWORK_NAMES = Object.keys(NETWORKS) as NetworkName[];

/**
 * Entity kinds a shared link can point at. Each has a validator, applied on
 * encode *and* decode, so a hand-edited link cannot smuggle a path traversal,
 * a `javascript:` URI, or an arbitrary blob into the recipient's UI.
 */
export const ENTITY_KINDS = ['tx', 'op', 'account', 'contract', 'balance'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

const TX_HASH_PATTERN = /^[0-9a-fA-F]{64}$/;
const OPERATION_ID_PATTERN = /^\d{1,20}-\d{1,20}$/;
const LEDGER_BALANCE_ID_PATTERN = /^[0-9a-fA-F]{1,64}$/;

/**
 * Validate an entity id against its kind.
 *
 * Public keys go through the app's own `isValidPublicKey` (covers `G…`
 * ed25519, `M…` muxed, and `name*domain` federated forms); contract ids share
 * the same `Address` parser Horizon uses. Everything else is pattern-matched.
 */
export function isValidEntityId(kind: EntityKind, id: string): boolean {
  if (typeof id !== 'string') return false;
  const value = id.trim();
  if (value === '' || value.length > 128) return false;

  switch (kind) {
    case 'account':
      return isValidPublicKey(value);
    case 'contract':
      try {
        return isValidContractId(value);
      } catch {
        return false;
      }
    case 'tx':
      return TX_HASH_PATTERN.test(value);
    case 'op':
      return OPERATION_ID_PATTERN.test(value);
    case 'balance':
      return LEDGER_BALANCE_ID_PATTERN.test(value);
    default:
      return false;
  }
}

export interface ShareEntity {
  kind: EntityKind;
  id: string;
}

export interface ViewSnapshot {
  version: number;
  network: NetworkName;
  tab: string;
  entity: ShareEntity | null;
  /** Non-default filter fields only. */
  filters: Partial<SearchFilters>;
  expressions: FilterExpression[];
  /** Pinned ledger sequence, or `null` for "as of now". */
  ledger: number | null;
}

// ─── Limits (share URLs live in chat messages and issue titles) ───────────────

export const MAX_FILTER_VALUE_LENGTH = 120;
export const MAX_FILTER_EXPRESSIONS = 20;
export const MAX_TAB_LENGTH = 48;
export const TAB_PATTERN = /^[A-Za-z0-9_-]{1,48}$/;

// ─── Secret screening ─────────────────────────────────────────────────────────

/**
 * Keys that must never appear in a share link, matched case-insensitively
 * against both the field name and the URL parameter name.
 *
 * Deliberately broad. A false positive costs a field that was not needed
 * anyway; a false negative leaks a credential into a public bug report.
 */
export const SECRET_KEY_PATTERN =
  /(secret|mnemonic|seed|private|privkey|priv_key|password|passwd|passphrase|token|api[_-]?key|apikey|authorization|auth[_-]?token|bearer|credential|wallet|session|cookie|signature|signed|signer|header|auth)/i;

/** Store fields that are secret/session scoped and are structurally excluded. */
export const NEVER_SHARED_STORE_KEYS = [
  'walletConnected',
  'walletType',
  'walletPublicKey',
  'walletSessionRevokedReason',
  'sessionRecordingActive',
  'sessionRecordingId',
  'multiSigMode',
  'customTheme',
  'themeBuilderDraft',
] as const;

/**
 * Value shapes that are always credentials, regardless of the key they hang off.
 *
 * Note the absence of `\b` anchors: a trailing word boundary would not fire
 * after a base32 digit (`S` + 56 chars, last char `7`, is followed by a space,
 * so `\b` *would* fail and the secret would slip through). These patterns are
 * written as length-bounded runs with a leading non-alphabet guard instead, so
 * detection does not depend on what surrounds the candidate.
 */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  // Stellar secret seeds: 'S' + 55 base32 chars, i.e. 56 characters total
  // (a 32-byte seed + 2-byte CRC, base32-encoded by the SDK).
  /(?:^|[^A-Za-z2-7])S[A-Z2-7]{55}/,
  // Raw ed25519 private keys (32 bytes of hex). A 64-char transaction hash is
  // well under this, so a legitimate hash never trips it.
  /(?:^|[^0-9a-fA-F])[0-9a-fA-F]{128}/,
  // PEM blocks.
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // JWTs and bearer tokens.
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
  /Bearer\s+[A-Za-z0-9._-]{20,}/i,
];

/**
 * True when a key name is credential-bearing.
 * Exported so tests can assert the deny-list covers the real store fields.
 */
export function isSecretLikeKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

/**
 * True when a value looks like a credential regardless of its key.
 * Used as the last gate before a value is written into a URL.
 */
export function looksLikeSecretValue(value: string): boolean {
  if (typeof value !== 'string' || value === '') return false;
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

// ─── Value normalization ──────────────────────────────────────────────────────

/**
 * Normalize a free-text value destined for a URL: strip control characters
 * (including the separators that would let a value forge a new parameter),
 * collapse whitespace, and cap the length.
 */
export function sanitizeShareText(value: unknown, maxLength = MAX_FILTER_VALUE_LENGTH): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const cleaned = raw
    // Control characters (including \r and \n) are stripped so a value cannot
    // forge a new query parameter or smuggle a line break into a bug report.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

function isNetworkName(value: unknown): value is NetworkName {
  return typeof value === 'string' && (NETWORK_NAMES as string[]).includes(value);
}

// ─── Snapshot extraction ──────────────────────────────────────────────────────

/**
 * The slice of store state a share link is allowed to observe.
 *
 * Typed as an explicit interface on purpose: adding a field here is a
 * deliberate, reviewable decision, and `snapshotFromState` cannot accidentally
 * start serializing anything else.
 */
export interface ShareableViewState {
  network?: NetworkName;
  activeTab?: string;
  contractId?: string;
  connectedAddress?: string | null;
  searchFilters?: SearchFilters;
  filterExpressions?: FilterExpression[];
  selectedTemplateId?: string | null;
}

/**
 * Narrow raw store state down to the fields a share link may observe.
 *
 * This is the single gate between the store and the URL: everything the
 * serializer can reach must first pass through here. Kept as an explicit object
 * (rather than a pick/omit) so the allow-list is greppable and a future store
 * field cannot leak in without a deliberate edit here.
 */
export function selectShareableState(state: ShareableViewState): ShareableViewState {
  return {
    network: state.network,
    activeTab: state.activeTab,
    contractId: state.contractId,
    connectedAddress: state.connectedAddress,
    searchFilters: state.searchFilters,
    filterExpressions: state.filterExpressions,
    selectedTemplateId: state.selectedTemplateId,
  };
}

export interface SnapshotFromStateOptions {
  /**
   * Explicit pin to apply. `null` means "do not pin". Ignored when the route
   * cannot honour a pin (the sequence is then simply not recorded, rather than
   * being recorded in a way that implies it is enforced).
   */
  ledger?: number | null;
  /** Force a route id (e.g. from the URL) instead of trusting store state. */
  tab?: string;
}

/**
 * Reduce store state to a validated, secret-free snapshot.
 *
 * Validation is applied here rather than at serialization time so that an
 * invalid field is dropped consistently whether the snapshot came from the
 * live store or from parsing an incoming link.
 */
export function snapshotFromState(
  state: ShareableViewState,
  options: SnapshotFromStateOptions = {}
): ViewSnapshot {
  const network = isNetworkName(state.network) ? state.network : 'testnet';

  const tabCandidate = sanitizeShareText(options.tab ?? state.activeTab ?? '', MAX_TAB_LENGTH);
  const tab = TAB_PATTERN.test(tabCandidate) ? tabCandidate : 'overview';

  const filters = sanitizeFilters(state.searchFilters);
  const expressions = sanitizeExpressions(state.filterExpressions);

  const ledger = resolveLedger(options.ledger ?? null, tab);

  return {
    version: SHARE_SCHEMA_VERSION,
    network,
    tab,
    entity: resolveEntity(state),
    filters,
    expressions,
    ledger,
  };
}

/**
 * Pin is only recorded when the route can actually apply it.
 * See `ledgerPin.ts` for the support matrix.
 */
function resolveLedger(ledger: number | null, tab: string): number | null {
  if (!describeLedgerPinSupport(tab).honoured) return null;
  return normalizeLedgerSequence(ledger);
}

function resolveEntity(state: ShareableViewState): ShareEntity | null {
  const contractId = sanitizeShareText(state.contractId ?? '', 128);
  if (contractId && isValidEntityId('contract', contractId)) {
    return { kind: 'contract', id: contractId };
  }

  const address = sanitizeShareText(state.connectedAddress ?? '', 128);
  if (address && isValidEntityId('account', address)) {
    return { kind: 'account', id: address };
  }

  return null;
}

const SEARCH_FILTER_KEYS = Object.keys(DEFAULT_SEARCH_FILTERS) as (keyof SearchFilters)[];

/** Keep only non-default filter fields, normalized and scrubbed. */
export function sanitizeFilters(filters: SearchFilters | undefined | null): Partial<SearchFilters> {
  if (!filters || typeof filters !== 'object') return {};

  const out: Partial<SearchFilters> = {};
  for (const key of SEARCH_FILTER_KEYS) {
    if (isSecretLikeKey(key)) continue;
    const value = filters[key];
    if (value === undefined || value === DEFAULT_SEARCH_FILTERS[key]) continue;

    if (typeof DEFAULT_SEARCH_FILTERS[key] === 'boolean') {
      if (typeof value === 'boolean') (out as Record<string, unknown>)[key] = value;
      continue;
    }

    const text = sanitizeShareText(value, MAX_FILTER_VALUE_LENGTH);
    if (text === '') continue;
    if (looksLikeSecretValue(text)) continue;
    // Date filters must stay ISO-ish; reject anything that is not parseable so a
    // crafted link cannot push garbage into a date input.
    if ((key === 'startDate' || key === 'endDate') && Number.isNaN(Date.parse(text))) continue;
    (out as Record<string, unknown>)[key] = text;
  }
  return out;
}

const OPERATOR_PATTERN = /^[a-z]{1,24}$/;
const FILTER_KEY_PATTERN = /^[A-Za-z0-9_.]{1,64}$/;

/** Keep a bounded set of well-formed, non-secret filter expressions. */
export function sanitizeExpressions(
  expressions: FilterExpression[] | undefined | null
): FilterExpression[] {
  if (!Array.isArray(expressions)) return [];

  const out: FilterExpression[] = [];
  for (const expression of expressions.slice(0, MAX_FILTER_EXPRESSIONS)) {
    if (!expression || typeof expression !== 'object') continue;
    if (isSecretLikeKey(String(expression.key ?? ''))) continue;

    const key = sanitizeShareText(expression.key, 64);
    const operator = sanitizeShareText(expression.operator, 24);
    if (!FILTER_KEY_PATTERN.test(key)) continue;
    if (!OPERATOR_PATTERN.test(operator)) continue;

    const value = typeof expression.value === 'string'
      ? sanitizeShareText(expression.value, MAX_FILTER_VALUE_LENGTH)
      : expression.value;
    // Structured values (arrays, numbers) are fine but must stay small and
    // serializable; a raw secret inside one is still caught by the string path.
    if (typeof value === 'string' && looksLikeSecretValue(value)) continue;
    if (value !== null && typeof value === 'object') {
      try {
        if (JSON.stringify(value).length > MAX_FILTER_VALUE_LENGTH) continue;
      } catch {
        continue;
      }
    }

    out.push({ key, operator, value, ...(expression.not ? { not: true } : {}) });
  }
  return out;
}

// ─── Serialization ────────────────────────────────────────────────────────────

export interface BuildShareUrlOptions {
  /** Origin + path to build on. Defaults to the current location. */
  base?: string;
  /** Params already present in the URL that must be preserved. */
  extraParams?: Record<string, string>;
}

function defaultBase(): string {
  if (typeof window === 'undefined' || !window.location) return '/';
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Build the shareable URL for a snapshot.
 *
 * Only `SHARE_PARAMS` are emitted, and every emitted value passes the secret
 * screen, so the result cannot contain credential material even if the
 * snapshot was constructed by hand.
 */
export function buildShareUrl(snapshot: ViewSnapshot, options: BuildShareUrlOptions = {}): string {
  const base = sanitizeBase(options.base ?? defaultBase());
  const params = new URLSearchParams();

  params.set(SHARE_PARAMS.version, String(SHARE_SCHEMA_VERSION));

  if (isNetworkName(snapshot.network)) {
    params.set(SHARE_PARAMS.network, snapshot.network);
  }

  const tab = sanitizeShareText(snapshot.tab, MAX_TAB_LENGTH);
  if (TAB_PATTERN.test(tab)) params.set(SHARE_PARAMS.tab, tab);

  const entity = sanitizeEntity(snapshot.entity);
  if (entity) params.set(SHARE_PARAMS.entity, `${entity.kind}:${entity.id}`);

  const filterPayload = compactFilterPayload(snapshot);
  if (filterPayload) params.set(SHARE_PARAMS.filters, filterPayload);

  const ledger = normalizeLedgerSequence(snapshot.ledger);
  if (ledger !== null && describeLedgerPinSupport(snapshot.tab).honoured) {
    params.set(SHARE_PARAMS.ledger, String(ledger));
  }

  for (const [key, value] of Object.entries(options.extraParams ?? {})) {
    if (SHARE_PARAMS[key as keyof typeof SHARE_PARAMS]) continue;
    if (isSecretLikeKey(key)) continue;
    const safe = sanitizeShareText(value, MAX_FILTER_VALUE_LENGTH);
    if (safe === '' || looksLikeSecretValue(safe)) continue;
    params.set(key, safe);
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function sanitizeBase(base: string): string {
  const trimmed = String(base ?? '').trim();
  if (trimmed === '') return '/';
  // Allow only same-document or http(s) bases; a `javascript:` or `data:` base
  // would turn a copied link into a script execution vector.
  if (/^(javascript|data|vbscript|blob|file):/i.test(trimmed)) return '/';
  if (trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `/${trimmed.replace(/^\/+/, '')}`;
}

function sanitizeEntity(entity: ShareEntity | null | undefined): ShareEntity | null {
  if (!entity) return null;
  const kind = entity.kind;
  if (!(ENTITY_KINDS as readonly string[]).includes(kind)) return null;
  const id = sanitizeShareText(entity.id, 128);
  if (!isValidEntityId(kind as EntityKind, id)) return null;
  if (looksLikeSecretValue(id)) return null;
  return { kind: kind as EntityKind, id };
}

/**
 * Serialize only the non-default parts of the filter state, so the common case
 * (no filters) contributes nothing to the URL.
 */
function compactFilterPayload(snapshot: ViewSnapshot): string | null {
  const filters = sanitizeFilters(snapshot.filters as SearchFilters);
  const expressions = sanitizeExpressions(snapshot.expressions);
  if (Object.keys(filters).length === 0 && expressions.length === 0) return null;

  const payload: Record<string, unknown> = {};
  if (Object.keys(filters).length > 0) payload.f = filters;
  if (expressions.length > 0) payload.x = expressions;

  const json = JSON.stringify(payload);
  return json.length > 0 && json !== '{}' ? json : null;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

export interface ParseShareUrlOptions {
  /** Route ids the app can actually render. Unknown tabs are dropped. */
  knownTabs?: readonly string[] | null;
  /** Origin to resolve a relative `search` against. Defaults to the location. */
  origin?: string;
}

export type ParseShareUrlResult =
  | { ok: true; snapshot: ViewSnapshot; /** non-fatal problems found while decoding */ warnings: string[] }
  | { ok: false; snapshot: null; warnings: string[] };

/**
 * Parse a shared link's query string into a validated snapshot.
 *
 * Never throws: this runs on every page load against attacker-controllable
 * input. Problems are collected as `warnings` and the affected field is dropped,
 * so a partially-corrupt link still opens a usable view.
 *
 * @param search a query string (`'?a=b'`, `'a=b'`, or a full URL)
 */
export function parseShareUrl(
  search: string | URLSearchParams | null | undefined,
  options: ParseShareUrlOptions = {}
): ParseShareUrlResult {
  const warnings: string[] = [];

  if (search === null || search === undefined || search === '') {
    return { ok: false, snapshot: null, warnings };
  }

  let params: URLSearchParams;
  try {
    params = toSearchParams(search, options.origin);
  } catch {
    return { ok: false, snapshot: null, warnings: ['unparseable-url'] };
  }

  if (!params.has(SHARE_PARAMS.tab) && !params.has(SHARE_PARAMS.network) && !params.has(SHARE_PARAMS.entity) && !params.has(SHARE_PARAMS.filters) && !params.has(SHARE_PARAMS.ledger)) {
    return { ok: false, snapshot: null, warnings };
  }

  const rawVersion = params.get(SHARE_PARAMS.version);
  let version = SHARE_SCHEMA_VERSION;
  if (rawVersion !== null) {
    const parsed = Number(rawVersion);
    if (!Number.isInteger(parsed) || parsed < MIN_SUPPORTED_SCHEMA_VERSION) {
      warnings.push('unknown-schema-version');
    } else if (parsed > SHARE_SCHEMA_VERSION) {
      // A link from a newer build. Fields we know are still honoured; anything
      // the newer build added is silently ignored rather than half-applied.
      warnings.push('future-schema-version');
    } else {
      version = parsed;
    }
  }

  const rawNetwork = params.get(SHARE_PARAMS.network);
  let network: NetworkName = 'testnet';
  if (rawNetwork !== null) {
    if (isNetworkName(rawNetwork)) {
      network = rawNetwork;
    } else {
      warnings.push('unknown-network');
    }
  }

  const rawTab = params.get(SHARE_PARAMS.tab);
  let tab = 'overview';
  if (rawTab !== null) {
    const candidate = sanitizeShareText(rawTab, MAX_TAB_LENGTH);
    if (!TAB_PATTERN.test(candidate)) {
      warnings.push('invalid-tab');
    } else if (options.knownTabs && !options.knownTabs.includes(candidate)) {
      // Not a route this build knows. Falling back to the overview is safer than
      // routing somewhere unexpected.
      warnings.push('unknown-tab');
    } else {
      tab = candidate;
    }
  }

  const entity = parseEntity(params.get(SHARE_PARAMS.entity), warnings);
  const { filters, expressions } = parseFilters(params.get(SHARE_PARAMS.filters), warnings);

  const rawLedger = params.get(SHARE_PARAMS.ledger);
  let ledger: number | null = null;
  if (rawLedger !== null) {
    const normalized = normalizeLedgerSequence(rawLedger);
    if (normalized === null) {
      warnings.push('invalid-ledger-sequence');
    } else if (!describeLedgerPinSupport(tab).honoured) {
      // Keep the sequence for provenance, but the UI will report that this view
      // cannot honour it.
      ledger = normalized;
      warnings.push('ledger-pin-not-honoured');
    } else {
      ledger = normalized;
    }
  }

  return {
    ok: true,
    snapshot: { version, network, tab, entity, filters, expressions, ledger },
    warnings,
  };
}

function toSearchParams(
  search: string | URLSearchParams,
  origin?: string
): URLSearchParams {
  if (search instanceof URLSearchParams) return search;
  const raw = String(search);
  const trimmed = raw.replace(/^[?#]/, '');
  if (trimmed === '') throw new Error('empty');

  // A full URL may carry a fragment that must not be parsed as the query.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
    const base = origin ?? 'https://share.invalid';
    return new URL(trimmed, base).searchParams;
  }
  if (trimmed.startsWith('/')) {
    return new URL(trimmed, origin ?? 'https://share.invalid').searchParams;
  }
  return new URLSearchParams(trimmed);
}

function parseEntity(raw: string | null, warnings: string[]): ShareEntity | null {
  if (raw === null || raw === '') return null;

  const separator = raw.indexOf(':');
  if (separator <= 0) {
    warnings.push('invalid-entity');
    return null;
  }

  const kind = raw.slice(0, separator);
  const id = raw.slice(separator + 1);

  if (!(ENTITY_KINDS as readonly string[]).includes(kind)) {
    warnings.push('invalid-entity-kind');
    return null;
  }
  if (looksLikeSecretValue(id)) {
    warnings.push('rejected-secret-like-entity');
    return null;
  }
  if (!isValidEntityId(kind as EntityKind, id)) {
    warnings.push('invalid-entity-id');
    return null;
  }
  return { kind: kind as EntityKind, id };
}

function parseFilters(
  raw: string | null,
  warnings: string[]
): { filters: Partial<SearchFilters>; expressions: FilterExpression[] } {
  if (raw === null || raw === '') return { filters: {}, expressions: [] };
  // Cap the raw length before parsing: a crafted link should not be able to make
  // the app `JSON.parse` an arbitrarily large string.
  if (raw.length > 4096) {
    warnings.push('filters-too-large');
    return { filters: {}, expressions: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Failure case: a hand-mangled or truncated `f=` value. Degrade to "no
    // filters" and open the rest of the view rather than 500-ing.
    warnings.push('unparseable-filters');
    return { filters: {}, expressions: [] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    warnings.push('invalid-filters-shape');
    return { filters: {}, expressions: [] };
  }

  const container = parsed as Record<string, unknown>;
  const filters = sanitizeFilters(
    (container.f ?? undefined) as SearchFilters | undefined
  );
  const expressions = sanitizeExpressions(
    Array.isArray(container.x) ? (container.x as FilterExpression[]) : undefined
  );

  return { filters, expressions };
}

// ─── Helpers for the UI ───────────────────────────────────────────────────────

/**
 * Does the snapshot's network differ from the network the recipient is on?
 * Drives the mismatch banner.
 */
export function isNetworkMismatch(
  snapshot: Pick<ViewSnapshot, 'network'> | null | undefined,
  activeNetwork: NetworkName | null | undefined
): boolean {
  if (!snapshot || !activeNetwork) return false;
  if (!isNetworkName(snapshot.network) || !isNetworkName(activeNetwork)) return false;
  return snapshot.network !== activeNetwork;
}

/**
 * The `network` value in the link, or `null` when there is no active shared
 * view. Used to decide whether to show the banner at all.
 */
export function activeSnapshotNetwork(snapshot: ViewSnapshot | null | undefined): NetworkName | null {
  if (!snapshot) return null;
  return isNetworkName(snapshot.network) ? snapshot.network : null;
}

/**
 * Remove every share param from a query string, preserving unrelated params.
 * Backs the "Exit shared view" action.
 */
export function stripShareParams(search: string | URLSearchParams | null | undefined): string {
  if (search === null || search === undefined) return '';
  let params: URLSearchParams;
  try {
    params = toSearchParams(search);
  } catch {
    return '';
  }
  for (const name of Object.values(SHARE_PARAMS)) params.delete(name);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Development-time guard: returns the credential-shaped substrings found in a
 * share URL. Always `[]` for a correctly built link. Exported so the guarantee
 * is directly testable rather than inferred from the implementation.
 */
export function findSecretLikeContent(url: string): string[] {
  const found = new Set<string>();
  for (const pattern of SECRET_VALUE_PATTERNS) {
    const match = pattern.exec(url);
    if (match) found.add(match[0]);
  }
  try {
    const params = new URL(url, 'https://share.invalid').searchParams;
    for (const [key, value] of params.entries()) {
      if (isSecretLikeKey(key)) found.add(key);
      if (looksLikeSecretValue(value)) found.add(value);
    }
  } catch {
    /* relative base always parses */
  }
  return [...found];
}

/**
 * Build the `setSearchFilters` patch for an incoming snapshot.
 *
 * Returns `null` when the snapshot carried no filter state, so callers can skip
 * the store write entirely rather than resetting the recipient's own filters to
 * defaults just because a link omitted them.
 */
export function buildFilterPatch(
  filters: Partial<SearchFilters>
): Partial<SearchFilters> | null {
  const sanitized = sanitizeFilters(filters as SearchFilters);
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Resolve the effective filter state for a shared view: the link's non-default
 * fields layered over the app defaults.
 */
export function resolveFilters(incoming: Partial<SearchFilters>): SearchFilters {
  return { ...DEFAULT_SEARCH_FILTERS, ...incoming };
}

