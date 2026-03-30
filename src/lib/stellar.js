/**
 * Stellar Service with Caching and Rate Limiting
 * All API calls are cached and rate-limited
 */

import { Server } from 'stellar-sdk';
import cache from './cache';
import rateLimiter from './rateLimiter';

// Initialize Stellar server
const server = new Server(process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org');

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
  ACCOUNT: 60000,      // 1 minute
  TRANSACTIONS: 30000, // 30 seconds
  LEDGER: 5000,        // 5 seconds
  ASSET: 300000,       // 5 minutes
  NETWORK: 3600000,    // 1 hour
};

/**
 * Rate-limited API call wrapper
 * @param {string} identifier - User ID or IP for rate limiting
 * @param {Function} apiCall - The API function to call
 * @returns {Promise} API response
 */
async function rateLimitedCall(identifier, apiCall) {
  const rateLimit = rateLimiter.check(identifier);
  
  if (!rateLimit.allowed) {
    const error = new Error('Rate limit exceeded');
    error.retryAfter = rateLimit.retryAfter;
    error.statusCode = 429;
    throw error;
  }
  
  return apiCall();
}

/**
 * Cached API call wrapper
 * @param {string} cacheKey - Unique cache key
 * @param {Function} apiCall - The API function to call
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise} Cached or fresh data
 */
async function cachedCall(cacheKey, apiCall, ttl = CACHE_TTL.ACCOUNT) {
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch fresh data
  const data = await apiCall();
  
  // Store in cache
  cache.set(cacheKey, data, ttl);
  
  return data;
}

/**
 * Get account details with caching and rate limiting
 * @param {string} accountId - Stellar account ID
 * @param {string} identifier - Rate limit identifier
 * @returns {Promise} Account details
 */
export async function getAccount(accountId, identifier = 'anonymous') {
  const cacheKey = cache.generateKey('account', { id: accountId });
  
  return rateLimitedCall(identifier, () => 
    cachedCall(cacheKey, () => server.loadAccount(accountId), CACHE_TTL.ACCOUNT)
  );
}

/**
 * Get account transactions with caching and pagination
 * @param {string} accountId - Stellar account ID
 * @param {number} limit - Number of transactions
 * @param {string} cursor - Pagination cursor
 * @param {string} identifier - Rate limit identifier
 * @returns {Promise} Transactions
 */
export async function getTransactions(accountId, limit = 20, cursor = null, identifier = 'anonymous') {
  const cacheKey = cache.generateKey('transactions', { id: accountId, limit, cursor });
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, async () => {
      let txQuery = server.transactions().forAccount(accountId).order('desc').limit(limit);
      if (cursor) {
        txQuery = txQuery.cursor(cursor);
      }
      return txQuery.call();
    }, CACHE_TTL.TRANSACTIONS)
  );
}

/**
 * Get payment operations with caching
 * @param {string} accountId - Stellar account ID
 * @param {number} limit - Number of operations
 * @param {string} identifier - Rate limit identifier
 * @returns {Promise} Payments
 */
export async function getPayments(accountId, limit = 20, identifier = 'anonymous') {
  const cacheKey = cache.generateKey('payments', { id: accountId, limit });
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, () => 
      server.payments().forAccount(accountId).order('desc').limit(limit).call(),
      CACHE_TTL.TRANSACTIONS
    )
  );
}

/**
 * Get ledger details with caching
 * @param {number} ledgerSequence - Ledger sequence number
 * @param {string} identifier - Rate limit identifier
 * @returns {Promise} Ledger details
 */
export async function getLedger(ledgerSequence, identifier = 'anonymous') {
  const cacheKey = cache.generateKey('ledger', { sequence: ledgerSequence });
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, () => server.ledgers().ledger(ledgerSequence).call(), CACHE_TTL.LEDGER)
  );
}

/**
 * Get current ledger (latest) with caching
 * @param {string} identifier - Rate limit identifier
 * @returns {Promise} Latest ledger
 */
export async function getCurrentLedger(identifier = 'anonymous') {
  return rateLimitedCall(identifier, () =>
    cachedCall('current_ledger', () => server.ledgers().limit(1).order('desc').call(), CACHE_TTL.LEDGER)
  );
}

/**
 * Get asset details with caching
 * @param {string} assetCode - Asset code
 * @param {string} assetIssuer - Asset issuer address
 * @param {string} identifier - Rate limit identifier
 * @returns {Promise} Asset details
 */
export async function getAsset(assetCode, assetIssuer, identifier = 'anonymous') {
  const cacheKey = cache.generateKey('asset', { code: assetCode, issuer: assetIssuer });
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, () => 
      server.assets().forCode(assetCode).forIssuer(assetIssuer).call(),
      CACHE_TTL.ASSET
    )
  );
}

/**
 * Get network statistics with caching
 * @param {string} identifier - Rate limit identifier
 * @returns {Promise} Network stats
 */
export async function getNetworkStats(identifier = 'anonymous') {
  return rateLimitedCall(identifier, () =>
    cachedCall('network_stats', async () => {
      const [ledger, operations] = await Promise.all([
        getCurrentLedger(identifier),
        server.operations().limit(1).order('desc').call(),
      ]);
      
      return {
        currentLedger: ledger.records[0]?.sequence || 0,
        lastOperationTime: operations.records[0]?.created_at || null,
        networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'Testnet',
      };
    }, CACHE_TTL.NETWORK)
  );
}

/**
 * Clear cache for specific pattern
 * @param {string} pattern - Key pattern to clear
 */
export function clearCache(pattern = null) {
  if (pattern) {
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.startsWith(pattern)) {
        cache.delete(key);
      }
    });
  } else {
    cache.clear();
  }
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
export function getCacheStats() {
  return cache.getStats();
}

export default {
  getAccount,
  getTransactions,
  getPayments,
  getLedger,
  getCurrentLedger,
  getAsset,
  getNetworkStats,
  clearCache,
  getCacheStats,
};
