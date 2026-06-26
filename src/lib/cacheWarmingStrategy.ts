/**
 * Cache Warming & Predictive Prefetching
 *
 * Handles three warming scenarios:
 *   1. App-load warming  — hydrate L1 from IDB on first render
 *   2. Predictive prefetch — queue likely-needed keys based on user context
 *   3. Background refresh — stale-while-revalidate for high-priority keys
 *
 * Architecture:
 *  - WarmingScheduler  : orchestrates all warming tasks, rate-limits to avoid
 *                        blocking the main thread on startup
 *  - PrefetchQueue     : priority min-heap for pending prefetch work
 *  - AccessTracker     : records key access frequency to drive prediction
 */

import { TTL } from './cache.js';
import type { CacheManager } from './cacheManager';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WarmingTask {
  /** Unique cache key */
  key: string;
  /** Async function that returns the fresh value */
  fetcher: () => Promise<unknown>;
  /** TTL in ms */
  ttl?: number;
  /** Tag list for invalidation */
  tags?: string[];
  /** Higher = runs first (default 0) */
  priority?: number;
  /** Target namespace manager */
  manager: CacheManager;
}

export interface PrefetchHint {
  key: string;
  fetcher: () => Promise<unknown>;
  ttl?: number;
  tags?: string[];
  priority?: number;
  manager: CacheManager;
}

export interface WarmingStats {
  warmed: number;
  skipped: number;
  failed: number;
  prefetched: number;
  backgroundRefreshes: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max concurrent warm/prefetch fetchers at startup */
const STARTUP_CONCURRENCY = 3;

/** Delay between startup tasks to avoid blocking first paint (ms) */
const STARTUP_TASK_DELAY_MS = 150;

/** How stale a key must be (ratio: age/TTL) to trigger background refresh */
const BACKGROUND_REFRESH_STALENESS = 0.8;

/** Rolling window for access frequency tracking */
const ACCESS_WINDOW_MS = 5 * 60_000; // 5 min

/** Minimum access count to qualify for predictive prefetch */
const MIN_PREFETCH_ACCESSES = 3;

// ─── Access Tracker ───────────────────────────────────────────────────────────

interface AccessRecord {
  timestamps: number[];
  lastTTL: number;
  tags: string[];
}

class AccessTracker {
  private readonly _records = new Map<string, AccessRecord>();

  /**
   * Record that `key` was accessed. Call this on every cache read.
   */
  touch(key: string, ttl = TTL.ACCOUNT, tags: string[] = []): void {
    const now = Date.now();
    if (!this._records.has(key)) {
      this._records.set(key, { timestamps: [], lastTTL: ttl, tags });
    }
    const rec = this._records.get(key)!;
    rec.timestamps.push(now);
    rec.lastTTL = ttl;
    rec.tags = tags;

    // Prune old timestamps outside the rolling window
    const cutoff = now - ACCESS_WINDOW_MS;
    rec.timestamps = rec.timestamps.filter((t) => t >= cutoff);
  }

  /**
   * Returns keys whose access frequency exceeds MIN_PREFETCH_ACCESSES
   * within the tracking window, sorted by frequency descending.
   */
  getHotKeys(): Array<{ key: string; count: number; ttl: number; tags: string[] }> {
    const now = Date.now();
    const cutoff = now - ACCESS_WINDOW_MS;
    const result: Array<{ key: string; count: number; ttl: number; tags: string[] }> = [];

    for (const [key, rec] of this._records) {
      const recent = rec.timestamps.filter((t) => t >= cutoff);
      if (recent.length >= MIN_PREFETCH_ACCESSES) {
        result.push({ key, count: recent.length, ttl: rec.lastTTL, tags: rec.tags });
      }
    }

    return result.sort((a, b) => b.count - a.count);
  }

  clear(): void {
    this._records.clear();
  }
}

// ─── Priority Queue (min-heap by -priority) ───────────────────────────────────

class PriorityQueue<T extends { priority: number }> {
  private _heap: T[] = [];

  push(item: T): void {
    this._heap.push(item);
    this._bubbleUp(this._heap.length - 1);
  }

  pop(): T | undefined {
    if (!this._heap.length) return undefined;
    const top = this._heap[0];
    const last = this._heap.pop()!;
    if (this._heap.length) {
      this._heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  get size(): number { return this._heap.length; }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._heap[parent].priority >= this._heap[i].priority) break;
      [this._heap[parent], this._heap[i]] = [this._heap[i], this._heap[parent]];
      i = parent;
    }
  }

  private _siftDown(i: number): void {
    const n = this._heap.length;
    while (true) {
      let largest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this._heap[l].priority > this._heap[largest].priority) largest = l;
      if (r < n && this._heap[r].priority > this._heap[largest].priority) largest = r;
      if (largest === i) break;
      [this._heap[largest], this._heap[i]] = [this._heap[i], this._heap[largest]];
      i = largest;
    }
  }
}

// ─── Warming Scheduler ────────────────────────────────────────────────────────

class WarmingScheduler {
  private readonly _queue = new PriorityQueue<WarmingTask & { priority: number }>();
  private readonly _accessTracker = new AccessTracker();
  private _running = false;
  private readonly _stats: WarmingStats = {
    warmed: 0, skipped: 0, failed: 0, prefetched: 0, backgroundRefreshes: 0,
  };

  /** Expose the access tracker so CacheManager can feed it */
  readonly tracker = this._accessTracker;

  // ─── Startup warming ─────────────────────────────────────────────────────

  /**
   * Schedule a batch of tasks to warm on app load.
   * Tasks are processed concurrently up to STARTUP_CONCURRENCY.
   */
  scheduleStartupWarm(tasks: WarmingTask[]): void {
    for (const task of tasks) {
      this._queue.push({ ...task, priority: task.priority ?? 0 });
    }
    if (!this._running) this._drain();
  }

  // ─── Predictive prefetching ───────────────────────────────────────────────

  /**
   * Suggest future keys to prefetch. The scheduler will load any keys not
   * currently fresh in L1.
   */
  enqueuePrefetch(hints: PrefetchHint[]): void {
    for (const hint of hints) {
      // Skip if already in L1
      const cached = hint.manager.get(hint.key);
      if (cached !== null) { this._stats.skipped++; continue; }

      this._queue.push({
        ...hint,
        priority: (hint.priority ?? 0) - 100, // lower than startup tasks
      });
    }
    if (!this._running) this._drain();
  }

  // ─── Background refresh ───────────────────────────────────────────────────

  /**
   * Trigger background refresh for a key that is about to go stale.
   * Only fires if the entry exists but is older than BACKGROUND_REFRESH_STALENESS * TTL.
   */
  scheduleBackgroundRefresh(
    key: string,
    fetcher: () => Promise<unknown>,
    ttl: number,
    tags: string[],
    manager: CacheManager,
    createdAt: number,
  ): void {
    const age = Date.now() - createdAt;
    if (age < ttl * BACKGROUND_REFRESH_STALENESS) return;

    this._queue.push({
      key, fetcher, ttl, tags, manager,
      priority: -50, // lower priority than user-driven prefetch
    });
    if (!this._running) this._drain();
  }

  // ─── Auto-prefetch based on hot keys ─────────────────────────────────────

  /**
   * Call this periodically (e.g. every 30 s) to auto-prefetch hot keys.
   * You must provide a `managerResolver` that maps a key to its CacheManager
   * and a fetcher factory.
   */
  autoPrefetchHotKeys(
    resolve: (key: string) => { manager: CacheManager; fetcher: () => Promise<unknown>; ttl?: number; tags?: string[] } | null,
  ): void {
    const hotKeys = this._accessTracker.getHotKeys();
    for (const { key, ttl, tags } of hotKeys) {
      const resolved = resolve(key);
      if (!resolved) continue;
      const cached = resolved.manager.get(key);
      if (cached !== null) continue; // already warm
      this._queue.push({
        key,
        fetcher: resolved.fetcher,
        ttl: resolved.ttl ?? ttl,
        tags: resolved.tags ?? tags,
        manager: resolved.manager,
        priority: -20,
      });
    }
    if (!this._running) this._drain();
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  getStats(): Readonly<WarmingStats> {
    return { ...this._stats };
  }

  resetStats(): void {
    Object.assign(this._stats, { warmed: 0, skipped: 0, failed: 0, prefetched: 0, backgroundRefreshes: 0 });
  }

  // ─── Internal drain loop ──────────────────────────────────────────────────

  private _drain(): void {
    if (this._running || this._queue.size === 0) return;
    this._running = true;
    this._processNext();
  }

  private _processNext(): void {
    if (this._queue.size === 0) {
      this._running = false;
      return;
    }

    const batch: Array<Promise<void>> = [];

    for (let i = 0; i < STARTUP_CONCURRENCY && this._queue.size > 0; i++) {
      const task = this._queue.pop()!;
      batch.push(this._run(task));
    }

    Promise.all(batch).then(() => {
      if (this._queue.size > 0) {
        setTimeout(() => this._processNext(), STARTUP_TASK_DELAY_MS);
      } else {
        this._running = false;
      }
    });
  }

  private async _run(task: WarmingTask): Promise<void> {
    try {
      // Skip if already warm in L1
      const existing = task.manager.get(task.key);
      if (existing !== null) { this._stats.skipped++; return; }

      const value = await task.fetcher();
      await task.manager.set(task.key, value, task.ttl, task.tags ?? []);
      this._stats.warmed++;
    } catch {
      this._stats.failed++;
      // Warming failures are non-fatal — log quietly
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const warmingScheduler = new WarmingScheduler();
export { AccessTracker };
export default warmingScheduler;
