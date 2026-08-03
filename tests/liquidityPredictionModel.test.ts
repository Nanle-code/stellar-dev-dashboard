import { describe, it, expect } from 'vitest';
import {
  calculateLiquidityMetrics,
  generateLiquidityForecast,
  evaluateModelAccuracy,
  analyzeLargeTradeImpact,
  detectLiquidityAlerts,
  buildTradingRecommendations,
  predictLiquidityFlow,
} from '../src/ml/liquidityPredictionModel';

describe('Liquidity Flow Prediction Engine (#571)', () => {
  const sampleBids = [
    { price: '0.1200', amount: '10000' },
    { price: '0.1190', amount: '15000' },
    { price: '0.1180', amount: '20000' },
  ];

  const sampleAsks = [
    { price: '0.1205', amount: '8000' },
    { price: '0.1215', amount: '12000' },
    { price: '0.1225', amount: '18000' },
  ];

  const sampleTrades = [
    { base_amount: '5000', price: { n: 1205, d: 10000 } },
    { base_amount: '12000', price: { n: 1200, d: 10000 } },
    { base_amount: '2500', price: { n: 1206, d: 10000 } },
  ];

  it('calculates order book and trade flow liquidity metrics correctly', () => {
    const metrics = calculateLiquidityMetrics(sampleBids, sampleAsks, sampleTrades);
    expect(metrics.totalBidDepth).toBe(45000);
    expect(metrics.totalAskDepth).toBe(38000);
    expect(metrics.spreadPercent).toBeGreaterThan(0);
    expect(metrics.tradeCount).toBe(3);
  });

  it('generates 1-hour horizon liquidity forecasts with confidence bounds', () => {
    const metrics = calculateLiquidityMetrics(sampleBids, sampleAsks, sampleTrades);
    const forecast = generateLiquidityForecast(metrics, 1);
    expect(forecast.length).toBeGreaterThan(0);
    expect(forecast[0].timeLabel).toBe('Now');
    expect(forecast[forecast.length - 1].upperConfidence).toBeGreaterThan(
      forecast[forecast.length - 1].lowerConfidence
    );
  });

  it('verifies that model accuracy meets or exceeds the 75% hourly horizon requirement', () => {
    const metrics = calculateLiquidityMetrics(sampleBids, sampleAsks, sampleTrades);
    const accuracy = evaluateModelAccuracy(metrics);
    expect(accuracy.hourlyHorizonAccuracyPct).toBeGreaterThanOrEqual(75.0);
    expect(accuracy.directionalAccuracyPct).toBeGreaterThan(accuracy.hourlyHorizonAccuracyPct);
  });

  it('analyzes predictive large trade impact and whale indicators', () => {
    const metrics = calculateLiquidityMetrics(sampleBids, sampleAsks, sampleTrades);
    const impact = analyzeLargeTradeImpact(metrics, 25000);
    expect(impact.whaleImpactScore).toBeGreaterThanOrEqual(0);
    expect(impact.whaleImpactScore).toBeLessThanOrEqual(100);
    expect(impact.estimatedPriceImpactPct).toBeGreaterThan(0);
    expect(impact.absorptionTimeMinutes).toBeGreaterThan(0);
  });

  it('detects liquidity events and generates real-time alerts', () => {
    const metrics = calculateLiquidityMetrics(sampleBids, sampleAsks, sampleTrades);
    metrics.bookImbalance = 0.5; // force imbalance
    const alerts = detectLiquidityAlerts(metrics);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a) => a.type === 'IMBALANCE_SHIFT')).toBe(true);
  });

  it('builds actionable trading strategy recommendations with routing and timing', () => {
    const metrics = calculateLiquidityMetrics(sampleBids, sampleAsks, sampleTrades);
    const recommendations = buildTradingRecommendations(metrics, 15000);
    expect(recommendations.length).toBe(4);
    const routingRec = recommendations.find((r) => r.category === 'ROUTING');
    expect(routingRec).toBeDefined();
    expect(routingRec?.suggestedParams.ammPoolAllocationPct).toBeGreaterThan(0);
    expect(routingRec?.suggestedParams.orderBookAllocationPct).toBeGreaterThan(0);
  });

  it('runs full prediction pipeline for DEX trading pairs', async () => {
    const result = await predictLiquidityFlow('native', 'USDC:G...', { horizonHours: 1, tradeAmount: 10000 });
    expect(result.pair).toContain('XLM/USDC');
    expect(result.accuracy.hourlyHorizonAccuracyPct).toBeGreaterThanOrEqual(75.0);
    expect(result.forecastSeries.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
