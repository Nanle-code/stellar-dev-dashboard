import { useEffect, useCallback, useState } from 'react';
import { Cache, TTL } from '../lib/cache';

// Global cache instance per namespace
const cacheInstances = new Map();

const getCache = (namespace = 'default') => {
  if (!cacheInstances.has(namespace)) {
    cacheInstances.set(namespace, new Cache({
      namespace,
      persist: true,
      maxSize: 500,
      defaultTTL: TTL.ACCOUNT
    }));
  }
  return cacheInstances.get(namespace);
};

/**
 * useCache - React hook for cache management
 * Provides get, set, invalidate, and subscription functionality
 */
export const useCache = (namespace = 'default') => {
  const cache = getCache(namespace);
  const [cacheStats, setCacheStats] = useState(null);

  // Get a value from cache
  const get = useCallback((key) => {
    return cache.get(key);
  }, [cache]);

  // Set a value in cache
  const set = useCallback((key, value, ttl = null, tags = []) => {
    cache.set(key, value, ttl, tags);
  }, [cache]);

  // Remove a value from cache
  const remove = useCallback((key) => {
    cache.remove(key);
  }, [cache]);

  // Invalidate by tag
  const invalidateByTag = useCallback((tag) => {
    cache.invalidateByTag(tag);
  }, [cache]);

  // Clear entire cache
  const clear = useCallback(() => {
    cache.clear();
  }, [cache]);

  // Subscribe to cache updates
  const subscribe = useCallback((key, callback) => {
    return cache.subscribe(key, callback);
  }, [cache]);

  // Get cache statistics
  const getStats = useCallback(() => {
    return cache.getStats();
  }, [cache]);

  // Update stats periodically
  useEffect(() => {
    const stats = cache.getStats();
    setCacheStats(stats);

    const interval = setInterval(() => {
      setCacheStats(cache.getStats());
    }, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [cache]);

  return {
    get,
    set,
    remove,
    invalidateByTag,
    clear,
    subscribe,
    stats: cacheStats,
    getStats
  };
};

export default useCache;
