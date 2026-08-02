import type { FeatureSet, PredictionOutcome } from './types.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function assessPredictionRisk(
  features: FeatureSet,
  expectedReturn: number,
  modelAccuracy: number,
  rollingAccuracy: number,
): Pick<PredictionOutcome, 'confidence' | 'riskScore' | 'riskLevel' | 'riskSummary' | 'supportLevel' | 'resistanceLevel'> {
  const volatilityRisk = clamp(features.volatility * 1.8, 0, 0.7);
  const sentimentRisk = clamp(Math.abs(features.sentimentScore) * 0.2 + Math.abs(features.sentimentMomentum) * 0.15, 0, 0.35);
  const regimeRisk = (features.rsi > 70 || features.rsi < 30 ? 0.15 : 0) + (features.macd < features.signal ? 0.08 : 0);
  const modelRisk = clamp(1 - modelAccuracy, 0, 0.45);
  const performanceRisk = clamp(1 - rollingAccuracy, 0, 0.25);
  const riskScore = clamp(volatilityRisk + sentimentRisk + regimeRisk + modelRisk + performanceRisk, 0, 1);

  const riskLevel = riskScore > 0.75 ? 'high' : riskScore > 0.45 ? 'medium' : 'low';
  const confidence = clamp(1 - riskScore + (expectedReturn === 0 ? 0.05 : 0), 0.05, 0.98);

  const supportLevel = Math.min(features.bbLower, features.sma20);
  const resistanceLevel = Math.max(features.bbUpper, features.sma20);

  let riskSummary = 'Market conditions appear balanced with moderate confidence.';
  if (riskLevel === 'high') {
    riskSummary = 'Volatility and weak historical fit point to a higher chance of an unexpected trend reversal.';
  } else if (riskLevel === 'medium') {
    riskSummary = 'The prediction remains actionable, but recent sentiment and volatility warrant cautious positioning.';
  }

  return {
    confidence,
    riskScore,
    riskLevel,
    riskSummary,
    supportLevel,
    resistanceLevel,
  };
}
