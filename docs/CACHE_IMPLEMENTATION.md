# SWR Cache Implementation Guide

## Overview

This guide documents the professional-grade SWR (Stale-While-Revalidate) caching system implemented for the Stellar Dev Dashboard. The system provides:

- **Two-layer caching**: In-memory L1 (fast) + IndexedDB L2 (persistent)
- **Stale-while-revalidate**: Serve cached data immediately, refresh in background
- **Automatic deduplication**: Combines duplicate requests within a timeframe
- **Tag-based invalidation**: Invalidate groups of related cache entries
- **Offline support**: Persistent cache survives app reload and works offline
- **Comprehensive analytics**: Monitor cache health, hit rates, and performance

## Architecture

### Layer 1: In-Memory LRU Cache
- Fast, volatile storage using Least Recently Used eviction
- Per-namespace isolation with configurable size limits
- Automatic TTL-based expiration
- Tag-based invalidation support

### Layer 2: IndexedDB Persistent Cache
- Survives app reload and browser restart
- Async operations with compression
- Supports offline-first strategies
- Configurable per namespace

### Cache Managers

Four pre-configured namespace managers:

1. **Stellar** (500 items, 1min TTL, persistent)
   - Account info, balances, sequences
   - Primary dashboard data

2. **Realtime** (100 items, 10sec TTL, non-persistent)
   - Live prices, ledger snapshots
   - High-frequency updates

3. **Price** (100 items, 5min TTL, persistent)
   - Asset prices, exchange rates
   - Market data

4. **Soroban** (200 items, 1hr TTL, persistent)
   - Contract metadata, state
   - Rarely-changing data

## Quick Start

### 1. Fetch Data with SWR

```typescript
import { useAccount } from '@/hooks/useSWR'

function MyComponent({ publicKey, network }) {
  // Automatically cached for 5 minutes with SWR
  const { data: account, isLoading, error, mutate } = useAccount(
    publicKey,
    network,
    async (pk, net) => {
      const response = await fetch(`/api/accounts/${pk}`)
      return response.json()
    }
  )

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error</div>

  return <div>{account.id}</div>
}
```

### 2. Optimistic Updates

```typescript
const { mutate, loading, error } = useOptimisticMutation(
  cacheKey,
  async () => {
    // API call
    return fetch('/api/update', { method: 'PUT' }).then(r => r.json())
  },
  {
    optimisticData: (previous) => ({
      ...previous,
      updated: true,
    }),
    onError: (err, rollback) => {
      // Automatically rolls back on error
      rollback()
    },
  }
)
```

### 3. Monitor Cache Health

```typescript
function CacheDashboard() {
  const analytics = useCacheAnalytics()
  const alerts = useCacheHealthAlerts()

  return (
    <div>
      <h2>Health: {alerts.overallHealth}</h2>
      <ul>
        {alerts.criticalIssues.map(issue => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  )
}
```

## API Reference

### Hooks

#### `useStellarSWR<T>(key, fetcher, options?)`
Base SWR hook with Stellar cache integration.

#### `useAccount<T>(publicKey, network, fetcher)`
Fetch account data with 5-minute SWR.

#### `useTransactions<T>(publicKey, network, fetcher, limit?)`
Fetch paginated transactions with 1-minute SWR.

#### `useNetworkStats<T>(network, fetcher, refreshInterval?)`
Fetch network stats with 30-second SWR.

#### `useOptimisticMutation<T>(key, mutationFn, options?)`
Mutation hook with optimistic updates and rollback.

#### `useCache(namespace?)`
Manual cache operations (get, set, delete, invalidate).

#### `useCacheAnalytics()`
Real-time cache analytics and health monitoring.

#### `useNamespaceCacheAnalytics(namespace)`
Monitor specific namespace performance.

#### `useCacheHealthAlerts()`
Get health alerts and recommendations.

#### `useCacheHitRates()`
Real-time hit rate monitoring.

### Cache Managers

```typescript
import {
  stellarCacheManager,
  realtimeCacheManager,
  priceCacheManager,
  sorobanCacheManager,
} from '@/lib/cacheManager'

// Manual operations
await stellarCacheManager.set(key, value, ttl, tags)
const value = stellarCacheManager.get(key)
await stellarCacheManager.delete(key)
await stellarCacheManager.invalidateTag(tag)

// Get stats
const stats = stellarCacheManager.getStats()

// SWR with fetcher
const data = await stellarCacheManager.swr(key, fetcher, options)
```

### Analytics Functions

```typescript
import {
  recordCacheAnalytics,
  getCacheAnalyticsHistory,
  assessCacheHealth,
  analyzeCacheTrends,
  getCacheOptimizationSuggestions,
} from '@/lib/cacheAnalytics'

// Record snapshot
recordCacheAnalytics(stats)

// Get history
const history = getCacheAnalyticsHistory('stellar', limit=100)

// Assess health
const health = assessCacheHealth(stats)

// Analyze trends
const trend = analyzeCacheTrends('stellar', minutes=5)

// Get suggestions
const suggestions = getCacheOptimizationSuggestions(allStats)
```

## Configuration

### TTL Presets

```typescript
import { TTL_PRESETS } from '@/lib/cacheConfig'

// Usage
cache.set(key, value, TTL_PRESETS.ACCOUNT_INFO)
cache.set(key, value, TTL_PRESETS.TRANSACTIONS_LIST)
```

### Cache Tags

```typescript
import { CACHE_TAGS } from '@/lib/cacheConfig'

// Invalidate all transactions for account
await cache.invalidateTag(CACHE_TAGS.TRANSACTIONS_FOR_ACCOUNT(publicKey))

// Invalidate all market data
await cache.invalidateTag(CACHE_TAGS.MARKET_DATA)
```

### Eviction Policies

```typescript
import { EVICTION_POLICIES } from '@/lib/cacheAnalytics'

const policy = EVICTION_POLICIES.BALANCED
// Supported: CONSERVATIVE, BALANCED, AGGRESSIVE, ADAPTIVE
```

## Best Practices

### 1. Choose Right Stale Times

```typescript
// Fresh data (real-time)
const { data } = useNetworkStats(network, fetcher, 30_000)

// Less frequent updates (1 minute)
const { data } = useTransactions(publicKey, network, fetcher)

// Slow-changing data (5 minutes)
const { data } = useAccount(publicKey, network, fetcher)
```

### 2. Invalidate on Mutations

```typescript
await tx.submit()
  .then(() => {
    // Invalidate related data
    stellarCacheManager.invalidateTag(
      CACHE_TAGS.TRANSACTIONS_FOR_ACCOUNT(publicKey)
    )
    stellarCacheManager.invalidateTag(
      CACHE_TAGS.ACCOUNT_BALANCE(publicKey)
    )
  })
```

### 3. Use Optimistic Updates

```typescript
const { mutate } = useOptimisticMutation(
  cacheKey,
  submitTransaction,
  {
    optimisticData: (prev) => ({
      ...prev,
      status: 'pending',
    }),
  }
)
```

### 4. Monitor Performance

```typescript
// In dashboard/dev tools
const analytics = useCacheAnalytics()

if (analytics.snapshots[0].hitRate < 50) {
  console.warn('Low cache hit rate - adjust TTLs?')
}

if (analytics.suggestions.length > 0) {
  console.info('Optimization opportunities:', analytics.suggestions)
}
```

### 5. Implement Offline Support

```typescript
const cache = useCache('stellar')

const data = await cache.getWithFallback(key)
if (data.value && !navigator.onLine) {
  // Serve stale data offline
  return data.value
}
```

## Troubleshooting

### Low Cache Hit Rates

**Symptom**: Cache hit rate < 50%

**Solutions**:
1. Check cache key consistency across your app
2. Increase TTL values for frequently-accessed data
3. Increase `maxSize` if cache is filling up
4. Use deduplication properly (check SWR config)

### High Eviction Rate

**Symptom**: Many entries being evicted prematurely

**Solutions**:
1. Increase `maxSize` for the namespace
2. Use shorter TTLs for less important data
3. Use tag-based cleanup for stale data
4. Consider more aggressive eviction policy

### Stale Data Served Too Long

**Symptom**: Users see outdated information

**Solutions**:
1. Decrease TTL values
2. Use `revalidateOnFocus: true` for important data
3. Implement real-time updates via websockets
4. Use shorter stale-while-revalidate window

### Cache Not Persisting

**Symptom**: Data lost after page reload

**Solutions**:
1. Check `persist: true` in cache config
2. Verify IndexedDB is enabled in browser
3. Check browser storage quota
4. Look for cache.destroy() calls

## Performance Metrics

### Typical Hit Rates (Target)

- **Stellar namespace**: 60-80% (account data, infrequent changes)
- **Realtime namespace**: 30-50% (fast updates, high variance)
- **Price namespace**: 70-90% (relatively stable)
- **Soroban namespace**: 80-95% (rarely changes)

### Memory Usage (Estimates)

- **Small value** (100 bytes): ~500 items = 50KB L1 + indexedDB
- **Medium value** (1KB): ~500 items = 500KB L1 + indexedDB
- **Large value** (10KB): ~500 items = 5MB L1 + indexedDB

### Network Savings

With proper SWR:
- **Repeated requests**: 0 network calls (served from cache)
- **Stale updates**: Background refresh only
- **Offline**: 0 network calls

## Migration Checklist

- [x] SWR library installed
- [x] CacheManager implemented with two-layer architecture
- [x] Custom SWR hooks (useAccount, useTransactions, useNetworkStats)
- [x] Optimistic updates with rollback
- [x] Cache analytics and monitoring
- [ ] Integrate cache analytics dashboard in your app
- [ ] Add cache health alerts to UI
- [ ] Test offline scenarios
- [ ] Tune TTLs based on monitoring
- [ ] Document cache strategy for team
- [ ] Set up CI/CD monitoring for cache metrics

## Advanced Topics

### Custom Cache Manager

```typescript
import { CacheManager } from '@/lib/cacheManager'

const customCache = new CacheManager({
  namespace: 'custom',
  maxSize: 1000,
  defaultTTL: 60_000,
  persist: true,
})
```

### Subscribing to Cache Changes

```typescript
const unsubscribe = cache.subscribe(key, (newValue) => {
  console.log('Cache updated:', newValue)
})

// Later:
unsubscribe()
```

### Custom Analytics

```typescript
import { recordCacheAnalytics } from '@/lib/cacheAnalytics'

// Record snapshot every 30 seconds
setInterval(() => {
  const stats = stellarCacheManager.getStats()
  recordCacheAnalytics(stats)
}, 30_000)
```

## Support & Issues

For questions or issues:
1. Check cache analytics dashboard for health warnings
2. Review optimization suggestions
3. Monitor trend analysis in dev tools
4. Check browser IndexedDB quota
5. Verify TTL/eviction policy settings

## References

- [SWR Documentation](https://swr.vercel.app)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Stellar Dev Dashboard Code](src/lib/cacheManager.ts)
