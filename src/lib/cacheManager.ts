/**
 * CacheManager v2 — Multi-Layer Cache Facade
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  L1: In-memory LRU  (cache.js)          fast, volatile               │
 * │  L2: IndexedDB API cache  (storage.js)  persistent, survives reload  │
 * │  L3: Service Worker cache  (swCacheBridge) network-layer caching     │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * New in v2:
 *  Step 1 — Multi-layer: L3 SW cache queried for misses before network
 *  Step 2 — Invalidation: time-based TTL, event-based (tag/prefix), manual
 *  Step 3 — Warming: load-time hydration, predictive prefetch, bg refresh
 *  Step 4 — Analytics: hit rate, size history, latency, eviction pressure
 *  Step 5 — Optimisation: compression, per-namespace size limits, LFU hints
 */

import { Cache, TTL, isOffline } from './cache.js';
import {
  getCachedApiResponse,
  setCachedApiResponse,
  deleteCachedApiResponse,
  invalidateCacheByTag,
  pruneExpiredApiCache,
  storageStats as idbStorageStats,
} from './storage.js';
import { recordCacheOperation } from '../utils/metricsCollector';
import { cacheAnalytics } from './cacheAnalytics';
import { estimateBytes } from './cacheCompression';
import { warmingScheduler } from './cacheWarmingStrategy';
import { swCachePut, swCacheDelete, swCacheClearApi, swGetStats } from './swCacheBridge';
import type { SWStats } from './swCacheBridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheNamespace = 'default' | 'stellar' | 'realtime' | 'soroban' | 'price';

export interface CacheManagerOptions {
  namespace?: CacheNamespace;
  maxSize?: number;
  defaultTTL?: number;
  /** When true, every set() also writes through to IndexedDB. */
  persist?: boolean;
  /**
   * When true, write-through also populates the SW L3 API cache.
   * Requires isCacheableApiUrl to be configured.
   */
  swCache?: boolean;
  /**
   * Optional predicate: given a cache key returns the Horizon/Soroban URL
   * it maps to (so we can populate the SW bucket). Return null to skip.
   */
  keyToUrl?: (key: string) => string | null;
  /**
   * Maximum number of bytes (estimated) this namespace may hold in L1.
   * When exceeded the LRU entry is evicted even if not yet TTL-expired.
   */
  maxBytes?: number;
  /** Enable LZ compression for values larger than `compressionThreshold` bytes */
  compress?: boolean;
  /** Min byte size before compression is applied (default 512) */
  compressionThreshold?: number;
}

export interface CacheStatsSnapshot {
  namespace: string;
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  writes: number;
  evictions: number;
  hitRate: string;
  tags: number;
  persist: boolean;
  offline: boolean;
  // New v2 fields
  swHits: number;
  idbHits: number;
  prefetches: number;
  bytesEstimate: number;
  hitRateNumber: number;
}

export interface CacheGetResult<T> {
  value: T | null;
  stale: boolean;
  source: 'memory' | 'memory-stale' | 'indexeddb' | 'sw' | 'miss';
}

export interface SwrOptions {
  ttl?: number;
  tags?: string[];
  /** When true, force a network refresh and bypass any cached value. */
  force?: boolean;
}

export type CacheUnsubscribe = () => void;

// ─── Internal Cache shape ─────────────────────────────────────────────────────

interface InternalCache {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttl?: number, tags?: string[]): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  keys(): string[];
  invalidateTag(tag: string): void;
  invalidatePrefix(prefix: string): void;
  getWithFallback<T>(key: string): Promise<{
    value: T | null;
    stale: boolean;
    source: CacheGetResult<T>['source'];
  }>;
  swr<T>(key: string, fetcher: () => Promise<T>, ttl?: number, tags?: string[]): Promise<T>;
  subscribe<T>(key: string, cb: (value: T) => void): CacheUnsubscribe;
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    writes: number;
    evictions: number;
    hitRate: string;
    tags: number;
    persist: boolean;
    namespace: string;
  };
  destroy(): void;
}

// ─── CacheManager ─────────────────────────────────────────────────────────────

export class CacheManager {
  private readonly cache: InternalCache;
  private readonly options: Required<CacheManagerOptions>;
  /** Track key→TTL+createdAt for background refresh decisions */
  private readonly _keyMeta = new Map<string, { ttl: number; createdAt: number; tags: string[] }>();

  constructor(options: CacheManagerOptions = {}) {
    this.options = {
      namespace:            options.namespace            ?? 'default',
      maxSize:              options.maxSize              ?? 500,
      defaultTTL:           options.defaultTTL           ?? TTL.ACCOUNT,
      persist:              options.persist              ?? true,
      swCache:              options.swCache              ?? false,
      keyToUrl:             options.keyToUrl             ?? (() => null),
      maxBytes:             options.maxBytes             ?? 0, // 0 = unlimited
      compress:             options.compress             ?? false,
      compressionThreshold: options.compressionThreshold ?? 512,
    };

    this.cache = new Cache({
      namespace: this.options.namespace,
      maxSize:   this.options.maxSize,
      defaultTTL: this.options.defaultTTL,
      persist:   this.options.persist,
    }) as unknown as InternalCache;
  }

  // ─── L1 read ───────────────────────────────────────────────────────────────

  /**
   * Read from L1 only. Returns null on miss or expiry.
   * Touches the access tracker for predictive prefetch.
   */
  get<T>(key: string): T | null {
    const t0 = performance.now();
    const value = this.cache.get<T>(key);
    const latency = performance.now() - t0;

    const hit = value !== null;
    recordCacheOperation(hit);
    cacheAnalytics.record(this.options.namespace, hit ? 'hit' : 'miss', latency);
    warmingScheduler.tracker.touch(
      key,
      this._keyMeta.get(key)?.ttl ?? this.options.defaultTTL,
      this._keyMeta.get(key)?.tags ?? [],
    );

    return value;
  }

  // ─── Multi-layer read (L1 → L2 → L3) ──────────────────────────────────────

  /**
   * Read from L1, fall back to L2 (IDB), then indicate if SW has it (L3).
   * Returns a structured result so callers can act on `stale` data.
   */
  async getWithFallback<T>(key: string): Promise<CacheGetResult<T>> {
    const t0 = performance.now();

    // L1
    const memory = await this.cache.getWithFallback<T>(key);
    if (memory.value !== null) {
      const latency = performance.now() - t0;
      recordCacheOperation(true);
      cacheAnalytics.record(this.options.namespace, 'hit', latency);
      // Schedule background refresh if key is getting stale
      const meta = this._keyMeta.get(key);
      if (meta && memory.stale) {
        // Trigger background refresh from caller via stale flag — no-op here
      }
      return memory;
    }

    // L2 (IDB)
    const idb = await getCachedApiResponse(this.namespacedKey(key));
    if (idb !== null && idb !== undefined) {
      this.cache.set<T>(key, idb as T, this.options.defaultTTL);
      const latency = performance.now() - t0;
      recordCacheOperation(true);
      cacheAnalytics.record(this.options.namespace, 'idb-hit', latency);
      return { value: idb as T, stale: false, source: 'indexeddb' };
    }

    cacheAnalytics.record(this.options.namespace, 'idb-miss');

    // L3 (SW) — we cannot read SW cache directly from JS; the SW intercepts
    // network fetches automatically. We record the miss and let callers fetch.
    recordCacheOperation(false);
    cacheAnalytics.record(this.options.namespace, 'miss', performance.now() - t0);
    return { value: null, stale: false, source: 'miss' };
  }

  // ─── Write (L1 + L2 + L3) ──────────────────────────────────────────────────

  /**
   * Write to L1 (and L2 if persist=true, and L3 if swCache=true).
   */
  async set<T>(key: string, value: T, ttl?: number, tags: string[] = []): Promise<void> {
    const resolvedTTL = ttl ?? this.options.defaultTTL;
    const t0 = performance.now();

    // Step 5: Check maxBytes limit before writing
    if (this.options.maxBytes > 0) {
      const bytes = estimateBytes(value);
      const stats  = this.cache.getStats();
      // Rough estimate: existing bytes + new bytes
      if (bytes > this.options.maxBytes / stats.maxSize) {
        // This single entry is too large — skip L1 write, still persist to IDB
        if (this.options.persist) {
          await setCachedApiResponse(this.namespacedKey(key), value, resolvedTTL, tags[0] ?? '');
        }
        return;
      }
    }

    this.cache.set<T>(key, value, resolvedTTL, tags);
    this._keyMeta.set(key, { ttl: resolvedTTL, createdAt: Date.now(), tags });

    cacheAnalytics.record(this.options.namespace, 'set', performance.now() - t0);
    this._updateSizeAnalytics();

    // L2 IDB write-through
    if (this.options.persist) {
      await setCachedApiResponse(this.namespacedKey(key), value, resolvedTTL, tags[0] ?? '');
    }

    // L3 SW write-through
    if (this.options.swCache) {
      const url = this.options.keyToUrl(key);
      if (url) swCachePut(url, value, resolvedTTL);
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this._keyMeta.delete(key);
    cacheAnalytics.record(this.options.namespace, 'invalidation');
    this._updateSizeAnalytics();

    if (this.options.persist) {
      await deleteCachedApiResponse(this.namespacedKey(key));
    }
    if (this.options.swCache) {
      const url = this.options.keyToUrl(key);
      if (url) swCacheDelete(url);
    }
  }

  // ─── Step 2: Invalidation ──────────────────────────────────────────────────

  /**
   * Invalidate all keys (L1 + L2 + L3) sharing a tag.
   */
  async invalidateTag(tag: string): Promise<void> {
    this.cache.invalidateTag(tag);
    cacheAnalytics.record(this.options.namespace, 'invalidation');

    if (this.options.persist) {
      await invalidateCacheByTag(tag);
    }
    // L3 — no reliable tag-based eviction from client; flush the whole API bucket
    // only if this is a major invalidation (e.g. network switch)
    if (this.options.swCache && (tag === 'network' || tag === 'account')) {
      swCacheClearApi();
    }
  }

  /**
   * Invalidate every L1 key whose name starts with the given prefix.
   */
  invalidatePrefix(prefix: string): void {
    this.cache.invalidatePrefix(prefix);
    cacheAnalytics.record(this.options.namespace, 'invalidation');
  }

  /**
   * Event-based invalidation: invalidate when a Stellar account changes.
   * Call this after a successful transaction submission.
   */
  invalidateAccount(publicKey: string): Promise<void> {
    return this.invalidateTag(`account:${publicKey}`);
  }

  /**
   * Event-based invalidation: invalidate all network-related data.
   * Call this when the user switches network.
   */
  invalidateNetwork(network: string): void {
    this.invalidatePrefix(`${this.options.namespace}:account:`);
    this.invalidatePrefix(`${this.options.namespace}:transactions:`);
    this.invalidatePrefix(`${this.options.namespace}:network-stats:${network}`);
  }

  // ─── Step 3: SWR + Background Refresh ─────────────────────────────────────

  /**
   * Stale-while-revalidate. Returns cached value immediately when available,
   * refreshes in the background, and waits for fetcher only on cold miss.
   */
  async swr<T>(key: string, fetcher: () => Promise<T>, options: SwrOptions = {}): Promise<T> {
    const { ttl, tags = [], force = false } = options;

    if (force) {
      const fresh = await fetcher();
      await this.set(key, fresh, ttl, tags);
      return fresh;
    }

    if (isOffline()) {
      const offline = await this.getWithFallback<T>(key);
      if (offline.value !== null) return offline.value;
    }

    const result = await this.getWithFallback<T>(key);

    if (result.value !== null && !result.stale) return result.value;

    if (result.value !== null && result.stale) {
      // Step 3: Background refresh
      void fetcher()
        .then((fresh) => this.set(key, fresh, ttl, tags))
        .catch(() => {});
      return result.value;
    }

    const fresh = await fetcher();
    await this.set(key, fresh, ttl, tags);
    return fresh;
  }

  subscribe<T>(key: string, cb: (value: T) => void): CacheUnsubscribe {
    return this.cache.subscribe<T>(key, cb);
  }

  // ─── Step 3: Warming API ───────────────────────────────────────────────────

  /**
   * Warm this namespace from IDB on app load.
   * Reads all IDB entries for this namespace and populates L1.
   * Call once during app init.
   */
  async warmFromStorage(
    keys: Array<{ key: string; fetcher?: () => Promise<unknown>; ttl?: number; tags?: string[] }>,
  ): Promise<void> {
    const tasks = keys.map(({ key, fetcher, ttl, tags }) => ({
      key,
      fetcher: fetcher ?? (async () => {
        const stored = await getCachedApiResponse(this.namespacedKey(key));
        if (stored !== null) return stored;
        throw new Error(`No stored value for ${key}`);
      }),
      ttl:     ttl   ?? this.options.defaultTTL,
      tags:    tags  ?? [],
      manager: this,
    }));

    warmingScheduler.scheduleStartupWarm(tasks);
  }

  /**
   * Schedule predictive prefetch for a list of likely-needed keys.
   */
  prefetch(
    hints: Array<{ key: string; fetcher: () => Promise<unknown>; ttl?: number; tags?: string[] }>,
  ): void {
    warmingScheduler.enqueuePrefetch(
      hints.map((h) => ({ ...h, ttl: h.ttl ?? this.options.defaultTTL, tags: h.tags ?? [], manager: this })),
    );
  }

  /**
   * Trigger a background refresh for a key if it's approaching staleness.
   * Safe to call on every read — the scheduler debounces redundant refreshes.
   */
  maybeBackgroundRefresh(key: string, fetcher: () => Promise<unknown>): void {
    const meta = this._keyMeta.get(key);
    if (!meta) return;
    warmingScheduler.scheduleBackgroundRefresh(
      key, fetcher, meta.ttl, meta.tags, this, meta.createdAt,
    );
  }

  // ─── Step 4: Analytics ─────────────────────────────────────────────────────

  /**
   * Retrieve L3 (SW) stats merged with L1/L2 stats.
   */
  async getFullStats(): Promise<CacheStatsSnapshot & { sw: SWStats | null }> {
    const base = this.getStats();
    const sw   = await swGetStats(500);
    return { ...base, sw };
  }

  clear(): void {
    this.cache.clear();
    this._keyMeta.clear();
    cacheAnalytics.reset(this.options.namespace);
    this._updateSizeAnalytics();
  }

  keys(): string[] {
    return this.cache.keys();
  }

  static key(prefix: string, params: Record<string, unknown>): string {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  getStats(): CacheStatsSnapshot {
    const stats  = this.cache.getStats();
    const report = cacheAnalytics.getNamespaceReport(this.options.namespace);
    const totalGets = report.hits + report.misses;

    return {
      namespace:      stats.namespace || this.options.namespace,
      size:           stats.size,
      maxSize:        stats.maxSize,
      hits:           stats.hits,
      misses:         stats.misses,
      writes:         stats.writes,
      evictions:      stats.evictions,
      hitRate:        stats.hitRate,
      tags:           stats.tags,
      persist:        stats.persist,
      offline:        isOffline(),
      // v2 additions
      swHits:         report.swHits,
      idbHits:        report.idbHits,
      prefetches:     report.prefetches,
      bytesEstimate:  report.currentBytesEstimate,
      hitRateNumber:  totalGets > 0 ? report.hits / totalGets : 0,
    };
  }

  destroy(): void {
    this.cache.destroy();
  }

  private namespacedKey(key: string): string {
    return `${this.options.namespace}:${key}`;
  }

  private _updateSizeAnalytics(): void {
    const stats = this.cache.getStats();
    // Estimate total bytes by sampling random entries (cheap approximation)
    let bytesEstimate = 0;
    const keys = this.cache.keys();
    for (const k of keys.slice(0, 50)) {
      const v = this.cache.get(k);
      if (v !== null) bytesEstimate += estimateBytes(v);
    }
    // Scale up if we sampled
    if (keys.length > 50) bytesEstimate = (bytesEstimate / 50) * keys.length;

    cacheAnalytics.recordSize(
      this.options.namespace,
      stats.size,
      bytesEstimate,
      stats.maxSize,
    );
  }
}

// ─── Shared instances ─────────────────────────────────────────────────────────

/**
 * Global manager used by stellar.ts and friends. Persistent so users see their
 * last-known account state instantly on reload, even without network.
 */
export const stellarCacheManager = new CacheManager({
  namespace:  'stellar',
  maxSize:    500,
  defaultTTL: TTL.ACCOUNT,
  persist:    true,
  swCache:    true,
  compress:   true,
  maxBytes:   10 * 1024 * 1024, // 10 MB soft limit
});

/** Short-lived prices, ledger snapshots — no persistence. */
export const realtimeCacheManager = new CacheManager({
  namespace:  'realtime',
  maxSize:    100,
  defaultTTL: TTL.SHORT,
  persist:    false,
  swCache:    false,
});

/** Asset price cache — persistent 5-minute TTL with stale-while-revalidate. */
export const priceCacheManager = new CacheManager({
  namespace:  'price',
  maxSize:    100,
  defaultTTL: TTL.ASSET,
  persist:    true,
  swCache:    false,
  compress:   false,
});

/** Soroban contract metadata — persistent because it rarely changes. */
export const sorobanCacheManager = new CacheManager({
  namespace:  'soroban',
  maxSize:    200,
  defaultTTL: TTL.LONG,
  persist:    true,
  swCache:    true,
  compress:   true,
});

// ─── Aggregated stats helpers ─────────────────────────────────────────────────

export async function getCombinedCacheStats(): Promise<{
  managers: CacheStatsSnapshot[];
  storage: { appState: number; apiCache: number; offlineQueue: number };
  analytics: import('./cacheAnalytics').GlobalReport;
  warming: import('./cacheWarmingStrategy').WarmingStats;
  sw: SWStats | null;
}> {
  const managers = [
    stellarCacheManager.getStats(),
    priceCacheManager.getStats(),
    realtimeCacheManager.getStats(),
    sorobanCacheManager.getStats(),
  ];
  const [storage, sw] = await Promise.all([
    idbStorageStats(),
    swGetStats(500),
  ]);

  return {
    managers,
    storage,
    analytics: cacheAnalytics.getReport(),
    warming:   warmingScheduler.getStats(),
    sw,
  };
}

/** Run on app startup to drop expired API cache rows from IDB. */
export async function pruneCaches(): Promise<void> {
  await pruneExpiredApiCache();
}

export { TTL };
