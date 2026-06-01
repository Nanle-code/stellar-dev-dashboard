import { useState, useEffect, useCallback, useRef } from 'react';
import cache, { TTL, isOffline } from '../lib/cache.js';
import {
  getCachedApiResponse,
  setCachedApiResponse,
  getOfflineQueue,
} from '../lib/storage.js';

function noop() {}

const _inflight = new Map<string, Promise<unknown>>();

async function deduplicatedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (_inflight.has(key)) return _inflight.get(key) as Promise<T>;
  const p = fetcher().finally(() => _inflight.delete(key));
  _inflight.set(key, p as Promise<unknown>);
  return p;
}

export interface UseCachedDataOptions<T> {
  ttl?: number;
  tags?: string[];
  enabled?: boolean;
  persist?: boolean;
  refreshInterval?: number;
  deps?: unknown[];
  onSuccess?: (data: T) => void;
  onError?: (err: Error) => void;
}

export interface UseCachedDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  stale: boolean;
  source: string;
  refetch: () => void;
  invalidate: () => void;
}

export function useCachedData<T>(
  cacheKey: string | null,
  fetchFn: () => Promise<T>,
  opts: UseCachedDataOptions<T> = {},
): UseCachedDataReturn<T> {
  const {
    ttl = TTL.ACCOUNT,
    tags = [],
    enabled = true,
    persist = false,
    refreshInterval = 0,
    deps = [],
    onSuccess = noop,
    onError = noop,
  } = opts;

  const [data, setData] = useState<T | null>(() => (cacheKey ? cache.get(cacheKey) : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [stale, setStale] = useState(false);
  const [source, setSource] = useState('init');

  const mountedRef = useRef(true);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const doFetch = useCallback(
    async (skipCache = false) => {
      if (!cacheKey || !enabled) return;

      if (!skipCache) {
        const { value, stale: isStale, source: src } = await cache.getWithFallback(cacheKey);
        if (value !== null) {
          if (mountedRef.current) {
            setData(value as T);
            setStale(isStale);
            setSource(src);
            setLoading(false);
            setError(null);
          }
          if (!isStale) return;
        }

        if (persist && !value) {
          const stored = await getCachedApiResponse(cacheKey);
          if (stored !== null) {
            if (mountedRef.current) {
              setData(stored as T);
              setStale(true);
              setSource('indexeddb');
              setLoading(false);
            }
          }
        }
      }

      if (!mountedRef.current) return;
      setLoading(true);

      try {
        const fresh = await deduplicatedFetch(cacheKey, () => fetchFnRef.current());
        cache.set(cacheKey, fresh, ttl, tags);
        if (persist) setCachedApiResponse(cacheKey, fresh, ttl).catch(noop);

        if (mountedRef.current) {
          setData(fresh as T);
          setStale(false);
          setSource('network');
          setLoading(false);
          setError(null);
          (onSuccess as (d: T) => void)(fresh as T);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err as Error);
          setLoading(false);
          (onError as (e: Error) => void)(err as Error);
        }
      }
    },
    [cacheKey, enabled, persist, ttl, tags.join(',')], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => { mountedRef.current = false; };
  }, [cacheKey, enabled, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!refreshInterval || !enabled || !cacheKey) return;
    const id = setInterval(() => doFetch(true), refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval, enabled, cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cacheKey) return;
    return cache.subscribe(cacheKey, (value: unknown) => {
      if (mountedRef.current) {
        setData(value as T);
        setStale(false);
        setSource('subscription');
      }
    });
  }, [cacheKey]);

  const refetch = useCallback(() => doFetch(true), [doFetch]);
  const invalidate = useCallback(() => {
    if (cacheKey) cache.delete(cacheKey);
    doFetch(true);
  }, [cacheKey, doFetch]);

  return { data, loading, error, stale, source, refetch, invalidate };
}

export function useCachedAccount<T>(
  publicKey: string | null,
  network: string,
  fetcher: (publicKey: string, network: string) => Promise<T>,
): UseCachedDataReturn<T> {
  const key = publicKey ? `account:${publicKey}:${network}` : null;
  return useCachedData<T>(
    key,
    useCallback(() => fetcher(publicKey!, network), [publicKey, network]), // eslint-disable-line react-hooks/exhaustive-deps
    { ttl: TTL.ACCOUNT, tags: ['account', `account:${publicKey}`], persist: true, enabled: !!publicKey },
  );
}

export interface PaginatedResult<T> {
  records?: T[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface UseCachedTransactionsReturn<T> extends Omit<UseCachedDataReturn<T[]>, 'data'> {
  data: T[];
  hasMore: boolean;
  loadMore: () => void;
}

export function useCachedTransactions<T extends { id: string }>(
  publicKey: string | null,
  network: string,
  fetcher: (publicKey: string, network: string, limit: number, cursor: string | null) => Promise<PaginatedResult<T>>,
  limit = 20,
): UseCachedTransactionsReturn<T> {
  const [cursor, setCursor] = useState<string | null>(null);
  const [allData, setAllData] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const key = publicKey ? `transactions:${publicKey}:${network}:${limit}:${cursor}` : null;

  const { data, loading, error, refetch } = useCachedData<PaginatedResult<T>>(
    key,
    useCallback(() => fetcher(publicKey!, network, limit, cursor), [publicKey, network, limit, cursor]), // eslint-disable-line react-hooks/exhaustive-deps
    { ttl: TTL.TRANSACTIONS, tags: ['transactions', `account:${publicKey}`], enabled: !!publicKey },
  );

  useEffect(() => {
    if (!data) return;
    const records = (data.records ?? (data as unknown as T[]));
    setAllData((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      return [...prev, ...records.filter((r) => !ids.has(r.id))];
    });
    setHasMore(data.hasMore ?? records.length === limit);
  }, [data, limit]);

  useEffect(() => {
    setAllData([]);
    setCursor(null);
    setHasMore(true);
  }, [publicKey, network]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && data?.nextCursor) setCursor(data.nextCursor);
  }, [loading, hasMore, data]);

  return { data: allData, loading, error, hasMore, loadMore, refetch, stale: false, source: 'cache', invalidate: refetch };
}

export function useCachedNetworkStats<T>(
  network: string,
  fetcher: (network: string) => Promise<T>,
  refreshInterval = 0,
): UseCachedDataReturn<T> {
  const key = `networkStats:${network}`;
  return useCachedData<T>(
    key,
    useCallback(() => fetcher(network), [network]), // eslint-disable-line react-hooks/exhaustive-deps
    { ttl: TTL.LEDGER, tags: ['network'], refreshInterval },
  );
}

export interface UseCachedPaginatedDataReturn<T> extends UseCachedDataReturn<T[]> {
  data: T[];
  page: number;
  limit: number;
  hasMore: boolean;
  loadMore: () => void;
  setPage: (page: number) => void;
}

export function useCachedPaginatedData<T>(
  cacheKey: string | null,
  fetchFn: (params: { page: number; limit: number }) => Promise<T[]>,
  opts: UseCachedDataOptions<T[]> & { limit?: number } = {},
): UseCachedPaginatedDataReturn<T> {
  const { limit = 20, ...rest } = opts;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const pagedKey = cacheKey ? `${cacheKey}:p${page}:l${limit}` : null;

  const result = useCachedData<T[]>(
    pagedKey,
    useCallback(() => fetchFn({ page, limit }), [page, limit]), // eslint-disable-line react-hooks/exhaustive-deps
    rest,
  );

  useEffect(() => {
    if (result.data && result.data.length < limit) setHasMore(false);
  }, [result.data, limit]);

  const loadMore = useCallback(() => {
    if (!result.loading && hasMore) setPage((p) => p + 1);
  }, [result.loading, hasMore]);

  return { ...result, data: result.data ?? [], page, limit, hasMore, loadMore, setPage };
}

export function useCachedItem<T>(
  cacheKeyPrefix: string,
  id: string | number | null | undefined,
  fetchFn: (id: string | number) => Promise<T>,
  opts: UseCachedDataOptions<T> = {},
): UseCachedDataReturn<T> {
  const key = id != null ? `${cacheKeyPrefix}:${id}` : null;
  return useCachedData<T>(
    key,
    useCallback(() => fetchFn(id!), [id]), // eslint-disable-line react-hooks/exhaustive-deps
    { enabled: id != null, ...opts },
  );
}

export interface UseOfflineStatusReturn {
  online: boolean;
  queueLength: number;
}

export function useOfflineStatus(): UseOfflineStatusReturn {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [queueLength, setQueueLength] = useState(0);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const refresh = () =>
      getOfflineQueue()
        .then((q: unknown[]) => setQueueLength(q.length))
        .catch(noop);
    refresh();
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, []);

  return { online, queueLength };
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  [key: string]: unknown;
}

export interface UseCacheStatsReturn {
  stats: CacheStats;
  clearAll: () => void;
  invalidateTag: (tag: string) => void;
}

export function useCacheStats(interval = 2_000): UseCacheStatsReturn {
  const [stats, setStats] = useState<CacheStats>(() => cache.getStats());

  useEffect(() => {
    const id = setInterval(() => setStats(cache.getStats()), interval);
    return () => clearInterval(id);
  }, [interval]);

  const clearAll = useCallback(() => {
    cache.clear();
    setStats(cache.getStats());
  }, []);

  const invalidateTag = useCallback((tag: string) => {
    cache.invalidateTag(tag);
    setStats(cache.getStats());
  }, []);

  return { stats, clearAll, invalidateTag };
}

export default useCachedData;
