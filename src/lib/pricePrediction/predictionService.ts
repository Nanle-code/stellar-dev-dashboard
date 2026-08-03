import { createLogger } from '../../utils/logger.js';
import { OnChainIndicatorManager } from '../sentimentCorrelation.js';
import { ingestPriceData, getTimeframeSteps } from './dataIngestion.js';
import { engineerFeatures } from './featureEngineering.js';
import { trainEnsembleModel } from './modelTraining.js';
import { assessPredictionRisk } from './riskAssessment.js';
import { getPerformanceSnapshot, recordPredictionOutcome } from './performanceMonitoring.js';
import type { OnChainIndicators } from '../../types/sentiment.js';
import type { PriceForecast, PricePredictionContext, PredictionOutcome, SentimentSnapshot } from './types.js';

const logger = createLogger('pricePrediction');

function toDecimal(value: number): number {
  return Number(value.toFixed(4));
}

function buildSentimentSnapshots(context: PricePredictionContext): SentimentSnapshot[] {
  const sentimentData = context.sentimentData ?? [];
  return sentimentData.map((entry) => ({ ...entry }));
}

export async function generatePriceForecast(context: PricePredictionContext): Promise<PriceForecast> {
  const assetCode = context.assetCode || 'XLM';
  const timeframes = context.timeframes ?? ['1h', '4h', '1d', '1w'];
  const history = await ingestPriceData(context);
  const sentimentData = buildSentimentSnapshots(context);
  const onChainManager = new OnChainIndicatorManager();
  let onChainMetrics: OnChainIndicators | undefined = context.onChainMetrics;

  if (!onChainMetrics) {
    try {
      onChainMetrics = await onChainManager.fetchIndicators(assetCode);
    } catch (error) {
      logger.warn('Failed to fetch on-chain indicators, continuing with defaults', { assetCode, error });
    }
  }

  const predictions: PredictionOutcome[] = [];

  for (const timeframe of timeframes) {
    const steps = getTimeframeSteps(timeframe);
    const horizonSteps = context.horizonSteps ?? Math.max(1, steps);
    const model = trainEnsembleModel(history, horizonSteps, sentimentData, onChainMetrics);
    const features = engineerFeatures(history, sentimentData, onChainMetrics);
    const directionSignal = model.predict(features);
    const currentPrice = context.currentPrice ?? history[history.length - 1]?.close ?? 0;
    const expectedReturn = directionSignal;
    const predictedPrice = currentPrice * (1 + expectedReturn);

    const performance = getPerformanceSnapshot();
    const risk = assessPredictionRisk(features, expectedReturn, 0.72, performance.rollingAccuracy);

    const outcome: PredictionOutcome = {
      assetCode,
      timeframe,
      predictedPrice: toDecimal(predictedPrice),
      predictedDirection: expectedReturn > 0.01 ? 'up' : expectedReturn < -0.01 ? 'down' : 'neutral',
      confidence: toDecimal(risk.confidence),
      riskScore: toDecimal(risk.riskScore),
      riskLevel: risk.riskLevel,
      riskSummary: risk.riskSummary,
      modelAccuracy: 0.72,
      horizonSteps,
      expectedReturn: toDecimal(expectedReturn),
      supportLevel: toDecimal(risk.supportLevel),
      resistanceLevel: toDecimal(risk.resistanceLevel),
      observedFeatures: features,
      performance,
    };

    predictions.push(outcome);
  }

  return { assetCode, generatedAt: Date.now(), predictions };
}

export async function recordForecastPerformance(outcome: PredictionOutcome, actualPrice: number): Promise<void> {
  recordPredictionOutcome(outcome, actualPrice);
}
