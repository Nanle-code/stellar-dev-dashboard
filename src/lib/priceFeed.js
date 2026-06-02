import { CacheManager, TTL, priceCacheManager } from './cacheManager';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
// Map of common Stellar asset codes to CoinGecko IDs
const ASSET_ID_MAP = {
  XLM: 'stellar',
  native: 'stellar',
  USDC: 'usd-coin',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  AQUA: 'aquarius',
  yXLM: 'stellar',
  SHX: 'stronghold-token',
};

/**
 * Fetch current prices for a list of asset codes.
 * Returns an object keyed by asset code with { usd, usd_24h_change } values.
 */
export async function fetchPrices(assetCodes = ['XLM'], options = {}) {
  const currency = (options.currency || 'usd').toLowerCase();
  const forceRefresh = options.forceRefresh === true;

  const geckoIds = new Set();
  const codeToId = {};

  for (const code of assetCodes) {
    const id = ASSET_ID_MAP[code] || ASSET_ID_MAP[String(code).toUpperCase()];
    if (id) {
      geckoIds.add(id);
      codeToId[code] = id;
    }
  }

  if (geckoIds.size === 0) return {};

  const ids = Array.from(geckoIds).sort().join(',');
  const cacheKey = CacheManager.key('coingecko-prices', {
    assetIds: ids,
    currency,
  });

  const fetchFreshPrices = async () => {
    const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(
      ids
    )}&vs_currencies=${encodeURIComponent(currency)}&include_24hr_change=true`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Price API error: ${response.status}`);
    }

    const data = await response.json();

    const prices = {};
    for (const code of assetCodes) {
      const id = codeToId[code];
      if (id && data[id]) {
        prices[code] = {
          usd: data[id][currency] ?? null,
          usd_24h_change: data[id][`${currency}_24h_change`] ?? null,
        };
      }
    }

    return prices;
  };

  try {
    return await priceCacheManager.swr(cacheKey, fetchFreshPrices, {
      ttl: TTL.ASSET,
      force: forceRefresh,
      tags: ['asset-prices', currency, ...Array.from(geckoIds)],
    });
  } catch (error) {
    console.warn('[priceFeed] Failed to fetch asset prices', error);
    return {};
  }
}

/**
 * Fetch the XLM price only (most common use case).
 */
export async function fetchXLMPrice(options = {}) {
  const prices = await fetchPrices(['XLM'], options);
  return prices.XLM || { usd: null, usd_24h_change: null };
}

/**
 * Calculate portfolio value in USD from account balances and prices.
 */
export function calculatePortfolioValue(balances, prices) {
  if (!balances || !prices) return null;

  let totalUsd = 0;
  const items = [];

  for (const balance of balances) {
    const code = balance.asset_type === 'native' ? 'XLM' : balance.asset_code;
    const amount = parseFloat(balance.balance) || 0;
    const price = prices[code];

    if (price && price.usd !== null) {
      const usdValue = amount * price.usd;
      totalUsd += usdValue;
      items.push({
        code,
        amount,
        priceUsd: price.usd,
        valueUsd: usdValue,
        change24h: price.usd_24h_change,
      });
    } else {
      items.push({
        code,
        amount,
        priceUsd: null,
        valueUsd: null,
        change24h: null,
      });
    }
  }

  return { totalUsd, items };
}
export async function refreshPrices(assetCodes = ['XLM'], currency = 'usd') {
  return fetchPrices(assetCodes, {
    currency,
    forceRefresh: true,
  });
}

export async function clearPriceCache() {
  await priceCacheManager.invalidateTag('asset-prices');
}
