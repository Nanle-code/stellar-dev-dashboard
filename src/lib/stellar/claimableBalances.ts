import { NETWORKS, rateLimitedFetch, stellarCache, type NetworkName } from './networks.js';
import { TTL } from '../cache.js';
import { throwIfAborted, type HorizonRequestOptions } from './horizon.js';

// ─── Claimable Balances ───────────────────────────────────────────────────────

export interface ClaimableBalanceRecord {
  id: string;
  asset: string;
  amount: string;
  sponsor: string;
  last_modified_ledger: number;
  claimants: Array<{
    destination: string;
    predicate: Record<string, unknown>;
  }>;
}

/** Human-readable summary of a claimant predicate. */
export function formatClaimPredicate(predicate: Record<string, unknown>): string {
  if (!predicate || Object.keys(predicate).length === 0) return 'Unconditional';
  if ('unconditional' in predicate) return 'Unconditional';
  if ('abs_before' in predicate) return `Before ${predicate.abs_before}`;
  if ('abs_after' in predicate) return `After ${predicate.abs_after}`;
  if ('rel_before' in predicate) return `Within ${predicate.rel_before}s of claim`;
  if ('and' in predicate) {
    const parts = (predicate.and as Record<string, unknown>[]).map(formatClaimPredicate);
    return parts.join(' AND ');
  }
  if ('or' in predicate) {
    const parts = (predicate.or as Record<string, unknown>[]).map(formatClaimPredicate);
    return parts.join(' OR ');
  }
  if ('not' in predicate)
    return `NOT (${formatClaimPredicate(predicate.not as Record<string, unknown>)})`;
  return JSON.stringify(predicate);
}

export async function fetchClaimableBalances(
  publicKey: string,
  network: NetworkName = 'testnet',
  options: HorizonRequestOptions = {}
): Promise<ClaimableBalanceRecord[]> {
  throwIfAborted(options.signal);

  const cacheKey = `claimable:${publicKey}:${network}`;
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const config = NETWORKS[network];
  const url = `${config.horizonUrl}/claimable_balances?claimant=${encodeURIComponent(publicKey)}&limit=50`;
  // This path goes through `fetch`, so the signal cancels the request on the wire.
  const response = await rateLimitedFetch(
    url,
    options.signal ? { signal: options.signal } : undefined,
    'medium',
    config.customHeaders
  );

  if (!response.ok) throw new Error(`Horizon error ${response.status}`);

  const data = await response.json();
  const records: ClaimableBalanceRecord[] = data._embedded?.records ?? [];
  stellarCache.set(cacheKey, records, TTL.ACCOUNT, ['claimable', publicKey]);
  return records;
}

// ─── Claimable Balance predicate explanation ───────────────────────────────────

/**
 * Structured, human-readable explanation of a claimable-balance claimant
 * predicate. Used by the claimable-balance workspace to explain *when* and
 * *whether* a balance can be claimed.
 */
export interface PredicateExplanation {
  /** Normalized predicate kind. */
  kind: 'unconditional' | 'abs_before' | 'abs_after' | 'rel_before' | 'and' | 'or' | 'not' | 'unknown';
  /** Short human-readable summary. */
  summary: string;
  /** Whether the predicate currently permits a claim (best-effort, null = unknown). */
  claimableNow: boolean | null;
  /** Epoch ms at/after which the balance becomes claimable, if determinable. */
  claimableAt: number | null;
  /** Sub-explanations for `and` / `or` / `not` predicates. */
  children?: PredicateExplanation[];
}

function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number') return value * 1000; // Horizon timestamps are seconds
  if (typeof value === 'string') {
    const n = Number(value);
    if (!Number.isNaN(n) && value.trim() !== '') return n * 1000;
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/** Combine child `claimableNow` results for an AND predicate. */
function combineAnd(children: PredicateExplanation[]): boolean | null {
  if (children.length === 0) return null;
  if (children.some((c) => c.claimableNow === false)) return false;
  if (children.some((c) => c.claimableNow === null)) return null;
  return true;
}

/** Combine child `claimableNow` results for an OR predicate. */
function combineOr(children: PredicateExplanation[]): boolean | null {
  if (children.length === 0) return null;
  if (children.some((c) => c.claimableNow === true)) return true;
  if (children.some((c) => c.claimableNow === null)) return null;
  return false;
}

/**
 * Explain a claimant predicate deterministically.
 *
 * @param predicate - Raw Horizon predicate object (or already a string/object)
 * @param now - Reference timestamp in ms (defaults to `Date.now()`); injectable
 *              for tests and deterministic rendering.
 * @returns {PredicateExplanation}
 */
export function explainClaimPredicate(predicate: unknown, now: number = Date.now()): PredicateExplanation {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate) || Object.keys(predicate).length === 0) {
    return {
      kind: 'unconditional',
      summary: 'Unconditional — claimable by the recipient at any time',
      claimableNow: true,
      claimableAt: null,
    };
  }

  const p = predicate as Record<string, unknown>;

  if ('unconditional' in p) {
    return {
      kind: 'unconditional',
      summary: 'Unconditional — claimable by the recipient at any time',
      claimableNow: true,
      claimableAt: null,
    };
  }

  if ('abs_before' in p) {
    const ms = toEpochMs(p.abs_before);
    if (ms == null) {
      return { kind: 'abs_before', summary: `Before ${String(p.abs_before)}`, claimableNow: null, claimableAt: null };
    }
    return {
      kind: 'abs_before',
      summary: `Claimable before ${new Date(ms).toUTCString()}`,
      claimableNow: now < ms,
      claimableAt: null,
    };
  }

  if ('abs_after' in p) {
    const ms = toEpochMs(p.abs_after);
    if (ms == null) {
      return { kind: 'abs_after', summary: `After ${String(p.abs_after)}`, claimableNow: null, claimableAt: null };
    }
    return {
      kind: 'abs_after',
      summary: `Claimable after ${new Date(ms).toUTCString()}`,
      claimableNow: now >= ms,
      claimableAt: ms,
    };
  }

  if ('rel_before' in p) {
    const secs = Number(p.rel_before);
    if (Number.isNaN(secs)) {
      return { kind: 'rel_before', summary: `Within ${String(p.rel_before)}s of claim`, claimableNow: null, claimableAt: null };
    }
    return {
      kind: 'rel_before',
      summary: `Claimable within ${secs}s of the balance's creation ledger`,
      claimableNow: null,
      claimableAt: null,
    };
  }

  if ('and' in p) {
    const children = Array.isArray(p.and) ? (p.and as unknown[]).map((c) => explainClaimPredicate(c, now)) : [];
    return {
      kind: 'and',
      summary: `All of: ${children.map((c) => c.summary).join(' AND ')}`,
      claimableNow: combineAnd(children),
      claimableAt: null,
      children,
    };
  }

  if ('or' in p) {
    const children = Array.isArray(p.or) ? (p.or as unknown[]).map((c) => explainClaimPredicate(c, now)) : [];
    return {
      kind: 'or',
      summary: `Any of: ${children.map((c) => c.summary).join(' OR ')}`,
      claimableNow: combineOr(children),
      claimableAt: null,
      children,
    };
  }

  if ('not' in p) {
    const child = explainClaimPredicate(p.not, now);
    return {
      kind: 'not',
      summary: `NOT (${child.summary})`,
      claimableNow: child.claimableNow === null ? null : !child.claimableNow,
      claimableAt: null,
      children: [child],
    };
  }

  return {
    kind: 'unknown',
    summary: JSON.stringify(predicate),
    claimableNow: null,
    claimableAt: null,
  };
}

// ─── Claimable Balance predicate builder ───────────────────────────────────────

/**
 * Declarative spec for building a Stellar claimable-balance claimant predicate.
 * Kept UI-agnostic and pure so it can be unit-tested without the Stellar SDK.
 */
export type PredicateSpec =
  | { type: 'unconditional' }
  | { type: 'before'; date: string | Date }
  | { type: 'after'; date: string | Date }
  | { type: 'relative'; seconds: number }
  | { type: 'and'; predicates: PredicateSpec[] }
  | { type: 'or'; predicates: PredicateSpec[] }
  | { type: 'not'; predicate: PredicateSpec };

function toISODate(value: string | Date): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return null;
}

/**
 * Build a Stellar claimant predicate object from a declarative {@link PredicateSpec}.
 *
 * @param spec - The predicate specification
 * @returns A plain predicate object consumable by `StellarSdk.Claimant`
 * @throws {TypeError} If the spec is invalid (bad date, non-positive relative
 *                      time, too few operands, or unknown type)
 */
export function buildClaimPredicate(spec: PredicateSpec): Record<string, unknown> {
  if (!spec || typeof spec !== 'object') {
    throw new TypeError('buildClaimPredicate: spec must be an object');
  }
  switch (spec.type) {
    case 'unconditional':
      return { unconditional: null };
    case 'before': {
      const iso = toISODate(spec.date);
      if (!iso) throw new TypeError('buildClaimPredicate: "before" requires a valid date');
      return { abs_before: iso };
    }
    case 'after': {
      const iso = toISODate(spec.date);
      if (!iso) throw new TypeError('buildClaimPredicate: "after" requires a valid date');
      return { abs_after: iso };
    }
    case 'relative': {
      const secs = Number(spec.seconds);
      if (!Number.isFinite(secs) || secs <= 0) {
        throw new TypeError('buildClaimPredicate: "relative" requires a positive number of seconds');
      }
      return { rel_before: Math.floor(secs) };
    }
    case 'and':
    case 'or': {
      const list = spec.predicates;
      if (!Array.isArray(list) || list.length < 2) {
        throw new TypeError(`buildClaimPredicate: "${spec.type}" requires at least two predicates`);
      }
      return { [spec.type]: list.map(buildClaimPredicate) };
    }
    case 'not': {
      if (!spec.predicate) throw new TypeError('buildClaimPredicate: "not" requires a predicate');
      return { not: buildClaimPredicate(spec.predicate) };
    }
    default:
      throw new TypeError(`buildClaimPredicate: unknown predicate type "${(spec as { type?: string }).type}"`);
  }
}

// ─── Claimable Balance inspection ──────────────────────────────────────────────

/**
 * Fetch a single claimable balance by its id (Horizon `GET /claimable_balances/:id`).
 *
 * Used by the workspace "inspect" view to show full claimant/predicate detail.
 *
 * @param balanceId - Horizon claimable-balance id (non-empty string)
 * @param network - Target network
 * @returns {Promise<ClaimableBalanceRecord>}
 * @throws {TypeError} If `balanceId` is not a non-empty string
 * @throws {Error} If the network is unsupported or Horizon returns an error
 *                  (404 → "not found")
 */
export async function fetchClaimableBalanceById(
  balanceId: string,
  network: NetworkName = 'testnet'
): Promise<ClaimableBalanceRecord> {
  if (typeof balanceId !== 'string' || balanceId.trim().length === 0) {
    throw new TypeError('fetchClaimableBalanceById: balanceId must be a non-empty string');
  }
  const config = NETWORKS[network];
  if (!config || !config.horizonUrl) {
    throw new Error(`fetchClaimableBalanceById: unsupported network "${network}"`);
  }

  const url = `${config.horizonUrl}/claimable_balances/${encodeURIComponent(balanceId)}`;
  const response = await rateLimitedFetch(url, undefined, 'medium', config.customHeaders);

  if (response.status === 404) {
    throw new Error(`Claimable balance ${balanceId} not found`);
  }
  if (!response.ok) {
    throw new Error(`Horizon error ${response.status} while fetching claimable balance`);
  }

  const data = await response.json();
  return data as ClaimableBalanceRecord;
}
