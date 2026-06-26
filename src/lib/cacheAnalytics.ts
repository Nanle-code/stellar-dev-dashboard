/**
 * Cache Analytics Engine
 *
 * Collects and exposes real-time cache performance data:
 *   - Hit rate per namespace and globally
 *   - Cache size over time (ring buffer of snapshots)
 *   - Per-operation latency histograms (get / set / IDB read)
 *   - Memory footprint estimates (byte counts)
 *   - Eviction pressure by namespace
 *   - Subscriber pattern for reactive UI updates
 *
 * Usage:
 *   cacheAnalytics.record('stellar', 'hit', 1.2);
 *   cacheAnalytics.recordSize('stellar', 42, 90_000);
 *   const report = cacheAnalytics.getReport('stellar');
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CacheEventType =
  | 'hit'
  | 'miss'
  | 'set'
  | 'eviction'
  | 'invalidation'
  | 'prefetch'
  | 'sw-hit'
  | 'sw-miss'
  | 'idb-hit'
  | 'idb-miss';

export interface LatencyBucket {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  count: number;
}

export interface SizeSnapshot {
  timestamp: number;
  entries: number;
  bytesEstimate: number;
}

export interface NamespaceReport {
  namespace: string;
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  invalidations: number;
  prefetches: number;
  swHits: number;
  idbHits: number;
  hitRate: number;    // 0–1
  swHitRate: number;  // 0–1
  idbHitRate: number; // 0–1
  getLatency: LatencyBucket;
  setLatency: LatencyBucket;
  sizeHistory: SizeSnapshot[];
  currentEntries: number;
  currentBytesEstimate: number;
  evictionPressure: number; // evictions / max size (0–1)
}

export interface GlobalReport {
  totalHits: number;
  totalMisses: number;
  totalHitRate: number;
  namespaces: NamespaceReport[];
  snapshotTime: number;
}

// ─── Internal structures ──────────────────────────────────────────────────────

const MAX_LATENCY_SAMPLES = 200;
const MAX_SIZE_HISTORY    = 60; // 60 snapshots (5-min window at 5s interval)

interface NSCounters {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  invalidations: number;
  prefetches: number;
  swHits: number;
  swMisses: number;
  idbHits: number;
  idbMisses: number;
  getLatencies: number[];
  setLatencies: number[];
  sizeHistory: SizeSnapshot[];
  currentEntries: number;
  currentBytes: number;
  maxSize: number;
}

function emptyNS(maxSize = 500): NSCounters {
  return {
    hits: 0, misses: 0, sets: 0, evictions: 0, invalidations: 0,
    prefetches: 0, swHits: 0, swMisses: 0, idbHits: 0, idbMisses: 0,
    getLatencies: [], setLatencies: [],
    sizeHistory: [], currentEntries: 0, currentBytes: 0, maxSize,
  };
}

// ─── Percentile helper ────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function latencyBucket(samples: number[]): LatencyBucket {
  if (!samples.length) return { p50: 0, p95: 0, p99: 0, mean: 0, count: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    mean: +mean.toFixed(2),
    count: sorted.length,
  };
}

// ─── Engine ───────────────────────────────────────────────────────────────────

class CacheAnalyticsEngine {
  private readonly _ns = new Map<string, NSCounters>();
  private readonly _subscribers = new Set<(report: GlobalReport) => void>();
  private _notifyScheduled = false;

  // ─── Ensure namespace ──────────────────────────────────────────────────────

  private _get(namespace: string, maxSize?: number): NSCounters {
    if (!this._ns.has(namespace)) this._ns.set(namespace, emptyNS(maxSize));
    const ns = this._ns.get(namespace)!;
    if (maxSize !== undefined) ns.maxSize = maxSize;
    return ns;
  }

  // ─── Record events ─────────────────────────────────────────────────────────

  /**
   * Record a cache event with an optional latency measurement (ms).
   */
  record(namespace: string, event: CacheEventType, latencyMs?: number): void {
    const ns = this._get(namespace);
    switch (event) {
      case 'hit':       ns.hits++;          if (latencyMs !== undefined) this._addLatency(ns.getLatencies, latencyMs); break;
      case 'miss':      ns.misses++;        if (latencyMs !== undefined) this._addLatency(ns.getLatencies, latencyMs); break;
      case 'set':       ns.sets++;          if (latencyMs !== undefined) this._addLatency(ns.setLatencies, latencyMs); break;
      case 'eviction':  ns.evictions++;     break;
      case 'invalidation': ns.invalidations++; break;
      case 'prefetch':  ns.prefetches++;    break;
      case 'sw-hit':    ns.swHits++;        break;
      case 'sw-miss':   ns.swMisses++;      break;
      case 'idb-hit':   ns.idbHits++;       break;
      case 'idb-miss':  ns.idbMisses++;     break;
    }
    this._scheduleNotify();
  }

  /**
   * Update the live size for a namespace. Should be called after every
   * set/delete operation to keep byte estimates current.
   */
  recordSize(namespace: string, entries: number, bytesEstimate: number, maxSize?: number): void {
    const ns = this._get(namespace, maxSize);
    ns.currentEntries = entries;
    ns.currentBytes   = bytesEstimate;

    const snap: SizeSnapshot = {
      timestamp: Date.now(),
      entries,
      bytesEstimate,
    };
    ns.sizeHistory.push(snap);
    if (ns.sizeHistory.length > MAX_SIZE_HISTORY) ns.sizeHistory.shift();

    this._scheduleNotify();
  }

  // ─── Derived reports ───────────────────────────────────────────────────────

  getNamespaceReport(namespace: string): NamespaceReport {
    const ns = this._get(namespace);
    const totalGets    = ns.hits + ns.misses;
    const totalSWGets  = ns.swHits + ns.swMisses;
    const totalIDBGets = ns.idbHits + ns.idbMisses;

    return {
      namespace,
      hits:          ns.hits,
      misses:        ns.misses,
      sets:          ns.sets,
      evictions:     ns.evictions,
      invalidations: ns.invalidations,
      prefetches:    ns.prefetches,
      swHits:        ns.swHits,
      idbHits:       ns.idbHits,
      hitRate:       totalGets > 0    ? ns.hits    / totalGets    : 0,
      swHitRate:     totalSWGets > 0  ? ns.swHits  / totalSWGets  : 0,
      idbHitRate:    totalIDBGets > 0 ? ns.idbHits / totalIDBGets : 0,
      getLatency:    latencyBucket(ns.getLatencies),
      setLatency:    latencyBucket(ns.setLatencies),
      sizeHistory:   [...ns.sizeHistory],
      currentEntries: ns.currentEntries,
      currentBytesEstimate: ns.currentBytes,
      evictionPressure: ns.maxSize > 0 ? ns.evictions / ns.maxSize : 0,
    };
  }

  getReport(): GlobalReport {
    const namespaces = [...this._ns.keys()].map((k) => this.getNamespaceReport(k));
    const totalHits   = namespaces.reduce((s, n) => s + n.hits,   0);
    const totalMisses = namespaces.reduce((s, n) => s + n.misses, 0);
    const totalGets   = totalHits + totalMisses;

    return {
      totalHits,
      totalMisses,
      totalHitRate: totalGets > 0 ? totalHits / totalGets : 0,
      namespaces,
      snapshotTime: Date.now(),
    };
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  subscribe(cb: (report: GlobalReport) => void): () => void {
    this._subscribers.add(cb);
    // emit immediately with current state
    try { cb(this.getReport()); } catch { /* ignore */ }
    return () => this._subscribers.delete(cb);
  }

  // ─── Reset ─────────────────────────────────────────────────────────────────

  reset(namespace?: string): void {
    if (namespace) {
      this._ns.delete(namespace);
    } else {
      this._ns.clear();
    }
    this._scheduleNotify();
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private _addLatency(bucket: number[], latencyMs: number): void {
    bucket.push(latencyMs);
    if (bucket.length > MAX_LATENCY_SAMPLES) bucket.shift();
  }

  private _scheduleNotify(): void {
    if (this._notifyScheduled) return;
    this._notifyScheduled = true;
    // Batch all synchronous recordings into one notification microtask
    queueMicrotask(() => {
      this._notifyScheduled = false;
      const report = this.getReport();
      this._subscribers.forEach((cb) => {
        try { cb(report); } catch { /* ignore */ }
      });
    });
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const cacheAnalytics = new CacheAnalyticsEngine();
export default cacheAnalytics;
