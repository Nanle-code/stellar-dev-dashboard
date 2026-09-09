/**
 * Offline Read-Only Behavior Module
 *
 * Defines the offline read-only contract for cached account data:
 *  - Distinguish cached (stale/offline) data from live (network-fresh) data
 *  - Block unsafe write operations (mutations) when the network is unavailable
 *  - Provide metadata (`DataSource`) that UI components consume for badges/banners
 *  - Validate input and degrade gracefully in unsupported environments
 *
 * Architecture
 * ------------
 *  NetworkStatus        -> singleton, online/offline + heartbeat
 *  DataSource           -> discriminator: 'live' | 'cache' | 'stale' | 'unknown'
 *  WriteSafetyGate      -> predicate + typed error for write ops
 *  AccountDataSource    -> cache freshness evaluator (TTL + network context)
 */

export type DataSource = 'live' | 'cache' | 'cache-stale' | 'unknown';

export interface DataSourceInfo {
  source: DataSource;
  cachedAt: number | null;
  ageMs: number;
  isLive: boolean;
  isOffline: boolean;
  label: string;
}

export interface WriteSafetyOptions {
  /** If true, the caller is queueing the op for replay — allow it. */
  allowQueued?: boolean;
  /** Human-readable label used in error messages. */
  operationLabel?: string;
  /** If set, the function is allowed even offline because it's locally-side-effect free (e.g. XDR export). */
  localOnly?: boolean;
}

export class OfflineWriteError extends Error {
  readonly code = 'OFFLINE_WRITE_BLOCKED';
  readonly operation: string;
  constructor(operation: string, message?: string) {
    super(
      message ??
        `Cannot perform "${operation}" while offline. Connect to the network and try again, or queue the operation for later replay.`
    );
    this.name = 'OfflineWriteError';
    this.operation = operation;
  }
}

// ─── Network status singleton ────────────────────────────────────────────────

type OnlineListener = (online: boolean) => void;

class NetworkStatus {
  private online: boolean;
  private listeners = new Set<OnlineListener>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastVerifiedAt = 0;
  private readonly VERIFY_INTERVAL_MS = 15_000;

  constructor() {
    this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => this.setOnline(true));
      window.addEventListener('offline', () => this.setOnline(false));
    }
    this.startHeartbeat();
  }

  private setOnline(next: boolean): void {
    const prev = this.online;
    this.online = next;
    this.lastVerifiedAt = Date.now();
    if (prev !== next) {
      this.listeners.forEach((cb) => {
        try {
          cb(next);
        } catch {
          /* swallow listener errors */
        }
      });
    }
  }

  /**
   * Lightweight heartbeat — verify online state using a no-op fetch so that
   * `navigator.onLine` lying (e.g. captive portal) does not mask a real outage.
   */
  private startHeartbeat(): void {
    if (typeof window === 'undefined') return;
    const tick = async (): Promise<void> => {
      if (!this.online) return;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4_000);
        await fetch('/sw.js', { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
        clearTimeout(t);
        this.lastVerifiedAt = Date.now();
      } catch {
        // Treat any network-level failure as offline; browser events will recover us.
        this.setOnline(false);
      }
    };
    this.heartbeatTimer = setInterval(tick, this.VERIFY_INTERVAL_MS);
  }

  isOnline(): boolean {
    return this.online;
  }

  isOffline(): boolean {
    return !this.online;
  }

  /** Epoch ms when we last confirmed connectivity; 0 if never. */
  getLastVerifiedAt(): number {
    return this.lastVerifiedAt;
  }

  subscribe(listener: OnlineListener): () => void {
    this.listeners.add(listener);
    try {
      listener(this.online);
    } catch {
      /* ignore */
    }
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.listeners.clear();
  }
}

export const networkStatus = typeof window !== 'undefined' ? new NetworkStatus() : null;

function safeIsOnline(): boolean {
  return networkStatus
    ? networkStatus.isOnline()
    : typeof navigator !== 'undefined'
      ? navigator.onLine
      : true;
}

export function isOnline(): boolean {
  return safeIsOnline();
}

export function isOffline(): boolean {
  return !safeIsOnline();
}

export function subscribeToConnectivity(listener: OnlineListener): () => void {
  if (!networkStatus) {
    listener(true);
    return () => {};
  }
  return networkStatus.subscribe(listener);
}

// ─── Data source evaluator ───────────────────────────────────────────────────

const DEFAULT_ACCOUNT_TTL_MS = 5 * 60_000; // 5 min — aligned with TTL.ACCOUNT

export interface CachedDataMeta {
  /** Epoch ms when the data was cached/fetched. */
  cachedAt?: number | null;
  /** TTL used when the entry was written. */
  ttlMs?: number;
  /** True when the fetch that produced this value came from a SW cache hit. */
  fromServiceWorkerCache?: boolean;
}

/**
 * Produce a `DataSourceInfo` record for a given cache entry + current network.
 *
 * Invalid / incomplete input degrades to `{ source: 'unknown' }` rather than
 * throwing — callers should always be able to render.
 */
export function evaluateDataSource(
  hasLiveData: boolean,
  meta: CachedDataMeta = {}
): DataSourceInfo {
  const now = Date.now();
  const cachedAt = typeof meta.cachedAt === 'number' ? meta.cachedAt : null;
  const ttlMs = typeof meta.ttlMs === 'number' ? meta.ttlMs : DEFAULT_ACCOUNT_TTL_MS;
  const ageMs = cachedAt ? Math.max(0, now - cachedAt) : 0;

  const offline = isOffline();

  let source: DataSource = 'unknown';

  if (hasLiveData) {
    if (!offline && (!cachedAt || ageMs <= ttlMs) && !meta.fromServiceWorkerCache) {
      source = 'live';
    } else if (offline || meta.fromServiceWorkerCache || ageMs > ttlMs) {
      source = ageMs > ttlMs ? 'cache-stale' : 'cache';
    } else {
      source = 'cache';
    }
  }

  return {
    source,
    cachedAt,
    ageMs,
    isLive: source === 'live',
    isOffline: offline,
    label: dataSourceLabel(source),
  };
}

export function dataSourceLabel(source: DataSource): string {
  switch (source) {
    case 'live':
      return 'Live data';
    case 'cache':
      return 'Cached data';
    case 'cache-stale':
      return 'Stale cached data';
    case 'unknown':
    default:
      return 'Data state unknown';
  }
}

// ─── Write safety gate ───────────────────────────────────────────────────────

/**
 * Central guard for any operation that mutates on-network state.
 *
 * Rules:
 *  - Always allowed if `localOnly: true` (pure client work — e.g. XDR export).
 *  - Always allowed when online.
 *  - Blocked when offline UNLESS `allowQueued: true`, which indicates the
 *    caller will persist the operation in the offline queue for replay.
 *
 * Throws `OfflineWriteError` with a structured message when blocked.
 *
 * Invalid input (non-string label) is normalised rather than thrown — the
 * guard should never itself crash callers.
 */
export function assertWriteSafe(operation: unknown, options: WriteSafetyOptions = {}): void {
  const { localOnly = false, allowQueued = false } = options;
  const label =
    typeof operation === 'string' && operation.trim().length > 0
      ? operation.trim()
      : 'unspecified write operation';

  if (localOnly) return;
  if (safeIsOnline()) return;
  if (allowQueued) return;

  throw new OfflineWriteError(label);
}

/**
 * Non-throwing predicate companion to `assertWriteSafe`.
 */
export function isWriteSafe(operation: unknown, options: WriteSafetyOptions = {}): boolean {
  try {
    assertWriteSafe(operation, options);
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers for cached-vs-live distinction in hooks ──────────────────────────

/**
 * Wrap a fetcher so that, when offline, it either throws a descriptive error
 * (no cached fallback) or lets the caller return cached content instead.
 *
 * Designed to be composed with useCachedData / useStellarSWR — they handle
 * the cache reads; this guard only protects the network write surface.
 */
export async function withOfflineGuard<T>(
  operation: string,
  fetcher: () => Promise<T>,
  options: WriteSafetyOptions = {}
): Promise<T> {
  assertWriteSafe(operation, options);
  return fetcher();
}
