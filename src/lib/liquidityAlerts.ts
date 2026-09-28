/**
 * Liquidity Condition Alerts Integration
 * Stellar Dev Dashboard
 */

import { LiquidityPredictionResult } from '../ml/liquidityPredictionModel';
import { useStore } from './store';

export interface LiquidityAlertRule {
  id: string;
  pair: string;
  targetLiquidityIndex: number; // e.g. 70
  maxSlippagePct?: number; // e.g. 0.5%
  enabled: boolean;
  createdAt: number;
  lastTriggeredAt?: number;
}

const STORAGE_KEY = 'stellar_liquidity_alert_rules';

export function getLiquidityAlertRules(): LiquidityAlertRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [
        {
          id: 'rule-xlm-usdc-high-liq',
          pair: 'XLM:USDC',
          targetLiquidityIndex: 70,
          maxSlippagePct: 0.5,
          enabled: true,
          createdAt: Date.now() - 86400000,
        },
      ];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLiquidityAlertRules(rules: LiquidityAlertRule[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (err) {
    console.error('Failed to save liquidity alert rules', err);
  }
}

export function addLiquidityAlertRule(pair: string, targetLiquidityIndex: number, maxSlippagePct?: number): LiquidityAlertRule {
  const rules = getLiquidityAlertRules();
  const newRule: LiquidityAlertRule = {
    id: `liq-alert-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    pair,
    targetLiquidityIndex,
    maxSlippagePct,
    enabled: true,
    createdAt: Date.now(),
  };
  rules.push(newRule);
  saveLiquidityAlertRules(rules);
  return newRule;
}

export function deleteLiquidityAlertRule(ruleId: string) {
  const rules = getLiquidityAlertRules().filter(r => r.id !== ruleId);
  saveLiquidityAlertRules(rules);
}

export function toggleLiquidityAlertRule(ruleId: string) {
  const rules = getLiquidityAlertRules();
  const rule = rules.find(r => r.id === ruleId);
  if (rule) {
    rule.enabled = !rule.enabled;
    saveLiquidityAlertRules(rules);
  }
}

/**
 * Checks incoming prediction against enabled rules and dispatches notifications when favorable liquidity conditions are met.
 */
export function checkLiquidityAlertRules(prediction: LiquidityPredictionResult): number {
  const rules = getLiquidityAlertRules().filter(r => r.enabled && r.pair === prediction.pair);
  const now = Date.now();
  let triggeredCount = 0;

  for (const rule of rules) {
    // Cooldown check (don't alert more than once per 10 minutes per rule)
    if (rule.lastTriggeredAt && now - rule.lastTriggeredAt < 10 * 60 * 1000) {
      continue;
    }

    const liquidityMet = prediction.predictedLiquidityIndex >= rule.targetLiquidityIndex;
    const $1000Forecast = prediction.slippageForecast.find(s => s.orderSizeUsd === 1000);
    const slippageMet = !rule.maxSlippagePct || ($1000Forecast && $1000Forecast.predictedSlippagePct <= rule.maxSlippagePct);

    if (liquidityMet && slippageMet) {
      // Trigger notification in Zustand store
      const addNotification = useStore.getState().addNotification;
      if (typeof addNotification === 'function') {
        addNotification({
          type: 'success',
          title: `Favorable Liquidity: ${prediction.pair}`,
          message: `1-Hour Liquidity Index forecast reached ${prediction.predictedLiquidityIndex}/100. Expected slippage for $1,000 trade: ${$1000Forecast ? $1000Forecast.predictedSlippagePct : 0.2}%. ${prediction.optimalTradingWindow.recommendation}`,
        });
      }

      rule.lastTriggeredAt = now;
      triggeredCount++;
    }
  }

  if (triggeredCount > 0) {
    saveLiquidityAlertRules(getLiquidityAlertRules());
  }

  return triggeredCount;
}
