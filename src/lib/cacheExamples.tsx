/**
 * Cache Usage Examples & Patterns
 *
 * Comprehensive examples for using SWR caching, optimistic updates,
 * and cache analytics in the Stellar Dashboard.
 */

import { useStellarSWR, useAccount, useTransactions, useNetworkStats, useOptimisticMutation } from '../hooks/useSWR'
import { useCache } from '../hooks/useCache'
import { useCacheAnalytics, useNamespaceCacheAnalytics, useCacheHealthAlerts } from '../hooks/useCacheAnalytics'
import { stellarCacheManager, TTL } from '../lib/cacheManager'
import { TTL_PRESETS, CACHE_TAGS } from '../lib/cacheConfig'

// ═════════════════════════════════════════════════════════════════════════════
// Example 1: Basic Data Fetching with Stale-While-Revalidate
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Fetch account info with automatic caching and SWR
 */
export function ExampleAccountComponent({ publicKey, network }: { publicKey: string; network: string }) {
  // useStellarSWR automatically:
  // - Caches the result for 5 minutes (from useAccount config)
  // - Returns stale data immediately while refreshing in background
  // - Deduplicates requests within 30 seconds
  // - Revalidates on mount and reconnect
  const { data: account, isLoading, error, mutate } = useAccount(publicKey, network, async (pk, net) => {
    const response = await fetch(`/api/accounts/${pk}?network=${net}`)
    return response.json()
  })

  if (isLoading) return <div>Loading account...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h2>Account: {account.id}</h2>
      <p>Balance: {account.balances[0].balance}</p>
      <button onClick={() => mutate()}>Refresh</button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Example 2: Paginated Data with Automatic Caching
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Fetch transactions with pagination and caching
 */
export function ExampleTransactionsComponent({ publicKey, network }: { publicKey: string; network: string }) {
  const {
    data: transactions,
    isLoading,
    hasMore,
    loadMore,
    reset,
  } = useTransactions(publicKey, network, async (pk, net, limit, cursor) => {
    const response = await fetch(`/api/transactions/${pk}?network=${net}&limit=${limit}&cursor=${cursor || ''}`)
    return response.json()
  })

  return (
    <div>
      <h3>Transactions</h3>
      {isLoading && <div>Loading...</div>}
      <ul>
        {transactions.map((tx: any) => (
          <li key={tx.id}>
            {tx.type} - {tx.created_at}
          </li>
        ))}
      </ul>
      {hasMore && <button onClick={loadMore}>Load More</button>}
      <button onClick={reset}>Reset</button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Example 3: Optimistic Updates with Rollback
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Update account with optimistic UI updates
 */
export function ExampleOptimisticUpdateComponent({ publicKey, network }: { publicKey: string; network: string }) {
  const cacheKey = `account:${publicKey}:${network}`

  const { mutate: updateAccount, loading, error } = useOptimisticMutation(
    cacheKey,
    async () => {
      // Simulate API call
      const response = await fetch(`/api/accounts/${publicKey}`, {
        method: 'PUT',
        body: JSON.stringify({ updateData: 'new value' }),
      })
      return response.json()
    },
    {
      ttl: TTL_PRESETS.ACCOUNT_INFO,
      tags: [CACHE_TAGS.ACCOUNT, CACHE_TAGS.ACCOUNT_INFO(publicKey)],

      // Optimistic update: immediately show the new data
      optimisticData: (previous) => ({
        ...previous,
        lastUpdated: Date.now(),
      }),

      // Success callback
      onSuccess: (newData) => {
        console.log('Update successful:', newData)
        // You can trigger notifications, analytics, etc.
      },

      // Error callback with rollback function
      onError: (err, rollback) => {
        console.error('Update failed:', err)
        // Automatically rolls back to previous data
        rollback()
      },
    },
  )

  return (
    <div>
      <button onClick={() => updateAccount()} disabled={loading}>
        {loading ? 'Updating...' : 'Update Account'}
      </button>
      {error && <div>Error: {error.message}</div>}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Example 4: Cache Invalidation by Tags
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Invalidate all account-related cache after successful transaction
 */
export async function ExampleCacheInvalidation(publicKey: string) {
  // Invalidate all transactions for this account
  await stellarCacheManager.invalidateTag(CACHE_TAGS.TRANSACTIONS_FOR_ACCOUNT(publicKey))

  // Invalidate account balance (might have changed)
  await stellarCacheManager.invalidateTag(CACHE_TAGS.ACCOUNT_BALANCE(publicKey))

  // Invalidate pending transactions
  await stellarCacheManager.invalidateTag(CACHE_TAGS.PENDING_TRANSACTIONS(publicKey))
}

// ═════════════════════════════════════════════════════════════════════════════
// Example 5: Manual Cache Management
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Manual cache operations with the useCache hook
 */
export function ExampleManualCacheComponent() {
  const cache = useCache('stellar')

  const handleCacheOperations = async () => {
    // Get cached value
    const cached = cache.get<any>('some-key')

    // Set with TTL and tags
    await cache.set('asset-prices', { USD: 0.12, EUR: 0.11 }, 30_000, ['asset-prices', 'market-data'])

    // SWR: return cache or fetch
    const data = await cache.swr('my-key', async () => {
      const response = await fetch('/api/data')
      return response.json()
    })

    // Invalidate by tag
    await cache.invalidateTag('asset-prices')

    // Subscribe to changes
    const unsubscribe = cache.subscribe('my-key', (newValue) => {
      console.log('Cache updated:', newValue)
    })
  }

  return <button onClick={handleCacheOperations}>Cache Ops</button>
}

// ═════════════════════════════════════════════════════════════════════════════
// Example 6: Cache Analytics & Monitoring
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Monitor cache health and performance
 */
export function ExampleCacheAnalyticsDashboard() {
  const analytics = useCacheAnalytics()
  const alerts = useCacheHealthAlerts()

  if (analytics.loading) return <div>Loading analytics...</div>
  if (analytics.error) return <div>Error: {analytics.error.message}</div>

  return (
    <div>
      <h2>Cache Analytics</h2>

      {/* Display overall health */}
      <div style={{ color: alerts.overallHealth === 'good' ? 'green' : 'red' }}>
        Overall Health: {alerts.overallHealth.toUpperCase()}
      </div>

      {/* Show critical issues */}
      {alerts.criticalIssues.length > 0 && (
        <div style={{ color: 'red' }}>
          <h3>Critical Issues:</h3>
          <ul>
            {alerts.criticalIssues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-namespace stats */}
      <table>
        <thead>
          <tr>
            <th>Namespace</th>
            <th>Hit Rate</th>
            <th>Utilization</th>
            <th>Health</th>
          </tr>
        </thead>
        <tbody>
          {analytics.snapshots.map((snapshot) => (
            <tr key={snapshot.namespace}>
              <td>{snapshot.namespace}</td>
              <td>{snapshot.hitRate.toFixed(1)}%</td>
              <td>{snapshot.cacheUtilization.toFixed(1)}%</td>
              <td>{analytics.health[snapshot.namespace]?.score || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Recommendations */}
      {analytics.suggestions.length > 0 && (
        <div>
          <h3>Optimization Suggestions:</h3>
          {analytics.suggestions.map((suggestion, i) => (
            <div key={i} style={{ borderLeft: `4px solid ${suggestion.priority === 'high' ? 'red' : 'orange'}` }}>
              <strong>{suggestion.issue}</strong>
              <p>{suggestion.suggestion}</p>
              <small>{suggestion.estimatedBenefit}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Example 7: Namespace-Specific Monitoring
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Monitor specific cache namespace
 */
export function ExampleNamespaceCacheMonitor() {
  const stellar = useNamespaceCacheAnalytics('stellar')

  if (!stellar.snapshot) return <div>No data</div>

  return (
    <div>
      <h3>Stellar Cache Monitor</h3>
      <p>Hit Rate: {stellar.snapshot.hitRate.toFixed(1)}%</p>
      <p>Utilization: {stellar.snapshot.cacheUtilization.toFixed(1)}%</p>
      <p>Health: {stellar.health?.score}/100</p>
      <p>Trend: {stellar.trend?.trend}</p>

      {stellar.health?.issues.length! > 0 && (
        <div style={{ color: 'red' }}>
          <strong>Issues:</strong>
          <ul>
            {stellar.health?.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={stellar.refresh}>Refresh Stats</button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Example 8: Network Data with Short TTL
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Fetch network stats with very short TTL
 */
export function ExampleNetworkStatsComponent({ network }: { network: string }) {
  const { data: stats, isLoading } = useNetworkStats(
    network,
    async (net) => {
      const response = await fetch(`/api/network/${net}/stats`)
      return response.json()
    },
    30_000, // refresh every 30 seconds
  )

  if (isLoading) return <div>Loading network stats...</div>

  return (
    <div>
      <h3>Network Stats</h3>
      <p>Ledger: {stats?.latestLedger}</p>
      <p>TPS: {stats?.transactionsPerSecond}</p>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Example 9: Cache Warmup on App Start
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Warm up cache with important data on app startup
 */
export async function warmUpCacheOnAppStart() {
  try {
    // Pre-fetch network statistics
    const networkStats = await fetch('/api/network/public/stats').then((r) => r.json())
    await stellarCacheManager.set(
      'network-stats:public',
      networkStats,
      TTL_PRESETS.NETWORK_STATS,
      [CACHE_TAGS.NETWORK_STATS],
    )

    // Pre-fetch asset list
    const assets = await fetch('/api/assets').then((r) => r.json())
    await stellarCacheManager.set(
      'assets:all',
      assets,
      TTL_PRESETS.ASSET_LIST,
      [CACHE_TAGS.ASSETS],
    )

    console.log('Cache warmed up successfully')
  } catch (error) {
    console.error('Failed to warm up cache:', error)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Example 10: Offline-First Strategy
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Example: Implement offline-first with persistent cache
 */
export function ExampleOfflineFirstComponent({ publicKey, network }: { publicKey: string; network: string }) {
  const cache = useCache('stellar') // persistent cache

  const fetchAccountData = async () => {
    const cacheKey = `account:${publicKey}:${network}`

    // Try to get from cache first (works offline)
    const cached = await cache.getWithFallback<any>(cacheKey)
    if (cached.value) {
      // Return cached data immediately
      // If online, we'll refresh in the background
      if (navigator.onLine) {
        // Refresh in background
        fetch(`/api/accounts/${publicKey}`)
          .then((r) => r.json())
          .then((data) => cache.set(cacheKey, data, TTL_PRESETS.ACCOUNT_INFO))
          .catch((err) => console.error('Background refresh failed:', err))
      }
      return cached.value
    }

    // Not in cache, try to fetch
    if (!navigator.onLine) {
      throw new Error('Offline and no cached data available')
    }

    const response = await fetch(`/api/accounts/${publicKey}`)
    const data = await response.json()
    await cache.set(cacheKey, data, TTL_PRESETS.ACCOUNT_INFO)
    return data
  }

  return <button onClick={fetchAccountData}>Load Account (Offline-First)</button>
}

export default {
  ExampleAccountComponent,
  ExampleTransactionsComponent,
  ExampleOptimisticUpdateComponent,
  ExampleCacheInvalidation,
  ExampleManualCacheComponent,
  ExampleCacheAnalyticsDashboard,
  ExampleNamespaceCacheMonitor,
  ExampleNetworkStatsComponent,
  warmUpCacheOnAppStart,
  ExampleOfflineFirstComponent,
}
