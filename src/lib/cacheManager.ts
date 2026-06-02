/**
 * CacheManager — typed, two-layer cache facade.
 *
 *   L1: in-memory LRU (cache.js)        — fast, volatile
 *   L2: IndexedDB API cache (storage.js) — persistent, survives reload
 *
 * Wraps the existing JS cache primitives in a strict TypeScript surface and
 * routes reads through L1 → L2, with stale-while-revalidate, tag-based
 * invalidation, and offline awareness.
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheNamespace = 'default' | 'stellar' | 'realtime' | 'soroban' | 'price';

export interface CacheManagerOptions {
  namespace?: CacheNamespace;
  maxSize?: number;
  defaultTTL?: number;
  /** When true, every set() also writes through to IndexedDB. */
  persist?: boolean;
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
}

export interface CacheGetResult<T> {
  value: T | null;
  stale: boolean;
  source: 'memory' | 'memory-stale' | 'indexeddb' | 'miss';
}

export interface SwrOptions {
  ttl?: number;
  tags?: string[];
  /** When true, force a network refresh and bypass any cached value. */
  force?: boolean;
}

export type CacheUnsubscribe = () => void;

// ─── Internal Cache shape (only what we use, kept loose since cache.js is JS) ─

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

  constructor(options: CacheManagerOptions = {}) {
    this.options = {
      namespace: options.namespace ?? 'default',
      maxSize: options.maxSize ?? 500,
      defaultTTL: options.defaultTTL ?? TTL.ACCOUNT,
      persist: options.persist ?? true,
    };

    this.cache = new Cache({
      namespace: this.options.namespace,
      maxSize: this.options.maxSize,
      defaultTTL: this.options.defaultTTL,
      persist: this.options.persist,
    }) as unknown as InternalCache;
  }

  /**
   * Read from L1 only. Returns null on miss or expiry.
   */
  get<T>(key: string): T | null {
    return this.cache.get<T>(key);
  }

  /**
   * Read from L1 and, on miss, fall back to L2 (IndexedDB API cache).
   * Returns a structured result so callers can act on `stale` data.
   */
  async getWithFallback<T>(key: string): Promise<CacheGetResult<T>> {
    const memory = await this.cache.getWithFallback<T>(key);
    if (memory.value !== null) return memory;

    const idb = await getCachedApiResponse(this.namespacedKey(key));
    if (idb !== null && idb !== undefined) {
      // Warm L1 with the value pulled from IDB.
      this.cache.set<T>(key, idb as T, this.options.defaultTTL);
      return { value: idb as T, stale: false, source: 'indexeddb' };
    }

    return { value: null, stale: false, source: 'miss' };
  }

  /**
   * Write to L1 (and L2 if persist=true).
   */
  async set<T>(key: string, value: T, ttl?: number, tags: string[] = []): Promise<void> {
    const resolvedTTL = ttl ?? this.options.defaultTTL;
    this.cache.set<T>(key, value, resolvedTTL, tags);

    if (this.options.persist) {
      await setCachedApiResponse(this.namespacedKey(key), value, resolvedTTL, tags[0] ?? '');
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    if (this.options.persist) {
      await deleteCachedApiResponse(this.namespacedKey(key));
    }
  }

  /**
   * Invalidate all keys (memory + IDB) sharing a tag.
   */
  async invalidateTag(tag: string): Promise<void> {
    this.cache.invalidateTag(tag);
    if (this.options.persist) {
      await invalidateCacheByTag(tag);
    }
  }

  /**
   * Invalidate every L1 key whose name starts with the given prefix.
   * IDB pruning by prefix is not supported — use tags for IDB invalidation.
   */
  invalidatePrefix(prefix: string): void {
    this.cache.invalidatePrefix(prefix);
  }

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
      // When offline, return whatever we have (even stale) without calling fetcher.
      const offline = await this.getWithFallback<T>(key);
      if (offline.value !== null) return offline.value;
    }

    const result = await this.getWithFallback<T>(key);

    if (result.value !== null && !result.stale) return result.value;

    if (result.value !== null && result.stale) {
      // Revalidate in background; swallow errors so a transient fetch failure
      // doesn't crash callers that already have stale data.
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

  /** Drop everything in L1. Call separately for L2 if needed. */
  clear(): void {
    this.cache.clear();
  }

  keys(): string[] {
    return this.cache.keys();
  }

  /** Build a deterministic key from prefix + params object. */
  static key(prefix: string, params: Record<string, unknown>): string {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  getStats(): CacheStatsSnapshot {
    const stats = this.cache.getStats();
    return {
      namespace: stats.namespace || this.options.namespace,
      size: stats.size,
      maxSize: stats.maxSize,
      hits: stats.hits,
      misses: stats.misses,
      writes: stats.writes,
      evictions: stats.evictions,
      hitRate: stats.hitRate,
      tags: stats.tags,
      persist: stats.persist,
      offline: isOffline(),
    };
  }

  destroy(): void {
    this.cache.destroy();
  }

  private namespacedKey(key: string): string {
    return `${this.options.namespace}:${key}`;
  }
}

// ─── Shared instances ─────────────────────────────────────────────────────────

/**
 * Global manager used by stellar.ts and friends. Persistent so users see their
 * last-known account state instantly on reload, even without network.
 */
export const stellarCacheManager = new CacheManager({
  namespace: 'stellar',
  maxSize: 500,
  defaultTTL: TTL.ACCOUNT,
  persist: true,
});

/** Short-lived prices, ledger snapshots — no persistence. */
export const realtimeCacheManager = new CacheManager({
  namespace: 'realtime',
  maxSize: 100,
  defaultTTL: TTL.SHORT,
  persist: false,
});
/** Asset price cache — persistent 5-minute TTL with stale-while-revalidate. */
export const priceCacheManager = new CacheManager({
  namespace: 'price',
  maxSize: 100,
  defaultTTL: TTL.ASSET,
  persist: true,
});

/** Soroban contract metadata — persistent because it rarely changes. */
export const sorobanCacheManager = new CacheManager({
  namespace: 'soroban',
  maxSize: 200,
  defaultTTL: TTL.LONG,
  persist: true,
});

// ─── Aggregated stats helpers ────────────────────────────────────────────────

export async function getCombinedCacheStats(): Promise<{
  managers: CacheStatsSnapshot[];
  storage: { appState: number; apiCache: number; offlineQueue: number };
}> {
  const managers = [
    stellarCacheManager.getStats(),
    priceCacheManager.getStats(),
    realtimeCacheManager.getStats(),
    sorobanCacheManager.getStats(),
  ];
  const storage = await idbStorageStats();
  return { managers, storage };
}

/** Run on app startup to drop expired API cache rows from IDB. */
export async function pruneCaches(): Promise<void> {
  await pruneExpiredApiCache();
}

export { TTL };
