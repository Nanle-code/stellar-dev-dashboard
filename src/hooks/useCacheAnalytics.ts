/**
 * useCacheAnalytics Hook
 *
 * Provides real-time cache analytics and monitoring for React components.
 * - Track cache health metrics
 * - Monitor hit rates and utilization
 * - Get optimization suggestions
 * - Subscribe to cache performance updates
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import {
  recordCacheAnalytics,
  getCacheAnalyticsHistory,
  getLatestAnalytics,
  subscribeToCacheAnalytics,
  assessCacheHealth,
  analyzeCacheTrends,
  getCacheOptimizationSuggestions,
  type CacheAnalyticsSnapshot,
  type CacheHealthMetrics,
  type CacheTrend,
  type CacheOptimizationSuggestion,
} from '../lib/cacheAnalytics'
import { getCombinedCacheStats, type CacheStatsSnapshot } from '../lib/cacheManager'

const ANALYTICS_UPDATE_INTERVAL = 30_000 // 30 seconds

export interface UseCacheAnalyticsResult {
  // Current state
  snapshots: CacheAnalyticsSnapshot[]
  stats: CacheStatsSnapshot[]
  loading: boolean
  error: Error | null

  // Health & trends
  health: Record<string, CacheHealthMetrics>
  trends: Record<string, CacheTrend>
  suggestions: CacheOptimizationSuggestion[]

  // History access
  getHistory: (namespace: string, limit?: number) => CacheAnalyticsSnapshot[]

  // Manual update
  refresh: () => Promise<void>
}

/**
 * Hook for monitoring cache analytics across all namespaces.
 * Automatically updates every 30 seconds and provides health metrics.
 */
export function useCacheAnalytics(): UseCacheAnalyticsResult {
  const [snapshots, setSnapshots] = useState<CacheAnalyticsSnapshot[]>([])
  const [stats, setStats] = useState<CacheStatsSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const updateIntervalRef = useRef<NodeJS.Timeout>()

  // Load initial data
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true)
        const combined = await getCombinedCacheStats()
        setStats(combined.managers)

        // Record analytics for each manager
        combined.managers.forEach((s) => {
          recordCacheAnalytics(s)
        })

        setSnapshots(getLatestAnalytics())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setLoading(false)
      }
    }

    loadStats()

    // Set up periodic updates
    updateIntervalRef.current = setInterval(loadStats, ANALYTICS_UPDATE_INTERVAL)

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [])

  // Subscribe to analytics updates
  useEffect(() => {
    const unsubscribe = subscribeToCacheAnalytics((snapshot) => {
      setSnapshots((prev) => {
        // Update or append snapshot for this namespace
        const existing = prev.findIndex((s) => s.namespace === snapshot.namespace)
        if (existing !== -1) {
          const updated = [...prev]
          updated[existing] = snapshot
          return updated
        }
        return [...prev, snapshot]
      })
    })

    return () => unsubscribe()
  }, [])

  // Calculate health metrics and trends
  const health: Record<string, CacheHealthMetrics> = {}
  const trends: Record<string, CacheTrend> = {}

  for (const stat of stats) {
    health[stat.namespace] = assessCacheHealth(stat)
    trends[stat.namespace] = analyzeCacheTrends(stat.namespace, 5)
  }

  // Get optimization suggestions
  const suggestions = getCacheOptimizationSuggestions(stats)

  // Callbacks
  const getHistory = useCallback(
    (namespace: string, limit?: number) => getCacheAnalyticsHistory(namespace, limit),
    [],
  )

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const combined = await getCombinedCacheStats()
      setStats(combined.managers)
      combined.managers.forEach((s) => {
        recordCacheAnalytics(s)
      })
      setSnapshots(getLatestAnalytics())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    snapshots,
    stats,
    loading,
    error,
    health,
    trends,
    suggestions,
    getHistory,
    refresh,
  }
}

/**
 * Hook for monitoring a specific namespace cache.
 */
export function useNamespaceCacheAnalytics(
  namespace: string,
): {
  snapshot: CacheAnalyticsSnapshot | null
  stat: CacheStatsSnapshot | null
  health: CacheHealthMetrics | null
  trend: CacheTrend | null
  loading: boolean
  refresh: () => Promise<void>
} {
  const analytics = useCacheAnalytics()

  const snapshot = analytics.snapshots.find((s) => s.namespace === namespace) ?? null
  const stat = analytics.stats.find((s) => s.namespace === namespace) ?? null
  const health = analytics.health[namespace] ?? null
  const trend = analytics.trends[namespace] ?? null

  return {
    snapshot,
    stat,
    health,
    trend,
    loading: analytics.loading,
    refresh: analytics.refresh,
  }
}

/**
 * Hook for cache health alerts.
 * Returns current health issues and recommendations.
 */
export function useCacheHealthAlerts(): {
  criticalIssues: string[]
  warnings: string[]
  recommendations: string[]
  overallHealth: 'good' | 'fair' | 'poor'
} {
  const analytics = useCacheAnalytics()

  const criticalIssues: string[] = []
  const warnings: string[] = []
  const recommendations: Set<string> = new Set()
  let totalScore = 0
  let count = 0

  for (const [namespace, health] of Object.entries(analytics.health)) {
    totalScore += health.score
    count += 1

    if (health.score < 40) {
      criticalIssues.push(`${namespace}: ${health.issues.join(', ')}`)
    } else if (health.score < 70) {
      warnings.push(`${namespace}: ${health.issues.join(', ')}`)
    }

    health.recommendations.forEach((rec) => {
      recommendations.add(`${namespace}: ${rec}`)
    })
  }

  const avgScore = count > 0 ? totalScore / count : 100
  let overallHealth: 'good' | 'fair' | 'poor' = 'good'
  if (avgScore < 40) overallHealth = 'poor'
  else if (avgScore < 70) overallHealth = 'fair'

  return {
    criticalIssues,
    warnings,
    recommendations: Array.from(recommendations),
    overallHealth,
  }
}

/**
 * Hook for real-time cache hit rate monitoring.
 * Useful for performance dashboards.
 */
export function useCacheHitRates(): Record<string, number> {
  const [hitRates, setHitRates] = useState<Record<string, number>>({})

  useEffect(() => {
    const unsubscribe = subscribeToCacheAnalytics((snapshot) => {
      setHitRates((prev) => ({
        ...prev,
        [snapshot.namespace]: snapshot.hitRate,
      }))
    })

    return () => unsubscribe()
  }, [])

  return hitRates
}
