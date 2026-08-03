import type { OnChainIndicators } from '../../types/sentiment';
import type { FeatureSet, PricePoint, SentimentSnapshot, TrainingRow } from './types.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function calculateSma(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function calculateEma(values: number[], period: number): number {
  if (!values.length) return 0;
  const multiplier = 2 / (period + 1);
  let ema = values[0];
  for (let index = 1; index < values.length; index += 1) {
    ema = (values[index] * multiplier) + (ema * (1 - multiplier));
  }
  return ema;
}

function calculateRsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMacd(values: number[]): { macd: number; signal: number } {
  const ema12 = calculateEma(values, 12);
  const ema26 = calculateEma(values, 26);
  const macd = ema12 - ema26;
  const signal = macd;
  return { macd, signal };
}

function calculateBollinger(values: number[], period = 20): { upper: number; lower: number } {
  if (values.length < period) {
    const value = values[values.length - 1] ?? 0;
    return { upper: value, lower: value };
  }

  const slice = values.slice(-period);
  const mean = slice.reduce((sum, value) => sum + value, 0) / period;
  const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: mean + std * 2,
    lower: mean - std * 2,
  };
}

function getSentimentSignals(sentimentData: SentimentSnapshot[]): { score: number; momentum: number } {
  if (!sentimentData.length) return { score: 0, momentum: 0 };
  const latest = sentimentData[sentimentData.length - 1];
  const previous = sentimentData[sentimentData.length - 2];
  return {
    score: latest.score * latest.confidence,
    momentum: previous ? latest.score - previous.score : 0,
  };
}

function buildFeatureVector(featureSet: FeatureSet): number[] {
  return [
    featureSet.returns,
    featureSet.sma7,
    featureSet.sma20,
    featureSet.ema12,
    featureSet.ema26,
    featureSet.rsi,
    featureSet.macd,
    featureSet.signal,
    featureSet.bbUpper,
    featureSet.bbLower,
    featureSet.volatility,
    featureSet.momentum,
    featureSet.volumeMa,
    featureSet.volumeChange,
    featureSet.sentimentScore,
    featureSet.sentimentMomentum,
    featureSet.onChainMomentum,
    featureSet.activeAddresses,
    featureSet.tradeVolume,
    featureSet.whaleConcentration,
    featureSet.netFlow,
  ];
}

export function engineerFeatures(
  history: PricePoint[],
  sentimentData: SentimentSnapshot[] = [],
  onChainMetrics?: OnChainIndicators,
): FeatureSet {
  const closes = history.map((point) => point.close);
  const returns = history.map((point, index) => {
    const previous = history[index - 1];
    if (!previous || previous.close <= 0) return 0;
    return (point.close - previous.close) / previous.close;
  });
  const sentiment = getSentimentSignals(sentimentData);
  const lastClose = history[history.length - 1]?.close ?? 0;
  const previousClose = history[history.length - 2]?.close ?? lastClose;
  const momentumValue = previousClose > 0 ? (lastClose - previousClose) / previousClose : 0;
  const volatility = returns.length > 1
    ? Math.sqrt(returns.slice(-20).reduce((sum, value) => sum + value ** 2, 0) / Math.max(1, returns.slice(-20).length))
    : 0;

  const bb = calculateBollinger(closes, 20);
  const macdSignals = calculateMacd(closes);
  const volumeValues = history.map((point) => point.volume);
  const volumeMa = calculateSma(volumeValues, 10);
  const volumeChange = history.length > 1
    ? ((history[history.length - 1].volume || 0) - (history[history.length - 2].volume || 0)) / Math.max(1, history[history.length - 2].volume || 1)
    : 0;

  return {
    timestamp: history[history.length - 1]?.timestamp ?? Date.now(),
    close: lastClose,
    returns: returns[returns.length - 1] ?? 0,
    sma7: calculateSma(closes, 7),
    sma20: calculateSma(closes, 20),
    ema12: calculateEma(closes, 12),
    ema26: calculateEma(closes, 26),
    rsi: calculateRsi(closes, 14),
    macd: macdSignals.macd,
    signal: macdSignals.signal,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    volatility: clamp(volatility * 100, 0, 1),
    momentum: momentumValue,
    volumeMa,
    volumeChange: clamp(volumeChange, -1, 1),
    sentimentScore: sentiment.score,
    sentimentMomentum: sentiment.momentum,
    onChainMomentum: onChainMetrics ? ((onChainMetrics.tradeVolume24h || 0) / Math.max(1, onChainMetrics.activeAddresses24h || 1)) / 100000 : 0,
    activeAddresses: onChainMetrics?.activeAddresses24h ?? 0,
    tradeVolume: onChainMetrics?.tradeVolume24h ?? 0,
    whaleConcentration: onChainMetrics?.whale_concentration ?? 0,
    netFlow: onChainMetrics?.netFlowExchanges ?? 0,
  };
}

export function buildTrainingRows(
  history: PricePoint[],
  horizonSteps: number,
  sentimentData: SentimentSnapshot[] = [],
  onChainMetrics?: OnChainIndicators,
): TrainingRow[] {
  if (history.length < 30) return [];

  const rows: TrainingRow[] = [];
  for (let index = 20; index < history.length - horizonSteps; index += 1) {
    const window = history.slice(index - 20, index + 1);
    const featureSet = engineerFeatures(window, sentimentData.filter((entry) => entry.timestamp <= history[index].timestamp), onChainMetrics);
    const target = (history[index + horizonSteps].close - history[index].close) / Math.max(1, history[index].close);
    rows.push({ features: buildFeatureVector(featureSet), target });
  }

  return rows;
}

export function getFeatureVector(featureSet: FeatureSet): number[] {
  return buildFeatureVector(featureSet);
}
