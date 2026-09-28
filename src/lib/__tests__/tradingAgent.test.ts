import { describe, expect, it } from 'vitest';
import {
  buildTradePlan,
  calculatePositionSize,
  optimizeStrategyWeights,
  createDefaultAgentConfig,
  createInitialAgentState,
} from '../tradingAgent';

describe('tradingAgent', () => {
  it('calculates a capped position size from risk budget and stop-loss distance', () => {
    const size = calculatePositionSize(100, 92, 240, 5000);
    expect(size).toBe(1200);
  });

  it('produces a bullish plan when momentum and trend align', () => {
    const plan = buildTradePlan(
      {
        symbol: 'XLM',
        price: 0.12,
        trend: 0.8,
        momentum: 0.75,
        volatility: 0.12,
        volume: 0.6,
        sentiment: 0.7,
      },
      createDefaultAgentConfig(),
      createInitialAgentState(10000)
    );

    expect(plan.action).toBe('buy');
    expect(plan.confidence).toBeGreaterThan(0.6);
    expect(plan.positionSize).toBeGreaterThan(0);
  });

  it('improves strategy weights after profitable trades', () => {
    const initial = createInitialAgentState(10000);
    const updated = optimizeStrategyWeights(
      {
        symbol: 'XLM',
        action: 'buy',
        realizedPnl: 180,
        returnPct: 0.018,
      },
      initial,
      createDefaultAgentConfig()
    );

    expect(updated.strategyWeights.trend).toBeGreaterThan(initial.strategyWeights.trend);
    expect(updated.winRate).toBeGreaterThan(0.5);
    expect(updated.totalTrades).toBe(1);
  });
});
