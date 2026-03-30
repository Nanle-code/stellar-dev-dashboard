/**
 * Stellar Service with Caching and Rate Limiting
 * All API calls are cached and rate-limited
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import cache from './cache';
import rateLimiter from './rateLimiter';

export const NETWORKS = {
  mainnet: {
    name: 'Mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanUrl: 'https://soroban-rpc.stellar.org',
    passphrase: StellarSdk.Networks.PUBLIC,
  },
  testnet: {
    name: 'Testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanUrl: 'https://soroban-testnet.stellar.org',
    passphrase: StellarSdk.Networks.TESTNET,
    faucetUrl: 'https://friendbot.stellar.org',
  },
};

const COINGECKO_XLM_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd';

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
  ACCOUNT: 60000,      // 1 minute
  TRANSACTIONS: 30000, // 30 seconds
  LEDGER: 5000,        // 5 seconds
  ASSET: 300000,       // 5 minutes
  NETWORK: 3600000,    // 1 hour
  PRICE: 30000,        // 30 seconds
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
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  const data = await apiCall();
  cache.set(cacheKey, data, ttl);
  return data;
}

export function getServer(network = 'testnet') {
  return new StellarSdk.Horizon.Server(NETWORKS[network].horizonUrl);
}

export function getSorobanServer(network = 'testnet') {
  return new StellarSdk.SorobanRpc.Server(NETWORKS[network].sorobanUrl);
}

export async function fetchAccount(publicKey, network = 'testnet', identifier = 'anonymous') {
  const cacheKey = cache.generateKey('account', { id: publicKey, network });
  const server = getServer(network);
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, () => server.loadAccount(publicKey), CACHE_TTL.ACCOUNT)
  );
}

export async function fetchTransactions(publicKey, network = 'testnet', limit = 20, cursor = null, identifier = 'anonymous') {
  const cacheKey = cache.generateKey('transactions', { id: publicKey, network, limit, cursor });
  const server = getServer(network);
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, async () => {
      const request = server
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(limit);

      if (cursor) request.cursor(cursor);

      const txs = await request.call();
      const records = txs.records || [];
      const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null;

      return {
        records,
        nextCursor,
        hasMore: records.length === limit && !!nextCursor,
      };
    }, CACHE_TTL.TRANSACTIONS)
  );
}

export async function fetchOperations(publicKey, network = 'testnet', limit = 20, cursor = null, identifier = 'anonymous') {
  const cacheKey = cache.generateKey('operations', { id: publicKey, network, limit, cursor });
  const server = getServer(network);
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, async () => {
      const request = server
        .operations()
        .forAccount(publicKey)
        .order('desc')
        .limit(limit);

      if (cursor) request.cursor(cursor);

      const ops = await request.call();
      const records = ops.records || [];
      const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : null;

      return {
        records,
        nextCursor,
        hasMore: records.length === limit && !!nextCursor,
      };
    }, CACHE_TTL.TRANSACTIONS)
  );
}

export async function fetchAccountOffers(publicKey, network = 'testnet', identifier = 'anonymous') {
  const cacheKey = cache.generateKey('offers', { id: publicKey, network });
  const server = getServer(network);
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, () => server.offers().forAccount(publicKey).call(), CACHE_TTL.ASSET)
  );
}

export const OPERATION_LABELS = {
  create_account: 'Create Account',
  payment: 'Payment',
  path_payment_strict_send: 'Path Payment (Send)',
  path_payment_strict_receive: 'Path Payment (Receive)',
  manage_buy_offer: 'Buy Offer',
  manage_sell_offer: 'Sell Offer',
  create_passive_sell_offer: 'Create Passive Sell Offer',
  set_options: 'Set Options',
  change_trust: 'Change Trust',
  allow_trust: 'Allow Trust',
  account_merge: 'Account Merge',
  manage_data: 'Manage Data',
  bump_sequence: 'Bump Sequence',
  create_claimable_balance: 'Create Claimable Balance',
  claim_claimable_balance: 'Claim Claimable Balance',
  begin_sponsoring_future_reserves: 'Begin Sponsoring Future Reserves',
  end_sponsoring_future_reserves: 'End Sponsoring Future Reserves',
  revoke_sponsorship: 'Revoke Sponsorship',
  clawback: 'Clawback',
  clawback_claimable_balance: 'Clawback Claimable Balance',
  set_trust_line_flags: 'Set Trustline Flags',
  liquidity_pool_deposit: 'Liquidity Pool Deposit',
  liquidity_pool_withdraw: 'Liquidity Pool Withdraw',
  invoke_host_function: 'Contract Call',
  extend_footprint_ttl: 'Extend Footprint TTL',
  restore_footprint: 'Restore Footprint',
};

function titleCaseLabel(value) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function getOperationLabel(type) {
  return OPERATION_LABELS[type] || titleCaseLabel(type);
}

export async function fetchAccountCreationDate(publicKey, network = 'testnet', identifier = 'anonymous') {
  const server = getServer(network);
  const cacheKey = cache.generateKey('creationDate', { id: publicKey, network });

  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, async () => {
      try {
        const ops = await server
          .operations()
          .forAccount(publicKey)
          .order('asc')
          .limit(1)
          .call();

        const operation = ops.records[0];
        if (operation?.type !== 'create_account') return null;

        return operation.created_at || null;
      } catch {
        return null;
      }
    }, CACHE_TTL.ACCOUNT)
  );
}

export async function fetchNetworkStats(network = 'testnet', identifier = 'anonymous') {
  const cacheKey = cache.generateKey('networkStats', { network });
  const server = getServer(network);
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, async () => {
      const [ledger, feeStats] = await Promise.all([
        server.ledgers().order('desc').limit(1).call(),
        server.feeStats(),
      ]);
      return {
        latestLedger: ledger.records[0],
        feeStats,
      };
    }, CACHE_TTL.NETWORK)
  );
}

function parseTopOfBookPrice(levels = []) {
  const price = parseFloat(levels[0]?.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return price;
}

export async function fetchXLMPrice(identifier = 'anonymous') {
  const cacheKey = 'xlm_price';
  
  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, async () => {
      const response = await fetch(COINGECKO_XLM_PRICE_URL);

      if (!response.ok) {
        throw new Error(`XLM price request failed: ${response.status}`);
      }

      const data = await response.json();
      const usd = data?.stellar?.usd;

      if (!Number.isFinite(usd)) {
        throw new Error('XLM price data unavailable');
      }

      return {
        usd,
        source: 'coingecko',
      };
    }, CACHE_TTL.PRICE)
  );
}

export async function fetchAssetPrice(asset, network = 'testnet', identifier = 'anonymous') {
  if (!asset || asset.asset_type === 'native') return null;

  if (!asset.asset_type?.startsWith('credit_alphanum') || !asset.asset_code || !asset.asset_issuer) {
    return null;
  }

  const cacheKey = cache.generateKey('assetPrice', { code: asset.asset_code, issuer: asset.asset_issuer, network });
  const horizonUrl = NETWORKS[network].horizonUrl;

  return rateLimitedCall(identifier, () =>
    cachedCall(cacheKey, async () => {
      const params = new URLSearchParams({
        selling_asset_type: asset.asset_type,
        selling_asset_code: asset.asset_code,
        selling_asset_issuer: asset.asset_issuer,
        buying_asset_type: 'native',
      });

      const response = await fetch(`${horizonUrl}/order_book?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Order book request failed: ${response.status}`);
      }

      const orderBook = await response.json();
      const bestBid = parseTopOfBookPrice(orderBook.bids);
      const bestAsk = parseTopOfBookPrice(orderBook.asks);

      if (bestBid !== null && bestAsk !== null) {
        return {
          xlm: (bestBid + bestAsk) / 2,
          source: 'sdex',
          method: 'midpoint',
          bestBid,
          bestAsk,
        };
      }

      const fallback = bestBid ?? bestAsk;
      if (fallback === null) return null;

      return {
        xlm: fallback,
        source: 'sdex',
        method: bestBid !== null ? 'best_bid' : 'best_ask',
        bestBid,
        bestAsk,
      };
    }, CACHE_TTL.ASSET)
  );
}

export function streamLedgers(callback, network = 'testnet') {
  const server = getServer(network);
  return server
    .ledgers()
    .cursor('now')
    .stream({
      onmessage: (ledger) => callback(ledger),
      onerror: (error) => console.error('Ledger stream error:', error),
    });
}

export async function fundTestnetAccount(publicKey) {
  const res = await fetch(
    `${NETWORKS.testnet.faucetUrl}?addr=${publicKey}`
  );
  if (!res.ok) throw new Error('Faucet request failed');
  return await res.json();
}

export async function fetchContractInfo(contractId, network = 'testnet') {
  const server = getSorobanServer(network);
  try {
    const instance = await server.getContractData(
      contractId,
      StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
      StellarSdk.SorobanRpc.Durability.Persistent
    );
    return instance;
  } catch (e) {
    throw new Error(`Contract not found: ${e.message}`);
  }
}

function getLedgerKeyType(key) {
  const kind = key.switch();
  return kind?.name || kind?.toString?.() || 'unknown';
}

function serializeLedgerKey(key) {
  return {
    type: getLedgerKeyType(key),
    xdr: key.toXDR('base64'),
  };
}

function serializeScVal(value) {
  try {
    return StellarSdk.scValToNative(value);
  } catch {
    return value.toXDR('base64');
  }
}

function serializeDiagnosticEvent(event) {
  const contractEvent = event.event();
  const body = contractEvent.body().v0();
  const contractId = contractEvent.contractId();

  return {
    inSuccessfulContractCall: event.inSuccessfulContractCall(),
    type: contractEvent.type().name || contractEvent.type().toString(),
    contractId: contractId ? StellarSdk.Address.fromScAddress(contractId).toString() : null,
    topics: body.topics().map(serializeScVal),
    value: serializeScVal(body.data()),
  };
}

function parseContractArgument({ type, value }, index) {
  const trimmedValue = value?.trim?.() ?? '';

  if (trimmedValue === '') {
    throw new Error(`Argument ${index + 1} is empty`);
  }

  switch (type) {
    case 'string':
      return StellarSdk.nativeToScVal(trimmedValue, { type: 'string' });
    case 'int': {
      let parsed;
      try {
        parsed = BigInt(trimmedValue);
      } catch {
        throw new Error(`Argument ${index + 1} must be a valid integer`);
      }
      return StellarSdk.nativeToScVal(parsed, { type: 'i128' });
    }
    case 'address':
      try {
        return StellarSdk.Address.fromString(trimmedValue).toScVal();
      } catch {
        throw new Error(`Argument ${index + 1} must be a valid Stellar address`);
      }
    case 'bool':
      if (trimmedValue !== 'true' && trimmedValue !== 'false') {
        throw new Error(`Argument ${index + 1} must be true or false`);
      }
      return StellarSdk.nativeToScVal(trimmedValue === 'true', { type: 'bool' });
    default:
      throw new Error(`Unsupported argument type: ${type}`);
  }
}

async function buildContractInvocationTransaction({
  contractId,
  functionName,
  args = [],
  sourceAccount,
  network = 'testnet',
}) {
  if (!isValidContractId(contractId)) {
    throw new Error('Invalid contract address');
  }

  if (!functionName?.trim()) {
    throw new Error('Function name is required');
  }

  if (!isValidPublicKey(sourceAccount)) {
    throw new Error('A valid source account is required');
  }

  const horizon = getServer(network);
  const account = await horizon.loadAccount(sourceAccount);
  const contract = new StellarSdk.Contract(contractId.trim());
  const parsedArgs = args.map(parseContractArgument);

  return new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE.toString(),
    networkPassphrase: NETWORKS[network].passphrase,
  })
    .setTimeout(30)
    .addOperation(contract.call(functionName.trim(), ...parsedArgs))
    .build();
}

export async function simulateContractCall({
  contractId,
  functionName,
  args = [],
  sourceAccount,
  network = 'testnet',
}) {
  const server = getSorobanServer(network);
  const transaction = await buildContractInvocationTransaction({
    contractId,
    functionName,
    args,
    sourceAccount,
    network,
  });

  const simulation = await server.simulateTransaction(transaction);

  if (simulation.error) {
    throw new Error(simulation.error);
  }

  const footprint = simulation.transactionData
    ? {
        readOnly: simulation.transactionData.getReadOnly().map(serializeLedgerKey),
        readWrite: simulation.transactionData.getReadWrite().map(serializeLedgerKey),
        minResourceFee: simulation.minResourceFee,
      }
    : null;

  const events = simulation.events?.map(serializeDiagnosticEvent) || [];

  return {
    transaction,
    simulation,
    footprint,
    events,
    result: simulation.result?.retval ? serializeScVal(simulation.result.retval) : null,
  };
}

function isValidPublicKey(publicKey) {
  try {
    return StellarSdk.StrKey.isValidEd25519PublicKey(publicKey);
  } catch {
    return false;
  }
}

function isValidContractId(contractId) {
  try {
    StellarSdk.Address.fromString(contractId);
    return true;
  } catch {
    return false;
  }
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
  NETWORKS,
  getServer,
  getSorobanServer,
  fetchAccount,
  fetchTransactions,
  fetchOperations,
  fetchAccountOffers,
  fetchAccountCreationDate,
  fetchNetworkStats,
  fetchXLMPrice,
  fetchAssetPrice,
  streamLedgers,
  fundTestnetAccount,
  fetchContractInfo,
  simulateContractCall,
  getOperationLabel,
  clearCache,
  getCacheStats,
};