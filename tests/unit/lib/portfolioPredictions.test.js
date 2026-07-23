import { describe, expect, it } from 'vitest';
import {
  evaluatePredictionAlerts,
  generatePortfolioPredictions,
} from '../../../src/lib/portfolioAnalytics';

const baseHistory = Array.from({ length: 31 }, (_, index) => ({
  timestamp: Date.UTC(2026, 5, 1 + index),
  date: new Date(Date.UTC(2026, 5, 1 + index)).toISOString().slice(0, 10),
  value: 1000 * Math.pow(1.006, index),
}));

describe('portfolio value predictions', () => {
  it('generates multi-horizon predictions with 80% confidence intervals and daily updates', () => {
    const summary = generatePortfolioPredictions({
      historicalData: baseHistory,
      portfolioItems: [{ code: 'XLM', valueUsd: 1200 }],
      marketConditions: { priceMomentum: 2, volatility: 4, liquidityScore: 75, sentimentScore: 62 },
      networkActivity: { operationGrowth: 3, activeAccountGrowth: 2, feePressure: 1, ledgerUtilization: 66 },
      generatedAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(summary.predictions.map((prediction) => prediction.horizonDays)).toEqual([1, 7, 14, 30]);
    expect(summary.modelAccuracy).toBeGreaterThanOrEqual(80);
    expect(summary.nextUpdateAt).toBe('2026-07-02T00:00:00.000Z');
    expect(summary.sevenDay.lowerBound).toBeLessThan(summary.sevenDay.predictedValue);
    expect(summary.sevenDay.upperBound).toBeGreaterThan(summary.sevenDay.predictedValue);
  });

  it('evaluates user-configured prediction alerts', () => {
    const summary = generatePortfolioPredictions({
      historicalData: baseHistory,
      portfolioItems: [{ code: 'XLM', valueUsd: 1200 }],
      marketConditions: { priceMomentum: 18, volatility: 2, liquidityScore: 80, sentimentScore: 85 },
      networkActivity: { operationGrowth: 10, activeAccountGrowth: 8 },
      horizons: [7],
    });

    const alerts = evaluatePredictionAlerts(summary, { gainPercent: 5, dropPercent: 5, confidenceRequired: 60 });

    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('opportunity');
    expect(alerts[0].message).toContain('7-day prediction');
  });
});
