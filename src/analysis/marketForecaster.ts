export interface MarketIndicator {
  pair: string;
  currentPrice: number;
  volume24h: number;
  rsi: number;
  volatilityIndex: number;
}

export interface ForecastResult {
  pair: string;
  predictedTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  projectedPriceChangePct: number;
  confidenceScore: number;
  keyDrivers: string[];
}

export class StellarMarketForecaster {
  public calculateIndicators(prices: number[], volumes: number[], pair: string): MarketIndicator {
    const currentPrice = prices[prices.length - 1] || 0;
    const volume24h = volumes.reduce((acc, curr) => acc + curr, 0);

    // Simple Relative Strength Index (RSI) approximation
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    const avgGain = gains / Math.max(1, prices.length - 1);
    const avgLoss = losses / Math.max(1, prices.length - 1);
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = Math.round(100 - 100 / (1 + rs));

    // Simple volatility calculation (standard deviation)
    const meanPrice = prices.reduce((a, b) => a + b, 0) / Math.max(1, prices.length);
    const variance = prices.reduce((a, b) => a + Math.pow(b - meanPrice, 2), 0) / Math.max(1, prices.length);
    const volatilityIndex = parseFloat(Math.sqrt(variance).toFixed(4));

    return {
      pair,
      currentPrice,
      volume24h,
      rsi,
      volatilityIndex,
    };
  }

  public forecast(indicator: MarketIndicator): ForecastResult {
    let predictedTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let projectedPriceChangePct = 0;
    const keyDrivers: string[] = [];

    if (indicator.rsi < 30) {
      predictedTrend = 'BULLISH';
      projectedPriceChangePct = 4.5;
      keyDrivers.push('Oversold RSI condition (<30)');
    } else if (indicator.rsi > 70) {
      predictedTrend = 'BEARISH';
      projectedPriceChangePct = -3.8;
      keyDrivers.push('Overbought RSI condition (>70)');
    } else {
      predictedTrend = 'NEUTRAL';
      projectedPriceChangePct = 0.5;
      keyDrivers.push('Balanced RSI range (30-70)');
    }

    if (indicator.volume24h > 500000) {
      keyDrivers.push('High 24h trading volume activity');
    }

    const confidenceScore = Math.min(0.95, Math.max(0.6, 0.75 + (indicator.volume24h > 100000 ? 0.1 : 0)));

    return {
      pair: indicator.pair,
      predictedTrend,
      projectedPriceChangePct,
      confidenceScore,
      keyDrivers,
    };
  }
}