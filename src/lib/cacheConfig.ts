/**
 * Cache Configuration & Best Practices
 *
 * Default configurations for Stellar Dashboard cache layers.
 * Provides TTL settings, namespace configs, and recommended usage patterns.
 */

import { TTL } from './cacheManager'
import type { CacheManagerOptions } from './cacheManager'
import type { EvictionPolicy } from './cacheAnalytics'
import { EVICTION_POLICIES } from './cacheAnalytics'

// ─── Namespace Configurations ─────────────────────────────────────────────────

/**
 * Configuration for each cache namespace.
 * Customize based on your data freshness requirements and available memory.
 */
export const NAMESPACE_CONFIGS: Record<string, CacheManagerOptions> = {
  stellar: {
    namespace: 'stellar',
    maxSize: 500,
    defaultTTL: TTL.ACCOUNT,
    persist: true,
  },
  realtime: {
    namespace: 'realtime',
    maxSize: 100,
    defaultTTL: TTL.SHORT,
    persist: false,
  },
  price: {
    namespace: 'price',
    maxSize: 100,
    defaultTTL: TTL.ASSET,
    persist: true,
  },
  soroban: {
    namespace: 'soroban',
    maxSize: 200,
    defaultTTL: TTL.LONG,
    persist: true,
  },
}

// ─── Eviction Policies ────────────────────────────────────────────────────────

/**
 * Recommended eviction policies per namespace.
 */
export const NAMESPACE_EVICTION_POLICIES: Record<string, EvictionPolicy> = {
  stellar: EVICTION_POLICIES.BALANCED,
  realtime: EVICTION_POLICIES.AGGRESSIVE,
  price: EVICTION_POLICIES.CONSERVATIVE,
  soroban: EVICTION_POLICIES.CONSERVATIVE,
}

// ─── TTL Presets ──────────────────────────────────────────────────────────────

/**
 * Pre-configured TTL values for different data types.
 * Use these when calling cache operations.
 */
export const TTL_PRESETS = {
  // Account data
  ACCOUNT_INFO: TTL.ACCOUNT, // 1 min
  ACCOUNT_BALANCE: TTL.ACCOUNT,
  ACCOUNT_SEQUENCE: TTL.ACCOUNT,

  // Transactions
  TRANSACTIONS_LIST: TTL.TRANSACTIONS, // 30 sec
  TRANSACTION_DETAIL: TTL.TRANSACTIONS,
  PENDING_TRANSACTIONS: 5_000, // 5 sec (very fresh)

  // Network data
  NETWORK_STATS: TTL.NETWORK, // 1 hour
  LEDGER_INFO: TTL.LEDGER, // 5 sec
  NETWORK_EFFECTS: 30_000, // 30 sec

  // Assets
  ASSET_LIST: TTL.ASSET, // 5 min
  ASSET_DETAILS: TTL.ASSET,
  ASSET_PRICES: TTL.PRICE, // 30 sec

  // Pools
  LIQUIDITY_POOL_INFO: TTL.POOL, // 1 min
  LIQUIDITY_POOL_DETAIL: TTL.POOL_DETAIL, // 30 sec

  // Soroban
  CONTRACT_METADATA: TTL.LONG, // 1 hour
  CONTRACT_STATE: TTL.ACCOUNT, // 1 min

  // Long-lived
  STELLAR_INFO: TTL.LONG, // 1 hour
  FEDERATION_RECORDS: TTL.LONG,

  // Real-time/temporary
  LIVE_UPDATES: TTL.SHORT, // 10 sec
  USER_ACTIVITY: 15_000, // 15 sec
}

// ─── Tag Conventions ──────────────────────────────────────────────────────────

/**
 * Recommended cache tags for invalidation grouping.
 */
export const CACHE_TAGS = {
  // Account-related
  ACCOUNT: 'account',
  ACCOUNT_INFO: (publicKey: string) => `account:${publicKey}`,
  ACCOUNT_BALANCE: (publicKey: string) => `account-balance:${publicKey}`,

  // Transaction-related
  TRANSACTIONS: 'transactions',
  TRANSACTIONS_FOR_ACCOUNT: (publicKey: string) => `transactions:${publicKey}`,
  PENDING_TRANSACTIONS: (publicKey: string) => `pending-tx:${publicKey}`,

  // Network-related
  NETWORK_STATS: 'network-stats',
  LEDGER_INFO: 'ledger-info',
  NETWORK_HEALTH: 'network-health',

  // Asset-related
  ASSETS: 'assets',
  ASSET_DETAIL: (assetCode: string) => `asset:${assetCode}`,
  ASSET_PRICES: 'asset-prices',

  // Pool-related
  POOLS: 'pools',
  POOL_DETAIL: (poolId: string) => `pool:${poolId}`,

  // Soroban
  SOROBAN_CONTRACTS: 'soroban-contracts',
  CONTRACT: (contractId: string) => `contract:${contractId}`,

  // Invalidation groups
  USER_DATA: 'user-data',
  MARKET_DATA: 'market-data',
}

// ─── Best Practices ───────────────────────────────────────────────────────────

export const CACHE_BEST_PRACTICES = {
  /**
   * When to use stale-while-revalidate (SWR):
   * - User-visible data that's not super time-sensitive (accounts, assets)
   * - Data that changes infrequently
   * - Network requests that are expensive to repeat
   */
  SWR_USAGE: [
    'Account info (balance, sequence, flags)',
    'Asset lists and details',
    'Historical transaction data',
    'Network statistics',
    'Contract metadata',
  ],

  /**
   * When NOT to use SWR:
   * - Real-time prices and rates (use short TTL or no cache)
   * - Pending transactions (use very short TTL)
   * - User permissions/auth state (invalidate on changes)
   */
  NO_SWR_USAGE: [
    'Real-time price feeds',
    'Pending transaction status',
    'User authentication state',
    'Active session data',
  ],

  /**
   * Invalidation strategies:
   * - Use tags to group related cache entries
   * - Invalidate on user action (submit tx, create account)
   * - Invalidate on notification (received from network)
   * - Always invalidate after successful mutations
   */
  INVALIDATION: [
    'After successful mutation, invalidate related data',
    'Use namespace-wide invalidation for user logout',
    'Use tag-based invalidation for related data groups',
    'Implement webhook handlers for real-time updates',
  ],

  /**
   * Performance tips:
   * - Batch similar requests to enable deduplication
   * - Use proper key naming for cache hit rates
   * - Monitor cache hit rates via dashboard
   * - Set reasonable TTLs; shorter = fresher but more requests
   */
  PERFORMANCE: [
    'Use consistent cache key format: "type:identifier:network"',
    'Group related data with meaningful tags',
    'Monitor cache analytics for hit rate degradation',
    'Use optimistic updates for better UX',
  ],

  /**
   * Offline support:
   * - Persistent cache (persist: true) survives app reload
   * - Stale data is served when offline
   * - Mutations queue for later processing
   * - Use offline indicators in UI
   */
  OFFLINE: [
    'Enable persist:true for data needed offline',
    'Use extended stale-while-revalidate offline',
    'Queue mutations for batch processing when online',
    'Display offline status to users',
  ],
}

// ─── Development Guidelines ───────────────────────────────────────────────────

export const DEVELOPMENT_GUIDELINES = {
  monitoring: {
    description: 'Monitor cache health in development',
    steps: [
      'Use useCacheAnalytics() hook in dashboard',
      'Watch hit rates for each namespace',
      'Check for high eviction rates',
      'Review optimization suggestions',
    ],
  },

  testing: {
    description: 'Test cache behavior thoroughly',
    steps: [
      'Test hit rate with repeated queries',
      'Test eviction behavior near max size',
      'Test tag-based invalidation',
      'Test offline scenarios',
      'Test TTL expiration',
    ],
  },

  optimization: {
    description: 'Optimize cache configuration',
    steps: [
      'Start with default configs',
      'Monitor hit rates in production',
      'Adjust TTLs based on data freshness needs',
      'Increase maxSize if hit rate is too low',
      'Use aggressive eviction for real-time data',
    ],
  },

  debugging: {
    description: 'Debug cache issues',
    steps: [
      'Check cache stats via dashboard',
      'Review analytics history for anomalies',
      'Verify tag-based invalidation is working',
      'Check for cache key naming issues',
      'Monitor memory usage with browser DevTools',
    ],
  },
}

// ─── Migration Checklist ──────────────────────────────────────────────────────

export const MIGRATION_CHECKLIST = [
  '[ ] SWR library installed',
  '[ ] CacheManager configured for each namespace',
  '[ ] Custom SWR hooks created (useAccount, useTransactions, etc.)',
  '[ ] Optimistic updates implemented',
  '[ ] Cache tags defined for invalidation',
  '[ ] Analytics hooks integrated in dashboard',
  '[ ] Offline support tested',
  '[ ] Cache hit rates monitored',
  '[ ] TTLs tuned based on performance',
  '[ ] Error handling implemented',
  '[ ] Documentation updated',
  '[ ] Team trained on cache strategy',
]

export default {
  NAMESPACE_CONFIGS,
  NAMESPACE_EVICTION_POLICIES,
  TTL_PRESETS,
  CACHE_TAGS,
  CACHE_BEST_PRACTICES,
  DEVELOPMENT_GUIDELINES,
  MIGRATION_CHECKLIST,
}
