/**
 * Cached Data Hook
 * React hook for fetching and caching data with automatic revalidation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import cache from '../lib/cache';

/**
 * Custom hook for fetching and caching data
 * @param {string} cacheKey - Unique key for caching
 * @param {Function} fetchFn - Async function to fetch data
 * @param {Object} options - Configuration options
 * @param {number} options.ttl - Time to live in milliseconds
 * @param {boolean} options.forceRefresh - Force refresh cache
 * @param {Array} options.dependencies - Dependencies for refetch
 * @returns {Object} { data, loading, error, refetch, isCached }
 */
function useCachedData(cacheKey, fetchFn, options = {}) {
  const {
    ttl = 60000,
    forceRefresh = false,
    dependencies = [],
  } = options;
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCached, setIsCached] = useState(false);
  const isMounted = useRef(true);
  const abortControllerRef = useRef(null);

  const fetchData = useCallback(async (skipCache = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setError(null);
    
    try {
      let cachedData = null;
      
      // Check cache first
      if (!skipCache && !forceRefresh) {
        cachedData = cache.get(cacheKey);
        if (cachedData) {
          if (isMounted.current) {
            setData(cachedData);
            setIsCached(true);
            setLoading(false);
          }
        }
      }
      
      // Always fetch fresh data in background for revalidation
      const freshData = await fetchFn(abortControllerRef.current.signal);
      
      // Update cache with fresh data
      cache.set(cacheKey, freshData, ttl);
      
      if (isMounted.current) {
        setData(freshData);
        setIsCached(false);
        setLoading(false);
        setError(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && isMounted.current) {
        setError(err);
        setLoading(false);
      }
    }
  }, [cacheKey, fetchFn, ttl, forceRefresh]);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    isMounted.current = true;
    fetchData();
    
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cacheKey, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch,
    isCached,
  };
}

/**
 * Hook for paginated data with caching
 */
function useCachedPaginatedData(cacheKey, fetchFn, options = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(options.limit || 20);
  const [hasMore, setHasMore] = useState(true);
  
  const cacheKeyWithPagination = `${cacheKey}:page=${page}:limit=${limit}`;
  
  const { data, loading, error, refetch, isCached } = useCachedData(
    cacheKeyWithPagination,
    () => fetchFn({ page, limit }),
    options
  );
  
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore]);
  
  useEffect(() => {
    if (data && data.length < limit) {
      setHasMore(false);
    }
  }, [data, limit]);
  
  return {
    data: data || [],
    loading,
    error,
    refetch,
    isCached,
    page,
    limit,
    hasMore,
    loadMore,
    setPage,
    setLimit,
  };
}

/**
 * Hook for single item with caching
 */
function useCachedItem(cacheKey, id, fetchFn, options = {}) {
  const itemCacheKey = `${cacheKey}:${id}`;
  
  return useCachedData(itemCacheKey, () => fetchFn(id), options);
}

export default useCachedData;
export { useCachedData, useCachedPaginatedData, useCachedItem };
