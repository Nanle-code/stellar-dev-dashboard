/**
 * Intelligent Caching System
 *
 * Layers:
 *   L1 — in-memory LRU with TTL (fast, volatile)
 *   L2 — IndexedDB via storage.js (persistent, survives reload)
 *
 * Features:
 *   - Stale-while-revalidate: serve stale data immediately, refresh in background
 *   - Tag-based invalidation: invalidate groups of keys by tag
 *   - Per-key TTL overrides
 *   - Offline detection: skip network when offline, extend stale window
 *   - Cache statistics per namespace
 *   - Subscriber notifications on key updates
 */

import { getStoredValue, setStoredValue, removeStoredValue } from './storage.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TTL = {
  ACCOUNT:      60_000,       // 1 min
  TRANSACTIONS: 30_000,       // 30 s
  OPERATIONS:   30_000,       // 30 s
  LEDGER:        5_000,       // 5 s
  ASSET:       300_000,       // 5 min
  NETWORK:   3_600_000,       // 1 hr
  PRICE:        30_000,       // 30 s
  POOL:         60_000,       // 1 min
  POOL_DETAIL:  30_000,       // 30 s
  LONG:      3_600_000,       // 1 hr
  SHORT:        10_000,       // 10 s
};

// How long stale data is still served while a background refresh runs
const STALE_WINDOW_ONLINE  = 5_000;   // 5 s
const STALE_WINDOW_OFFLINE = 300_000; // 5 min — be generous when offline

// ─── LRU Node ─────────────────────────────────────────────────────────────────

class LRUNode {
  constructor(key, value, expiresAt, tags = []) {
    this.key       = key;
    this.value     = value;
    this.expiresAt = expiresAt;
    this.createdAt = Date.now();
    this.accessedAt = Date.now();
    this.tags      = tags;
    this.prev      = null;
    this.next      = null;
  }
}

// ─── Cache Class ──────────────────────────────────────────────────────────────

export class Cache {
  /**
   * @param {object} opts
   * @param {number} opts.maxSize       Max in-memory entries (LRU eviction)
   * @param {number} opts.defaultTTL    Default TTL in ms
   * @param {boolean} opts.persist      Whether to write through to IndexedDB
   * @param {string}  opts.namespace    Prefix for all keys (useful for isolation)
   */
  constructor(opts = {}) {
    this.maxSize    = opts.maxSize    ?? 500;
    this.defaultTTL = opts.defaultTTL ?? TTL.ACCOUNT;
    this.persist    = opts.persist    ?? false;
    this.namespace  = opts.namespace  ?? '';

    // Doubly-linked list for LRU ordering
    this._head = new LRUNode('__head__', null, Infinity); // most-recent sentinel
    this._tail = new LRUNode('__tail__', null, Infinity); // least-recent sentinel
    this._head.next = this._tail;
    this._tail.prev = this._head;

    this._map  = new Map();   // key → LRUNode
    this._tags = new Map();   // tag → Set<key>

    // Stats
    this._hits   = 0;
    this._misses = 0;
    this._writes = 0;
    this._evictions = 0;

    // Subscribers: key → Set<callback>
    this._subscribers = new Map();

    // Periodic cleanup every 2 minutes
    this._cleanupTimer = setInterval(() => this._cleanup(), 120_000);
  }

  // ─── Key helpers ────────────────────────────────────────────────────────────

  _ns(key) {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  /**
   * Build a deterministic cache key from a prefix + params object.
   */
  generateKey(prefix, params) {
    return this._ns(`${prefix}:${JSON.stringify(params)}`);
  }

  // ─── LRU list helpers ────────────────────────────────────────────────────────

  _detach(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _insertAfterHead(node) {
    node.prev = this._head;
    node.next = this._head.next;
    this._head.next.prev = node;
    this._head.next = node;
  }

  _moveToFront(node) {
    this._detach(node);
    this._insertAfterHead(node);
  }

  _evictLRU() {
    const lru = this._tail.prev;
    if (lru === this._head) return;
    this._detach(lru);
    this._map.delete(lru.key);
    this._removeTags(lru);
    this._evictions++;
  }

  _removeTags(node) {
    for (const tag of node.tags) {
      const set = this._tags.get(tag);
      if (set) {
        set.delete(node.key);
        if (set.size === 0) this._tags.delete(tag);
      }
    }
  }

  // ─── Core API ────────────────────────────────────────────────────────────────

  /**
   * Write a value to L1 (and optionally L2).
   * @param {string}   key
   * @param {*}        value
   * @param {number}   [ttl]   Override TTL in ms
   * @param {string[]} [tags]  Tag names for group invalidation
   */
  set(key, value, ttl, tags = []) {
    const resolvedTTL = ttl ?? this.defaultTTL;
    const expiresAt   = Date.now() + resolvedTTL;

    if (this._map.has(key)) {
      const node = this._map.get(key);
      node.value      = value;
      node.expiresAt  = expiresAt;
      node.accessedAt = Date.now();
      node.tags       = tags;
      this._moveToFront(node);
    } else {
      if (this._map.size >= this.maxSize) this._evictLRU();
      const node = new LRUNode(key, value, expiresAt, tags);
      this._map.set(key, node);
      this._insertAfterHead(node);
    }

    // Register tags
    for (const tag of tags) {
      if (!this._tags.has(tag)) this._tags.set(tag, new Set());
      this._tags.get(tag).add(key);
    }

    this._writes++;
    this._notify(key, value);

    // Write-through to IndexedDB
    if (this.persist) {
      setStoredValue(key, { value, expiresAt, tags }).catch(() => {});
    }
  }

  /**
   * Read from L1. Returns null on miss or expiry.
   */
  get(key) {
    const node = this._map.get(key);
    if (!node) { this._misses++; return null; }

    if (Date.now() > node.expiresAt) {
      this._evictNode(node);
      this._misses++;
      return null;
    }

    node.accessedAt = Date.now();
    this._moveToFront(node);
    this._hits++;
    return node.value;
  }

  /**
   * Read from L1, and if missing try L2 (IndexedDB).
   * Returns { value, stale } where stale=true means the entry is expired
   * but still returned (stale-while-revalidate).
   */
  async getWithFallback(key) {
    const node = this._map.get(key);
    const now  = Date.now();

    if (node) {
      node.accessedAt = now;
      this._moveToFront(node);
      if (now <= node.expiresAt) {
        this._hits++;
        return { value: node.value, stale: false, source: 'memory' };
      }
      // Stale — still return it
      const staleWindow = isOffline() ? STALE_WINDOW_OFFLINE : STALE_WINDOW_ONLINE;
      if (now <= node.expiresAt + staleWindow) {
        this._hits++;
        return { value: node.value, stale: true, source: 'memory-stale' };
      }
    }

    // Try IndexedDB
    if (this.persist) {
      try {
        const stored = await getStoredValue(key);
        if (stored && stored.value !== undefined) {
          const stale = now > stored.expiresAt;
          if (!stale || (now <= stored.expiresAt + STALE_WINDOW_OFFLINE)) {
            // Warm L1
            this.set(key, stored.value, stored.expiresAt - now, stored.tags || []);
            this._misses++;
            return { value: stored.value, stale, source: 'indexeddb' };
          }
        }
      } catch { /* ignore */ }
    }

    this._misses++;
    return { value: null, stale: false, source: 'miss' };
  }

  /**
   * Check existence without updating access order.
   */
  has(key) {
    const node = this._map.get(key);
    if (!node) return false;
    if (Date.now() > node.expiresAt) { this._evictNode(node); return false; }
    return true;
  }

  /**
   * Delete a single key from L1 and L2.
   */
  delete(key) {
    const node = this._map.get(key);
    if (node) this._evictNode(node);
    if (this.persist) removeStoredValue(key).catch(() => {});
  }

  /**
   * Invalidate all keys that carry a given tag.
   */
  invalidateTag(tag) {
    const keys = this._tags.get(tag);
    if (!keys) return;
    for (const key of [...keys]) this.delete(key);
  }

  /**
   * Invalidate all keys whose key string starts with prefix.
   */
  invalidatePrefix(prefix) {
    for (const key of [...this._map.keys()]) {
      if (key.startsWith(prefix)) this.delete(key);
    }
  }

  /**
   * Clear everything.
   */
  clear() {
    this._map.clear();
    this._tags.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
    this._hits = this._misses = this._writes = this._evictions = 0;
  }

  // ─── Stale-while-revalidate helper ──────────────────────────────────────────

  /**
   * Serve cached data immediately (even if stale), then revalidate in background.
   *
   * @param {string}   key
   * @param {Function} fetcher   async () => freshValue
   * @param {number}   [ttl]
   * @param {string[]} [tags]
   * @returns {Promise<*>}  Resolves with cached value immediately if available,
   *                        otherwise waits for fetcher.
   */
  async swr(key, fetcher, ttl, tags = []) {
    const { value, stale, source } = await this.getWithFallback(key);

    if (value !== null && !stale) return value;

    if (value !== null && stale) {
      // Return stale immediately, refresh in background
      fetcher()
        .then((fresh) => this.set(key, fresh, ttl, tags))
        .catch(() => {});
      return value;
    }

    // Cache miss — must wait
    const fresh = await fetcher();
    this.set(key, fresh, ttl, tags);
    return fresh;
  }

  // ─── Subscriptions ───────────────────────────────────────────────────────────

  /**
   * Subscribe to updates for a key.
   * @param {string}   key
   * @param {Function} cb  (value) => void
   * @returns {Function} unsubscribe
   */
  subscribe(key, cb) {
    if (!this._subscribers.has(key)) this._subscribers.set(key, new Set());
    this._subscribers.get(key).add(cb);
    return () => this._subscribers.get(key)?.delete(cb);
  }

  _notify(key, value) {
    const subs = this._subscribers.get(key);
    if (subs) for (const cb of subs) { try { cb(value); } catch { /* ignore */ } }
  }

  // ─── Stats ───────────────────────────────────────────────────────────────────

  getStats() {
    const total   = this._hits + this._misses;
    const hitRate = total > 0 ? ((this._hits / total) * 100).toFixed(1) : '0.0';
    return {
      size:       this._map.size,
      maxSize:    this.maxSize,
      hits:       this._hits,
      misses:     this._misses,
      writes:     this._writes,
      evictions:  this._evictions,
      hitRate:    `${hitRate}%`,
      tags:       this._tags.size,
      persist:    this.persist,
      namespace:  this.namespace,
    };
  }

  keys() { return [...this._map.keys()]; }

  // ─── Internal ────────────────────────────────────────────────────────────────

  _evictNode(node) {
    this._detach(node);
    this._map.delete(node.key);
    this._removeTags(node);
  }

  _cleanup() {
    const now = Date.now();
    for (const [, node] of this._map) {
      if (now > node.expiresAt) this._evictNode(node);
    }
  }

  destroy() {
    clearInterval(this._cleanupTimer);
    this.clear();
  }
}

// ─── Offline detection ────────────────────────────────────────────────────────

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// ─── Named cache instances ────────────────────────────────────────────────────

/** Default in-memory cache used by stellar.js and dex.js */
const cache = new Cache({ maxSize: 500, defaultTTL: TTL.ACCOUNT });

/** Persistent cache for account data — survives page reload */
export const persistentCache = new Cache({
  maxSize: 200,
  defaultTTL: TTL.ACCOUNT,
  persist: true,
  namespace: 'stellar',
});

/** Short-lived cache for real-time data (prices, ledger) */
export const realtimeCache = new Cache({
  maxSize: 100,
  defaultTTL: TTL.SHORT,
  namespace: 'rt',
});

export default cache;
export { Cache as default_Cache };
