/**
 * Cache Library Exports
 *
 * Central export point for all cache-related modules and utilities.
 */

// Core cache management
export {
  CacheManager,
  stellarCacheManager,
  realtimeCacheManager,
  priceCacheManager,
  sorobanCacheManager,
  getCombinedCacheStats,
  pruneCaches,
  TTL,
  type CacheManagerOptions,
  type CacheNamespace,
  type CacheStatsSnapshot,
  type CacheGetResult,
  type SwrOptions,
  type CacheUnsubscribe,
} from './cacheManager'

// Cache analytics
export {
  recordCacheAnalytics,
  getCacheAnalyticsHistory,
  getLatestAnalytics,
  subscribeToCacheAnalytics,
  assessCacheHealth,
  analyzeCacheTrends,
  getCacheOptimizationSuggestions,
  estimateCacheValueSize,
  estimateTotalCacheSize,
  EVICTION_POLICIES,
  type CacheAnalyticsSnapshot,
  type EvictionPolicy,
  type CacheHealthMetrics,
  type CacheTrend,
  type CacheOptimizationSuggestion,
} from './cacheAnalytics'

// Cache configuration
export {
  NAMESPACE_CONFIGS,
  NAMESPACE_EVICTION_POLICIES,
  TTL_PRESETS,
  CACHE_TAGS,
  CACHE_BEST_PRACTICES,
  DEVELOPMENT_GUIDELINES,
  MIGRATION_CHECKLIST,
} from './cacheConfig'

// Storage layer (if needed for lower-level operations)
export {
  getCachedApiResponse,
  setCachedApiResponse,
  deleteCachedApiResponse,
  invalidateCacheByTag,
  pruneExpiredApiCache,
  storageStats,
} from './storage'
