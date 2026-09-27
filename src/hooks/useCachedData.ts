/**
 * useCachedData — React hooks for intelligent data fetching with caching
 *
 * Hooks exported:
 *   useCachedData          — generic SWR-style fetch with L1/L2 cache
 *   useCachedAccount       — Stellar account with tag-based invalidation
 *   useCachedTransactions  — paginated transaction history
 *   useCachedNetworkStats  — network stats with short TTL
 *   useCachedPaginatedData — generic paginated fetch
 *   useCachedItem          — single-item fetch by id
 *   useOfflineStatus       — online/offline state + queue length
 *   useCacheStats          — live cache statistics for a debug panel
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import cache, { TTL, isOffline as cacheIsOffline } from '../lib/cache.js';
import {
  getCachedApiResponse,
  setCachedApiResponse,
  getOfflineQueue,
} from '../lib/storage.js';
import { evaluateDataSource, subscribeToConnectivity, isOnline } from '../lib/offlineReadOnly';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function noop(..._args: unknown[]): void {}

/**
 * Deduplicate in-flight requests: if two hooks request the same key
 * simultaneously, only one network call is made.
 */
const _inflight = new Map<string, Promise<unknown>>(); // key → Promise

async function deduplicatedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (_inflight.has(key)) return _inflight.get(key) as Promise<T>;
  const p: Promise<T> = fetcher().finally(() => _inflight.delete(key));
  _inflight.set(key, p as Promise<unknown>);
  return p;
}

// ─── useCachedData ────────────────────────────────────────────────────────────

/**
 * Options accepted by {@link useCachedData}.
 */
export interface UseCachedDataOptions<T> {
  ttl?: number;
  tags?: string[];
  enabled?: boolean;
  persist?: boolean;
  refreshInterval?: number;
  deps?: unknown[];
  onSuccess?: (data: T) => void;
  onError?: (err: unknown) => void;
}

/**
 * Return value of the {@link useCachedData} hook.
 */
export interface UseCachedDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  stale: boolean;
  source: string;
  refetch: () => Promise<void>;
  invalidate: () => void;
  online: boolean;
  offline: boolean;
  dataSource: string;
  dataSourceLabel: string;
  isLiveData: boolean;
  cachedAt: number | null;
  dataAgeMs: number | null;
}

// ─── useCachedData ────────────────────────────────────────────────────────────

/**
 * Generic SWR-style hook.
 *
 * @param {string|null}  cacheKey   Unique key. Pass null to skip fetching.
 * @param {Function}     fetchFn    async () => data
 * @param {object}       [opts]
 * @param {number}       [opts.ttl]           TTL in ms (default: TTL.ACCOUNT)
 * @param {string[]}     [opts.tags]          Cache tags for invalidation
 * @param {boolean}      [opts.enabled]       Set false to pause fetching
 * @param {boolean}      [opts.persist]       Also read/write IndexedDB
 * @param {number}       [opts.refreshInterval] Auto-refresh interval in ms
 * @param {Array}        [opts.deps]          Extra deps that trigger refetch
 * @param {Function}     [opts.onSuccess]     (data) => void
 * @param {Function}     [opts.onError]       (err) => void
 *
 * @returns {{ data, loading, error, stale, source, refetch, invalidate }}
 */
export function useCachedData<T>(
  cacheKey: string | null,
  fetchFn: () => Promise<T>,
  opts: UseCachedDataOptions<T> = {}
): UseCachedDataReturn<T> {
  const {
    ttl             = TTL.ACCOUNT,
    tags            = [],
    enabled         = true,
    persist         = false,
    refreshInterval = 0,
    deps            = [],
    onSuccess       = noop,
    onError         = noop,
  } = opts;

  const [data,       setData]       = useState<T | null>(() => (cacheKey ? cache.get(cacheKey) : null));
  const [loading,    setLoading]    = useState<boolean>(false);
  const [error,      setError]      = useState<unknown>(null);
  const [stale,      setStale]      = useState<boolean>(false);
  const [source,     setSource]     = useState<string>('init');
  const [cachedAt,   setCachedAt]   = useState<number | null>(() => {
    if (!cacheKey) return null;
    const meta = cache._meta && cache._meta.get(cacheKey);
    return meta?.createdAt ?? null;
  });
  const [online,     setOnline]     = useState<boolean>(() => isOnline());
  const [swCacheHit, setSwCacheHit] = useState<boolean>(false);

  const mountedRef  = useRef(true);
  const fetchFnRef  = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  useEffect(() => {
    return subscribeToConnectivity(setOnline);
  }, []);

  const doFetch = useCallback(async (skipCache = false): Promise<void> => {
    if (!cacheKey || !enabled) return;

    // 1. Try L1 memory cache
    if (!skipCache) {
      const { value, stale: isStale, source: src } = await cache.getWithFallback(cacheKey);
      if (value !== null) {
        if (mountedRef.current) {
          setData(value);
          setStale(isStale);
          setSource(src);
          setLoading(false);
          setError(null);
        }
        if (!isStale) return; // Fresh — no network needed
        // Stale — continue to background refresh below
      }

      // 2. Try L2 IndexedDB if persist=true
      if (persist && !value) {
        const stored = await getCachedApiResponse(cacheKey);
        if (stored !== null) {
          if (mountedRef.current) {
            setData(stored);
            setStale(true);
            setSource('indexeddb');
            setLoading(false);
          }
          // Still refresh in background
        }
      }
    }

    // 3. Network fetch (deduplicated)
    if (!mountedRef.current) return;
    setLoading(true);

    try {
      const fresh = await deduplicatedFetch(cacheKey, () => fetchFnRef.current());
      cache.set(cacheKey, fresh, ttl, tags);
      if (persist) setCachedApiResponse(cacheKey, fresh, ttl).catch(noop);

      if (mountedRef.current) {
        setData(fresh);
        setStale(false);
        setSource('network');
        setCachedAt(Date.now());
        setSwCacheHit(false);
        setLoading(false);
        setError(null);
        onSuccess(fresh);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
        onError(err);
      }
    }
  }, [cacheKey, enabled, persist, ttl, tags.join(',')]); // eslint-disable-line

  // Initial fetch + dep changes
  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => { mountedRef.current = false; };
  }, [cacheKey, enabled, ...deps]); // eslint-disable-line

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval || !enabled || !cacheKey) return;
    const id = setInterval(() => doFetch(true), refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval, enabled, cacheKey]); // eslint-disable-line

  // Subscribe to cache updates from other hooks / background refreshes
  useEffect(() => {
    if (!cacheKey) return;
    return cache.subscribe(cacheKey, (value) => {
      if (mountedRef.current) {
        setData(value);
        setStale(false);
        setSource('subscription');
        setCachedAt(Date.now());
      }
    });
  }, [cacheKey]);

  const refetch    = useCallback(() => doFetch(true), [doFetch]);
  const invalidate = useCallback(() => {
    if (cacheKey) cache.delete(cacheKey);
    doFetch(true);
  }, [cacheKey, doFetch]);

  const dataSourceInfo = evaluateDataSource(
    data !== null && data !== undefined,
    {
      cachedAt,
      ttlMs: ttl,
      fromServiceWorkerCache: swCacheHit,
    },
  );

  return {
    data,
    loading,
    error,
    stale,
    source,
    refetch,
    invalidate,
    online,
    offline: !online,
    dataSource: dataSourceInfo.source,
    dataSourceLabel: dataSourceInfo.label,
    isLiveData: dataSourceInfo.isLive,
    cachedAt: dataSourceInfo.cachedAt,
    dataAgeMs: dataSourceInfo.ageMs,
  };
}

// ─── useCachedAccount ─────────────────────────────────────────────────────────

/**
 * Fetch and cache a Stellar account. Automatically invalidates when
 * the connected address or network changes.
 *
 * @param {string|null} publicKey
 * @param {string}      network
 * @param {Function}    fetcher   async (publicKey, network) => accountData
 */
export function useCachedAccount<T>(
  publicKey: string | null,
  network: string,
  fetcher: (publicKey: string | null, network: string) => Promise<T>
): UseCachedDataReturn<T> {
  const key = publicKey ? `account:${publicKey}:${network}` : null;

  return useCachedData(
    key,
    useCallback(() => fetcher(publicKey, network), [publicKey, network]), // eslint-disable-line
    {
      ttl:     TTL.ACCOUNT,
      tags:    ['account', `account:${publicKey}`],
      persist: true,
      enabled: !!publicKey,
    }
  );
}

// ─── useCachedTransactions ────────────────────────────────────────────────────

/**
 * Paginated transaction history with cursor-based paging.
 *
 * @param {string|null} publicKey
 * @param {string}      network
 * @param {Function}    fetcher   async (publicKey, network, limit, cursor) => { records, nextCursor, hasMore }
 * @param {number}      [limit]
 */
/**
 * A single paged transaction payload.
 */
export interface TransactionPage<TRecord = Record<string, unknown>> {
  records?: TRecord[];
  nextCursor?: string | null;
  hasMore?: boolean;
  [key: string]: unknown;
}

/**
 * Return value of the {@link useCachedTransactions} hook.
 */
export interface UseCachedTransactionsReturn<TRecord = Record<string, unknown>> {
  data: TRecord[];
  loading: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => Promise<void>;
}

export function useCachedTransactions<TRecord extends { id: string } = { id: string } & Record<string, unknown>>(
  publicKey: string | null,
  network: string,
  fetcher: (
    publicKey: string | null,
    network: string,
    limit: number,
    cursor: string | null
  ) => Promise<TransactionPage<TRecord> | TRecord[]>,
  limit = 20
): UseCachedTransactionsReturn<TRecord> {
  const [cursor,  setCursor]  = useState<string | null>(null);
  const [allData, setAllData] = useState<TRecord[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const key = publicKey ? `transactions:${publicKey}:${network}:${limit}:${cursor}` : null;

  const { data, loading, error, refetch } = useCachedData<TransactionPage<TRecord> | TRecord[]>(
    key,
    useCallback(
      () => fetcher(publicKey, network, limit, cursor),
      [publicKey, network, limit, cursor] // eslint-disable-line
    ),
    { ttl: TTL.TRANSACTIONS, tags: ['transactions', `account:${publicKey}`], enabled: !!publicKey }
  );

  useEffect(() => {
    if (!data) return;
    const page = data as TransactionPage<TRecord>;
    const records = (page.records || (data as unknown as TRecord[])) as TRecord[];
    setAllData((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      return [...prev, ...records.filter((r) => !ids.has(r.id))];
    });
    setHasMore(page.hasMore ?? records.length === limit);
  }, [data]);

  // Reset when account/network changes
  useEffect(() => {
    setAllData([]);
    setCursor(null);
    setHasMore(true);
  }, [publicKey, network]);

  const loadMore = useCallback((): void => {
    const nextCursor = (data as TransactionPage<TRecord>)?.nextCursor;
    if (!loading && hasMore && nextCursor) {
      setCursor(nextCursor);
    }
  }, [loading, hasMore, data]);

  return { data: allData, loading, error, hasMore, loadMore, refetch };
}

// ─── useCachedNetworkStats ────────────────────────────────────────────────────

/**
 * Network stats with a short TTL and optional auto-refresh.
 *
 * @param {string}   network
 * @param {Function} fetcher  async (network) => stats
 * @param {number}   [refreshInterval]  ms between auto-refreshes (0 = off)
 */
export function useCachedNetworkStats<T>(
  network: string,
  fetcher: (network: string) => Promise<T>,
  refreshInterval = 0
): UseCachedDataReturn<T> {
  const key = `networkStats:${network}`;
  return useCachedData(
    key,
    useCallback(() => fetcher(network), [network]), // eslint-disable-line
    { ttl: TTL.LEDGER, tags: ['network'], refreshInterval }
  );
}

// ─── useCachedPaginatedData ───────────────────────────────────────────────────

/**
 * Page query passed to the fetcher of {@link useCachedPaginatedData}.
 */
export interface PaginatedQuery {
  page: number;
  limit: number;
}

/**
 * Options accepted by {@link useCachedPaginatedData}.
 */
export interface UseCachedPaginatedDataOptions<T> extends UseCachedDataOptions<T[]> {
  limit?: number;
}

/**
 * Return value of the {@link useCachedPaginatedData} hook.
 */
export interface UseCachedPaginatedDataReturn<T> extends UseCachedDataReturn<T[]> {
  data: T[];
  page: number;
  limit: number;
  hasMore: boolean;
  loadMore: () => void;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Generic paginated hook (page-number based).
 */
export function useCachedPaginatedData<T>(
  cacheKey: string | null,
  fetchFn: (query: PaginatedQuery) => Promise<T[]>,
  opts: UseCachedPaginatedDataOptions<T> = {}
): UseCachedPaginatedDataReturn<T> {
  const { limit = 20, ...rest } = opts;
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const pagedKey = cacheKey ? `${cacheKey}:p${page}:l${limit}` : null;

  const result = useCachedData<T[]>(
    pagedKey,
    useCallback(() => fetchFn({ page, limit }), [page, limit]), // eslint-disable-line
    { ...rest }
  );

  useEffect(() => {
    if (result.data && result.data.length < limit) setHasMore(false);
  }, [result.data, limit]);

  const loadMore = useCallback((): void => {
    if (!result.loading && hasMore) setPage((p) => p + 1);
  }, [result.loading, hasMore]);

  return { ...result, data: result.data || [], page, limit, hasMore, loadMore, setPage };
}

// ─── useCachedItem ────────────────────────────────────────────────────────────

/**
 * Fetch a single item by id with caching.
 */
export function useCachedItem<T, TId extends string | number = string>(
  cacheKeyPrefix: string,
  id: TId | null | undefined,
  fetchFn: (id: TId) => Promise<T>,
  opts: UseCachedDataOptions<T> = {}
): UseCachedDataReturn<T> {
  const key = id != null ? `${cacheKeyPrefix}:${id}` : null;
  return useCachedData<T>(
    key,
    useCallback(() => fetchFn(id as TId), [id]), // eslint-disable-line
    { enabled: id != null, ...opts }
  );
}

// ─── useOfflineStatus ─────────────────────────────────────────────────────────

/**
 * Returns { online, offline, queueLength, writeSafe } and updates reactively.
 *
 * writeSafe is false when offline and unsafe writes are attempted (i.e. the
 * UI should disable submit buttons).
 */
/**
 * Return value of the {@link useOfflineStatus} hook.
 */
export interface UseOfflineStatusReturn {
  online: boolean;
  offline: boolean;
  queueLength: number;
  writeSafe: boolean;
}

export function useOfflineStatus(): UseOfflineStatusReturn {
  const [online, setOnline] = useState<boolean>(() => isOnline());
  const [queueLength, setQueueLength] = useState<number>(0);

  useEffect(() => {
    return subscribeToConnectivity(setOnline);
  }, []);

  // Poll queue length every 5 s
  useEffect(() => {
    const refresh = (): void => {
      getOfflineQueue().then((q: Array<unknown>) => setQueueLength(q.length)).catch(noop);
    };
    refresh();
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, []);

  return {
    online,
    offline: !online,
    queueLength,
    writeSafe: online,
  };
}

// ─── useCacheStats ────────────────────────────────────────────────────────────

/**
 * Live cache statistics — useful for a debug/diagnostics panel.
 * Refreshes every `interval` ms.
 */
/**
 * Return value of the {@link useCacheStats} hook.
 */
export interface UseCacheStatsReturn<TStats = Record<string, unknown>> {
  stats: TStats;
  clearAll: () => void;
  invalidateTag: (tag: string) => void;
}

export function useCacheStats<TStats = Record<string, unknown>>(interval = 2_000): UseCacheStatsReturn<TStats> {
  const [stats, setStats] = useState<TStats>(() => cache.getStats());

  useEffect(() => {
    const id = setInterval(() => setStats(cache.getStats()), interval);
    return () => clearInterval(id);
  }, [interval]);

  const clearAll = useCallback((): void => {
    cache.clear();
    setStats(cache.getStats());
  }, []);

  const invalidateTag = useCallback((tag: string): void => {
    cache.invalidateTag(tag);
    setStats(cache.getStats());
  }, []);

  return { stats, clearAll, invalidateTag };
}

// ─── Default export ───────────────────────────────────────────────────────────

export default useCachedData;
