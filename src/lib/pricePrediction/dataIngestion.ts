import { fetchPrices } from '../priceFeed.js';
import type { PricePoint, PricePredictionContext, PricePredictionTimeframe } from './types.js';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3/coins';
const ASSET_ID_MAP: Record<string, string> = {
  XLM: 'stellar',
  native: 'stellar',
  USDC: 'usd-coin',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  AQUA: 'aquarius',
  yXLM: 'stellar',
  SHX: 'stronghold-token',
};

function normalizePriceSeries(series: PricePoint[]): PricePoint[] {
  const sorted = [...series].sort((a, b) => a.timestamp - b.timestamp);

  return sorted.filter((point, index) => {
    if (!Number.isFinite(point.close)) return false;
    const previous = sorted[index - 1];
    return !previous || previous.timestamp !== point.timestamp;
  });
}

async function fetchHistoricalPrices(assetCode: string, days = 180): Promise<PricePoint[]> {
  const assetId = ASSET_ID_MAP[assetCode] || ASSET_ID_MAP[assetCode.toUpperCase()];
  if (!assetId) return [];

  const url = `${COINGECKO_BASE}/${assetId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Historical price fetch failed with ${response.status}`);
  }

  const payload = await response.json();
  const prices = Array.isArray(payload.prices) ? payload.prices : [];
  const volumes = Array.isArray(payload.total_volumes) ? payload.total_volumes : [];

  return prices.map(([timestamp, price]: [number, number], index: number) => {
    const volume = volumes[index]?.[1] ?? 0;
    return {
      timestamp,
      open: price,
      high: price,
      low: price,
      close: price,
      volume,
    };
  });
}

export async function ingestPriceData(context: PricePredictionContext): Promise<PricePoint[]> {
  const history = context.history ? normalizePriceSeries(context.history) : [];
  if (history.length) {
    return history;
  }

  try {
    const timeframeDays = context.timeframe === '1w' ? 365 : context.timeframe === '1d' ? 180 : context.timeframe === '4h' ? 90 : 30;
    const fetched = await fetchHistoricalPrices(context.assetCode, timeframeDays);
    return normalizePriceSeries(fetched);
  } catch (error) {
    console.warn(`[pricePrediction] Falling back to live price feed for ${context.assetCode}`, error);
  }

  try {
    const livePrice = await fetchPrices([context.assetCode], { currency: 'usd' });
    const currentPrice = livePrice[context.assetCode]?.usd ?? context.currentPrice;
    if (typeof currentPrice === 'number' && Number.isFinite(currentPrice)) {
      return [{
        timestamp: Date.now(),
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: 0,
      }];
    }
  } catch {
    // Ignore and return an empty series so the downstream pipeline can degrade gracefully.
  }

  return [];
}

export function getTimeframeSteps(timeframe: PricePredictionTimeframe): number {
  switch (timeframe) {
    case '1h':
      return 1;
    case '4h':
      return 2;
    case '1d':
      return 3;
    default:
      return 7;
  }
}
