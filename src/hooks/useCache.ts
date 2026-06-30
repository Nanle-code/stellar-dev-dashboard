/**
 * Typed React hook for the CacheManager facade.
 *
 * Replaces the older useCache.js: same shape but strict types and aware of
 * the IndexedDB layer via getWithFallback / swr.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CacheManager,
  type CacheGetResult,
  type CacheNamespace,
  type CacheStatsSnapshot,
  type SwrOptions,
  type CacheUnsubscribe,
  stellarCacheManager,
  realtimeCacheManager,
  sorobanCacheManager,
} from '../lib/cacheManager'

const SHARED_MANAGERS: Record<string, CacheManager> = {
  default: stellarCacheManager,
  stellar: stellarCacheManager,
  realtime: realtimeCacheManager,
  soroban: sorobanCacheManager,
}

function resolveManager(namespace: CacheNamespace | string): CacheManager {
  if (SHARED_MANAGERS[namespace]) return SHARED_MANAGERS[namespace]
  // Fall back to a fresh per-namespace manager — cached on first use.
  const fresh = new CacheManager({ namespace: namespace as CacheNamespace })
  SHARED_MANAGERS[namespace] = fresh
  return fresh
}

export interface UseCacheApi {
  get: <T>(key: string) => T | null
  getWithFallback: <T>(key: string) => Promise<CacheGetResult<T>>
  set: <T>(key: string, value: T, ttl?: number, tags?: string[]) => Promise<void>
  remove: (key: string) => Promise<void>
  invalidateTag: (tag: string) => Promise<void>
  invalidatePrefix: (prefix: string) => void
  swr: <T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: SwrOptions,
  ) => Promise<T>
  subscribe: <T>(key: string, cb: (value: T) => void) => CacheUnsubscribe
  clear: () => void
  stats: CacheStatsSnapshot | null
  refreshStats: () => void
}

const STATS_REFRESH_MS = 10_000

export function useCache(namespace: CacheNamespace | string = 'default'): UseCacheApi {
  const manager = useMemo(() => resolveManager(namespace), [namespace])
  const [stats, setStats] = useState<CacheStatsSnapshot | null>(() =>
    manager.getStats(),
  )

  const refreshStats = useCallback(() => {
    setStats(manager.getStats())
  }, [manager])

  useEffect(() => {
    refreshStats()
    const interval = setInterval(refreshStats, STATS_REFRESH_MS)
    return () => clearInterval(interval)
  }, [refreshStats])

  const get = useCallback(
    <T,>(key: string): T | null => manager.get<T>(key),
    [manager],
  )

  const getWithFallback = useCallback(
    <T,>(key: string) => manager.getWithFallback<T>(key),
    [manager],
  )

  const set = useCallback(
    <T,>(key: string, value: T, ttl?: number, tags?: string[]) =>
      manager.set<T>(key, value, ttl, tags),
    [manager],
  )

  const remove = useCallback((key: string) => manager.delete(key), [manager])
  const invalidateTag = useCallback(
    (tag: string) => manager.invalidateTag(tag),
    [manager],
  )
  const invalidatePrefix = useCallback(
    (prefix: string) => manager.invalidatePrefix(prefix),
    [manager],
  )

  const swr = useCallback(
    <T,>(key: string, fetcher: () => Promise<T>, options?: SwrOptions) =>
      manager.swr<T>(key, fetcher, options),
    [manager],
  )

  const subscribe = useCallback(
    <T,>(key: string, cb: (value: T) => void) => manager.subscribe<T>(key, cb),
    [manager],
  )

  const clear = useCallback(() => {
    manager.clear()
    refreshStats()
  }, [manager, refreshStats])

  return {
    get,
    getWithFallback,
    set,
    remove,
    invalidateTag,
    invalidatePrefix,
    swr,
    subscribe,
    clear,
    stats,
    refreshStats,
  }
}

export default useCache
