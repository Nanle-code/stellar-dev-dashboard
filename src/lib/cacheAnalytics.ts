/**
 * Cache Analytics Module
 *
 * Provides comprehensive monitoring of cache performance:
 *   - Hit rate tracking per namespace
 *   - Cache size and eviction monitoring
 *   - Eviction policies and strategies
 *   - Performance metrics (TTL effectiveness, stale data serving)
 *   - Real-time analytics for dashboard visualization
 */

import { CacheStatsSnapshot } from './cacheManager'
import { recordMetric, incrementCounter, getMetricStats } from '../utils/metricsCollector'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheAnalyticsSnapshot {
  timestamp: string
  namespace: string
  hitRate: number
  totalOperations: number
  evictionRate: number
  cacheUtilization: number
  avgItemTTL: number
  staleSizePercentage: number
  memorySize: number
  maxMemory: number
}

export interface EvictionPolicy {
  strategy: 'LRU' | 'LFU' | 'FIFO' | 'ADAPTIVE'
  threshold: number // eviction starts when cache is this % full
  aggressiveness: number // 0-1, higher = more eager eviction
}

export interface CacheHealthMetrics {
  healthy: boolean
  issues: string[]
  recommendations: string[]
  score: number // 0-100
}

// ─── Eviction Policies ────────────────────────────────────────────────────────

export const EVICTION_POLICIES: Record<string, EvictionPolicy> = {
  CONSERVATIVE: {
    strategy: 'LRU',
    threshold: 0.9, // evict when 90% full
    aggressiveness: 0.3,
  },
  BALANCED: {
    strategy: 'LRU',
    threshold: 0.8, // evict when 80% full
    aggressiveness: 0.6,
  },
  AGGRESSIVE: {
    strategy: 'LRU',
    threshold: 0.7, // evict when 70% full
    aggressiveness: 0.9,
  },
  ADAPTIVE: {
    strategy: 'ADAPTIVE',
    threshold: 0.85,
    aggressiveness: 0.7,
  },
}

// ─── Analytics Registry ───────────────────────────────────────────────────────

const ANALYTICS_HISTORY: Map<string, CacheAnalyticsSnapshot[]> = new Map()
const MAX_HISTORY_ENTRIES = 100
const subscribers: Set<(snapshot: CacheAnalyticsSnapshot) => void> = new Set()

// ─── Recording & Tracking ─────────────────────────────────────────────────────

/**
 * Record a cache analytics snapshot from a CacheStatsSnapshot.
 * Called periodically (e.g., every 30 seconds) to track cache performance over time.
 */
export function recordCacheAnalytics(stats: CacheStatsSnapshot): void {
  const snapshot: CacheAnalyticsSnapshot = {
    timestamp: new Date().toISOString(),
    namespace: stats.namespace,
    hitRate: parseFloat(stats.hitRate),
    totalOperations: stats.hits + stats.misses,
    evictionRate:
      stats.hits + stats.misses > 0
        ? (stats.evictions / (stats.hits + stats.misses)) * 100
        : 0,
    cacheUtilization: (stats.size / stats.maxSize) * 100,
    avgItemTTL: 300_000, // placeholder; would need detailed tracking
    staleSizePercentage: 0, // would need stale data tracking
    memorySize: stats.size,
    maxMemory: stats.maxSize,
  }

  // Record metrics
  recordMetric(`cache.hit_rate.${stats.namespace}`, snapshot.hitRate)
  recordMetric(`cache.utilization.${stats.namespace}`, snapshot.cacheUtilization)
  incrementCounter(`cache.operations.${stats.namespace}`, snapshot.totalOperations)
  recordMetric(`cache.evictions.${stats.namespace}`, stats.evictions)

  // Store in history
  if (!ANALYTICS_HISTORY.has(stats.namespace)) {
    ANALYTICS_HISTORY.set(stats.namespace, [])
  }
  const history = ANALYTICS_HISTORY.get(stats.namespace)!
  history.push(snapshot)
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.shift()
  }

  // Notify subscribers
  notifySubscribers(snapshot)
}

/**
 * Get analytics history for a namespace.
 */
export function getCacheAnalyticsHistory(
  namespace: string,
  limit?: number,
): CacheAnalyticsSnapshot[] {
  const history = ANALYTICS_HISTORY.get(namespace) ?? []
  return limit ? history.slice(-limit) : history
}

/**
 * Get latest snapshot for all namespaces.
 */
export function getLatestAnalytics(): CacheAnalyticsSnapshot[] {
  const latest: CacheAnalyticsSnapshot[] = []
  for (const [namespace, history] of ANALYTICS_HISTORY) {
    if (history.length > 0) {
      latest.push(history[history.length - 1])
    }
  }
  return latest
}

/**
 * Subscribe to analytics updates.
 */
export function subscribeToCacheAnalytics(
  callback: (snapshot: CacheAnalyticsSnapshot) => void,
): () => void {
  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
  }
}

function notifySubscribers(snapshot: CacheAnalyticsSnapshot): void {
  for (const subscriber of subscribers) {
    try {
      subscriber(snapshot)
    } catch (error) {
      console.error('Error in cache analytics subscriber:', error)
    }
  }
}

// ─── Health Assessment ────────────────────────────────────────────────────────

/**
 * Assess cache health based on current stats.
 * Returns score (0-100) and recommendations.
 */
export function assessCacheHealth(stats: CacheStatsSnapshot): CacheHealthMetrics {
  const issues: string[] = []
  const recommendations: string[] = []
  let score = 100

  const hitRate = parseFloat(stats.hitRate)
  const utilization = (stats.size / stats.maxSize) * 100

  // Check hit rate
  if (hitRate < 40) {
    issues.push('Low hit rate')
    recommendations.push('Increase cache size or adjust TTL values')
    score -= 20
  } else if (hitRate < 60) {
    recommendations.push('Consider tuning cache TTLs for frequently accessed data')
    score -= 10
  }

  // Check utilization
  if (utilization > 95) {
    issues.push('Cache nearly full')
    recommendations.push('Increase maxSize or implement more aggressive eviction')
    score -= 15
  } else if (utilization > 85) {
    recommendations.push('Monitor cache size; consider increasing maxSize')
    score -= 5
  }

  // Check eviction rate
  if (stats.evictions > stats.hits * 0.5) {
    issues.push('High eviction rate')
    recommendations.push('Increase cache size or reduce TTLs for less important data')
    score -= 15
  }

  // Check persistence status
  if (stats.persist && stats.offline) {
    recommendations.push('Offline mode: cache is using persistent storage')
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  return {
    healthy: score > 70 && issues.length === 0,
    issues,
    recommendations,
    score,
  }
}

// ─── Trend Analysis ────────────────────────────────────────────────────────────

export interface CacheTrend {
  namespace: string
  period: '1m' | '5m' | '15m' | 'all'
  avgHitRate: number
  peakUtilization: number
  trend: 'improving' | 'stable' | 'degrading'
  trendStrength: number // 0-1
}

/**
 * Analyze cache trends over a time period.
 */
export function analyzeCacheTrends(namespace: string, minutes = 5): CacheTrend {
  const history = getCacheAnalyticsHistory(namespace)
  if (history.length < 2) {
    return {
      namespace,
      period: '1m',
      avgHitRate: 0,
      peakUtilization: 0,
      trend: 'stable',
      trendStrength: 0,
    }
  }

  const cutoff = Date.now() - minutes * 60 * 1000
  const filtered = history.filter((s) => new Date(s.timestamp).getTime() > cutoff)

  if (filtered.length === 0) {
    filtered.push(...history.slice(-5))
  }

  const hitRates = filtered.map((s) => s.hitRate)
  const utilizations = filtered.map((s) => s.cacheUtilization)

  const avgHitRate = hitRates.reduce((a, b) => a + b, 0) / hitRates.length
  const peakUtilization = Math.max(...utilizations)

  // Simple trend detection: compare first half vs second half
  const mid = Math.floor(filtered.length / 2)
  const firstHalf = hitRates.slice(0, mid)
  const secondHalf = hitRates.slice(mid)

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

  let trend: 'improving' | 'stable' | 'degrading' = 'stable'
  let trendStrength = 0

  const diff = avgSecond - avgFirst
  const absDiff = Math.abs(diff)

  if (absDiff > 5) {
    trend = diff > 0 ? 'improving' : 'degrading'
    trendStrength = Math.min(1, absDiff / 50)
  }

  const period =
    minutes === 1 ? ('1m' : minutes === 5 ? '5m' : minutes === 15 ? '15m' : 'all')

  return {
    namespace,
    period,
    avgHitRate,
    peakUtilization,
    trend,
    trendStrength,
  }
}

// ─── Size Estimation ──────────────────────────────────────────────────────────

/**
 * Estimate approximate memory usage of a cached value.
 * This is a rough estimate based on JSON serialization size.
 */
export function estimateCacheValueSize(value: unknown): number {
  try {
    const json = JSON.stringify(value)
    // Rough estimate: 1 character ≈ 2 bytes in JavaScript strings
    return json.length * 2
  } catch {
    return 0
  }
}

/**
 * Calculate total estimated memory usage across all managers.
 */
export function estimateTotalCacheSize(snapshots: CacheStatsSnapshot[]): {
  usedMemory: number
  maxMemory: number
  estimatedPercentage: number
} {
  const usedMemory = snapshots.reduce((acc, s) => acc + s.size * 1024, 0) // rough estimate
  const maxMemory = snapshots.reduce((acc, s) => acc + s.maxSize * 1024, 0)

  return {
    usedMemory,
    maxMemory,
    estimatedPercentage: maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0,
  }
}

// ─── Optimization Suggestions ─────────────────────────────────────────────────

export interface CacheOptimizationSuggestion {
  priority: 'high' | 'medium' | 'low'
  issue: string
  suggestion: string
  estimatedBenefit: string
}

/**
 * Analyze cache stats and provide optimization suggestions.
 */
export function getCacheOptimizationSuggestions(
  stats: CacheStatsSnapshot[],
): CacheOptimizationSuggestion[] {
  const suggestions: CacheOptimizationSuggestion[] = []

  for (const stat of stats) {
    const hitRate = parseFloat(stat.hitRate)
    const utilization = (stat.size / stat.maxSize) * 100

    if (hitRate < 40) {
      suggestions.push({
        priority: 'high',
        issue: `${stat.namespace} has low hit rate (${hitRate.toFixed(1)}%)`,
        suggestion: 'Increase TTL for frequently accessed data or increase cache size',
        estimatedBenefit: 'Could improve hit rate by 10-20%',
      })
    }

    if (utilization > 90) {
      suggestions.push({
        priority: 'high',
        issue: `${stat.namespace} cache is nearly full (${utilization.toFixed(1)}%)`,
        suggestion: 'Increase maxSize or implement more aggressive eviction',
        estimatedBenefit: 'Reduce evictions and maintain cache effectiveness',
      })
    }

    if (stat.evictions > 0 && stat.evictions > stat.hits * 0.3) {
      suggestions.push({
        priority: 'medium',
        issue: `${stat.namespace} has high eviction rate`,
        suggestion: 'Consider shorter TTLs for less important data or increase cache size',
        estimatedBenefit: 'Reduce cache thrashing',
      })
    }

    if (!stat.persist && stat.namespace !== 'realtime') {
      suggestions.push({
        priority: 'low',
        issue: `${stat.namespace} is not persistent`,
        suggestion: 'Enable persistence for faster app startup and offline support',
        estimatedBenefit: 'Better offline experience and faster app load',
      })
    }
  }

  return suggestions
}
