/**
 * Cache Initialization — app startup sequence
 *
 * Called once from DashboardLayout on mount. Handles:
 *   1. Prune expired IDB entries
 *   2. Hydrate L1 from IDB (warm startup)
 *   3. Register SW offline-queue flush handler
 *   4. Schedule predictive prefetch for common patterns
 *   5. Start the SW cache stats polling
 *
 * This module is intentionally side-effect-free until `initCache()` is called.
 */

import {
  pruneCaches,
  stellarCacheManager,
  sorobanCacheManager,
  priceCacheManager,
} from './cacheManager';
import { warmingScheduler } from './cacheWarmingStrategy';
import { onSWMessage, swWarmUrls } from './swCacheBridge';
import { flushOfflineQueue } from '../utils/offline';
import { TTL } from './cache.js';

// ─── Cached network stats endpoint warmup ────────────────────────────────────

const NETWORK_STAT_URLS: Record<string, string> = {
  testnet:  'https://horizon-testnet.stellar.org',
  mainnet:  'https://horizon.stellar.org',
  futurenet:'https://horizon-futurenet.stellar.org',
};

// ─── Init ─────────────────────────────────────────────────────────────────────

let _initialized = false;

/**
 * Run the full cache init sequence.
 * Safe to call multiple times — only executes once per page load.
 *
 * @param currentNetwork  The network the user is currently on
 * @param publicKey       Connected wallet address (optional)
 */
export async function initCache(
  currentNetwork: string = 'testnet',
  publicKey?: string | null,
): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  // Step 1: Prune expired IDB rows (non-blocking)
  pruneCaches().catch(() => {});

  // Step 2: Warm common IDB entries back into L1
  // We don't have the fetcher here — warming.scheduleStartupWarm will skip
  // keys whose IDB entry is missing, so this is safe.
  const warmKeys: Array<{ key: string; ttl: number; tags: string[] }> = [
    { key: `network-stats:${currentNetwork}`, ttl: TTL.LEDGER,    tags: ['network-stats'] },
    { key: `xlm-price`,                        ttl: TTL.PRICE,     tags: ['price', 'xlm'] },
  ];

  if (publicKey) {
    warmKeys.push(
      { key: `account:${publicKey}:${currentNetwork}`,      ttl: TTL.ACCOUNT,       tags: ['account', publicKey] },
      { key: `transactions:${publicKey}:${currentNetwork}:20:null`, ttl: TTL.TRANSACTIONS, tags: ['transactions', publicKey] },
      { key: `claimable:${publicKey}:${currentNetwork}`,    ttl: TTL.ACCOUNT,       tags: ['claimable', publicKey] },
    );
  }

  await stellarCacheManager.warmFromStorage(warmKeys);

  // Step 3: Pre-warm L3 SW cache with common API endpoints
  const horizonBase = NETWORK_STAT_URLS[currentNetwork] ?? NETWORK_STAT_URLS.testnet;
  swWarmUrls([
    `${horizonBase}/fee_stats`,
    `${horizonBase}/ledgers?order=desc&limit=1`,
  ]);

  // Step 4: Register SW FLUSH_OFFLINE_QUEUE handler
  onSWMessage('FLUSH_OFFLINE_QUEUE', () => {
    flushOfflineQueue().catch(() => {});
  });

  // Step 5: Auto-prefetch hot keys every 30 s
  setInterval(() => {
    warmingScheduler.autoPrefetchHotKeys((key) => {
      // Route keys back to the right manager + fetcher
      // We only handle prefetch for keys we can reconstruct from context
      if (key.startsWith('stellar:') || key.startsWith('account:')) {
        return {
          manager: stellarCacheManager,
          fetcher: async () => {
            // Fall back to IDB if available (avoids a real network request)
            const { getCachedApiResponse } = await import('./storage.js');
            const val = await getCachedApiResponse(key);
            if (val !== null) return val;
            throw new Error(`No prefetch source for ${key}`);
          },
        };
      }
      if (key.startsWith('soroban:')) {
        return {
          manager: sorobanCacheManager,
          fetcher: async () => {
            const { getCachedApiResponse } = await import('./storage.js');
            const val = await getCachedApiResponse(key);
            if (val !== null) return val;
            throw new Error(`No prefetch source for ${key}`);
          },
        };
      }
      return null;
    });
  }, 30_000);
}

/**
 * Called when the user changes network to purge stale scoped data.
 */
export function handleNetworkSwitch(prevNetwork: string, nextNetwork: string): void {
  stellarCacheManager.invalidateNetwork(prevNetwork);
  stellarCacheManager.invalidateNetwork(nextNetwork);
  priceCacheManager.invalidateTag('price');
}

/**
 * Called after a successful transaction submission to bust account cache.
 */
export async function handleTransactionSuccess(publicKey: string): Promise<void> {
  await stellarCacheManager.invalidateAccount(publicKey);
}

/**
 * Reset the initialized flag (for testing / hot reload).
 * @internal
 */
export function _resetCacheInit(): void {
  _initialized = false;
}
