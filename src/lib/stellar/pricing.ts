import { TTL } from '../cache.js';
import { NETWORKS, stellarCache, withNetworkHeaders, type NetworkName } from './networks.js';

const COINGECKO_XLM_PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd';

export interface XLMPrice {
  usd: number;
  source: 'coingecko';
}

export interface AssetPriceEstimate {
  xlm: number;
  source: 'sdex';
  method: 'midpoint' | 'best_bid' | 'best_ask';
  bestBid: number | null;
  bestAsk: number | null;
}

export interface AssetBalanceLike {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}

function parseTopOfBookPrice(levels: Array<{ price?: string }> = []): number | null {
  const price = parseFloat(levels[0]?.price ?? '');
  if (!Number.isFinite(price) || price <= 0) return null;
  return price;
}

export async function fetchXLMPrice(): Promise<XLMPrice> {
  const cacheKey = 'xlm-price';
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(COINGECKO_XLM_PRICE_URL);

  if (!response.ok) {
    throw new Error(`XLM price request failed: ${response.status}`);
  }

  const data = await response.json();
  const usd = data?.stellar?.usd;

  if (!Number.isFinite(usd)) {
    throw new Error('XLM price data unavailable');
  }

  const result: XLMPrice = {
    usd,
    source: 'coingecko',
  };
  stellarCache.set(cacheKey, result, TTL.PRICE, ['price', 'xlm']);
  return result;
}

export async function fetchAssetPrice(
  asset: AssetBalanceLike,
  network: NetworkName = 'testnet'
): Promise<AssetPriceEstimate | null> {
  if (!asset || asset.asset_type === 'native') return null;

  if (!asset.asset_type.startsWith('credit_alphanum') || !asset.asset_code || !asset.asset_issuer) {
    return null;
  }

  const cacheKey = `asset-price:${asset.asset_code}:${asset.asset_issuer}:${network}`;
  const cached = stellarCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    selling_asset_type: asset.asset_type,
    selling_asset_code: asset.asset_code,
    selling_asset_issuer: asset.asset_issuer,
    buying_asset_type: 'native',
  });

  const response = await fetch(
    `${NETWORKS[network].horizonUrl}/order_book?${params.toString()}`,
    withNetworkHeaders({}, network)
  );

  if (!response.ok) {
    throw new Error(`Order book request failed: ${response.status}`);
  }

  const orderBook = await response.json();
  const bestBid = parseTopOfBookPrice(orderBook.bids);
  const bestAsk = parseTopOfBookPrice(orderBook.asks);

  let result: AssetPriceEstimate | null = null;

  if (bestBid !== null && bestAsk !== null) {
    result = {
      xlm: (bestBid + bestAsk) / 2,
      source: 'sdex',
      method: 'midpoint',
      bestBid,
      bestAsk,
    };
  } else {
    const fallback = bestBid ?? bestAsk;
    if (fallback !== null) {
      result = {
        xlm: fallback,
        source: 'sdex',
        method: bestBid !== null ? 'best_bid' : 'best_ask',
        bestBid,
        bestAsk,
      };
    }
  }

  if (result) {
    stellarCache.set(cacheKey, result, TTL.ASSET, ['price', asset.asset_code]);
  }
  return result;
}
