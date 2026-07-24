/**
 * useCacheAnalytics
 *
 * React hook that subscribes to live cache analytics and exposes:
 *   - Global hit rate + per-namespace reports
 *   - Latency histograms (p50/p95/p99)
 *   - Size history for sparkline charts
 *   - SW (L3) stats
 *   - Warming stats (warmed / skipped / failed)
 *   - Helpers: invalidateTag, warmKey, prefetch
 */

import { useCallback, useEffect, useState } from 'react';
import { cacheAnalytics } from '../lib/cacheAnalytics';
import type { GlobalReport, NamespaceReport } from '../lib/cacheAnalytics';
import {
  stellarCacheManager,
  realtimeCacheManager,
  sorobanCacheManager,
  priceCacheManager,
} from '../lib/cacheManager';
import { warmingScheduler } from '../lib/cacheWarmingStrategy';
import type { WarmingStats } from '../lib/cacheWarmingStrategy';
import { swGetStats } from '../lib/swCacheBridge';
import type { SWStats } from '../lib/swCacheBridge';
import { getCombinedCacheStats } from '../lib/cacheManager';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheAnalyticsState {
  global: GlobalReport;
  warming: WarmingStats;
  sw: SWStats | null;
  loading: boolean;
}

export interface UseCacheAnalyticsReturn extends CacheAnalyticsState {
  /** Get the report for a specific namespace */
  getNamespace: (ns: string) => NamespaceReport | undefined;
  /** Format a hit rate (0–1) as a percentage string */
  formatRate: (r: number) => string;
  /** Invalidate a tag across all managers */
  invalidateTag: (tag: string) => Promise<void>;
  /** Schedule a predictive prefetch */
  prefetch: (key: string, fetcher: () => Promise<unknown>, ttl?: number) => void;
  /** Refresh stats from SW immediately */
  refreshSW: () => Promise<void>;
  /** Clear all L1 caches */
  clearAll: () => void;
}

// ─── Default report ───────────────────────────────────────────────────────────

const DEFAULT_GLOBAL: GlobalReport = {
  totalHits:    0,
  totalMisses:  0,
  totalHitRate: 0,
  namespaces:   [],
  snapshotTime: Date.now(),
};

const DEFAULT_WARMING: WarmingStats = {
  warmed: 0, skipped: 0, failed: 0, prefetched: 0, backgroundRefreshes: 0,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCacheAnalytics(refreshIntervalMs = 5_000): UseCacheAnalyticsReturn {
  const [global,  setGlobal]  = useState<GlobalReport>(DEFAULT_GLOBAL);
  const [warming, setWarming] = useState<WarmingStats>(DEFAULT_WARMING);
  const [sw,      setSW]      = useState<SWStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to the analytics engine (fires on every cache operation)
  useEffect(() => {
    const unsub = cacheAnalytics.subscribe((report) => {
      setGlobal(report);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Poll warming stats and SW stats on a slower cadence
  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      if (!mounted) return;
      setWarming(warmingScheduler.getStats());
      const swStats = await swGetStats(500);
      if (mounted) setSW(swStats);
    };

    refresh();
    const id = setInterval(refresh, refreshIntervalMs);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [refreshIntervalMs]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getNamespace = useCallback(
    (ns: string): NamespaceReport | undefined =>
      global.namespaces.find((n) => n.namespace === ns),
    [global],
  );

  const formatRate = useCallback((r: number): string => `${(r * 100).toFixed(1)}%`, []);

  const invalidateTag = useCallback(async (tag: string): Promise<void> => {
    await Promise.all([
      stellarCacheManager.invalidateTag(tag),
      realtimeCacheManager.invalidateTag(tag),
      sorobanCacheManager.invalidateTag(tag),
      priceCacheManager.invalidateTag(tag),
    ]);
  }, []);

  const prefetch = useCallback(
    (key: string, fetcher: () => Promise<unknown>, ttl?: number): void => {
      stellarCacheManager.prefetch([{ key, fetcher, ttl }]);
    },
    [],
  );

  const refreshSW = useCallback(async (): Promise<void> => {
    const stats = await swGetStats(1_000);
    setSW(stats);
  }, []);

  const clearAll = useCallback((): void => {
    stellarCacheManager.clear();
    realtimeCacheManager.clear();
    sorobanCacheManager.clear();
    priceCacheManager.clear();
  }, []);

  return {
    global,
    warming,
    sw,
    loading,
    getNamespace,
    formatRate,
    invalidateTag,
    prefetch,
    refreshSW,
    clearAll,
  };
}

export default useCacheAnalytics;
