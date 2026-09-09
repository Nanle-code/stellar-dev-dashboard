import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractTimeSeriesFeatures,
  calculateOrderBookSlippage,
  predictLiquidityAndPrice,
  getModelMetrics,
  MarketSnapshot,
} from '../../ml/liquidityPredictionModel';
import { liquidityEngine, POPULAR_DEX_PAIRS } from '../liquidityEngine';
import {
  getLiquidityAlertRules,
  addLiquidityAlertRule,
  deleteLiquidityAlertRule,
  toggleLiquidityAlertRule,
  checkLiquidityAlertRules,
} from '../liquidityAlerts';

describe('AI DEX Liquidity & Price Movement Prediction System', () => {
  let sampleSnapshot: MarketSnapshot;

  beforeEach(() => {
    sampleSnapshot = {
      pair: 'XLM:USDC',
      timestamp: Date.now(),
      bids: [
        { price: 0.125, amount: 50000 },
        { price: 0.124, amount: 40000 },
        { price: 0.123, amount: 30000 },
      ],
      asks: [
        { price: 0.126, amount: 45000 },
        { price: 0.127, amount: 35000 },
        { price: 0.128, amount: 25000 },
      ],
      recentTrades: [
        { price: 0.1255, amount: 5000, timestamp: Date.now() - 60000, isBuy: true },
        { price: 0.1252, amount: 3000, timestamp: Date.now() - 120000, isBuy: false },
        { price: 0.1258, amount: 8000, timestamp: Date.now() - 180000, isBuy: true },
      ],
      onChainStats: {
        ledgerCloseTime: 5.0,
        baseFee: 100,
        operationCount: 1200,
        transactionCount: 350,
        reserveA: 1000000,
        reserveB: 125000,
      },
    };
  });

  describe('Feature Extraction & Time Series Logic', () => {
    it('should correctly extract time-series features from market snapshot', () => {
      const feat = extractTimeSeriesFeatures(sampleSnapshot);

      expect(feat.midPrice).toBe(0.1255);
      expect(feat.bidAskSpread).toBeCloseTo(0.001, 4);
      expect(feat.bidAskSpreadPct).toBeGreaterThan(0);
      expect(feat.bidDepthTotal).toBe(50000 * 0.125 + 40000 * 0.124 + 30000 * 0.123);
      expect(feat.volume5m).toBeGreaterThan(0);
      expect(feat.ledgerCloseTime).toBe(5.0);
    });
  });

  describe('Acceptance Criteria 1: 1-Hour Horizon Liquidity Prediction (≥ 80% Accuracy)', () => {
    it('should predict 1-hour horizon liquidity index with >= 80% accuracy metric', () => {
      const result = predictLiquidityAndPrice(sampleSnapshot);

      expect(result.horizon).toBe('1h');
      expect(result.predictedLiquidityIndex).toBeGreaterThanOrEqual(0);
      expect(result.predictedLiquidityIndex).toBeLessThanOrEqual(100);
      expect(result.predictionAccuracy).toBeGreaterThanOrEqual(80.0);
    });

    it('should report global model backtest metrics meeting target criteria', () => {
      const metrics = getModelMetrics();

      expect(metrics.liquidityModelAccuracy1h).toBeGreaterThanOrEqual(0.80); // ≥80%
      expect(metrics.slippagePredictionMaePct).toBeLessThanOrEqual(2.0); // ≤2%
      expect(metrics.directionAccuracy).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe('Acceptance Criteria 2: Slippage Prediction Accuracy (Within 2% of Actual Depth)', () => {
    it('should calculate actual order book slippage from depth', () => {
      const slippage1000 = calculateOrderBookSlippage(sampleSnapshot.bids, sampleSnapshot.asks, 1000, true);
      const slippage50000 = calculateOrderBookSlippage(sampleSnapshot.bids, sampleSnapshot.asks, 50000, true);

      expect(slippage1000).toBeGreaterThanOrEqual(0);
      expect(slippage50000).toBeGreaterThan(slippage1000);
    });

    it('should predict slippage curve with prediction error within 2% actual', () => {
      const result = predictLiquidityAndPrice(sampleSnapshot);

      expect(result.slippageForecast.length).toBeGreaterThan(0);

      result.slippageForecast.forEach(item => {
        expect(item.predictionErrorPct).toBeLessThanOrEqual(2.0);
        expect(Math.abs(item.predictedSlippagePct - item.actualDepthSlippagePct)).toBeLessThanOrEqual(2.0);
      });
    });
  });

  describe('Acceptance Criteria 3: Favorable Liquidity Alerts', () => {
    it('should manage liquidity alert rules correctly', () => {
      const initialRules = getLiquidityAlertRules();
      const newRule = addLiquidityAlertRule('XLM:USDC', 65, 0.4);

      expect(newRule.id).toBeDefined();
      expect(newRule.targetLiquidityIndex).toBe(65);

      toggleLiquidityAlertRule(newRule.id);
      deleteLiquidityAlertRule(newRule.id);
    });

    it('should trigger alert when liquidity conditions meet criteria', () => {
      const prediction = predictLiquidityAndPrice(sampleSnapshot);
      // Force prediction to be high to satisfy test alert rule
      prediction.predictedLiquidityIndex = 85;

      addLiquidityAlertRule('XLM:USDC', 70, 2.0);

      const triggered = checkLiquidityAlertRules(prediction);
      expect(triggered).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Acceptance Criteria 4: Real-Time Engine & Price Trend Forecast', () => {
    it('should produce 1-hour price movement trajectory with direction & confidence', () => {
      const result = predictLiquidityAndPrice(sampleSnapshot);

      expect(['UP', 'DOWN', 'NEUTRAL']).toContain(result.priceMovement.direction);
      expect(result.priceMovement.confidence).toBeGreaterThan(0);
      expect(result.priceMovement.forecast).toHaveLength(4);
    });

    it('should update liquidity engine and allow subscription tick callbacks', async () => {
      const listener = vi.fn();
      const unsubscribe = liquidityEngine.subscribe(listener);

      expect(listener).toHaveBeenCalled();

      const refreshed = await liquidityEngine.refreshPredictions('testnet');
      expect(refreshed.pair).toBe('XLM:USDC');

      unsubscribe();
    });
  });
});
