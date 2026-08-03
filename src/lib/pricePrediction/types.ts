import type { OnChainIndicators } from '../../types/sentiment';

export type PricePredictionTimeframe = '1h' | '4h' | '1d' | '1w';

export interface PricePoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SentimentSnapshot {
  timestamp: number;
  score: number;
  confidence: number;
}

export interface PricePredictionContext {
  assetCode: string;
  timeframe: PricePredictionTimeframe;
  history?: PricePoint[];
  onChainMetrics?: OnChainIndicators;
  sentimentData?: SentimentSnapshot[];
  currentPrice?: number;
  horizonSteps?: number;
  timeframes?: PricePredictionTimeframe[];
}

export interface FeatureSet {
  timestamp: number;
  close: number;
  returns: number;
  sma7: number;
  sma20: number;
  ema12: number;
  ema26: number;
  rsi: number;
  macd: number;
  signal: number;
  bbUpper: number;
  bbLower: number;
  volatility: number;
  momentum: number;
  volumeMa: number;
  volumeChange: number;
  sentimentScore: number;
  sentimentMomentum: number;
  onChainMomentum: number;
  activeAddresses: number;
  tradeVolume: number;
  whaleConcentration: number;
  netFlow: number;
}

export interface PredictionOutcome {
  assetCode: string;
  timeframe: PricePredictionTimeframe;
  predictedPrice: number;
  predictedDirection: 'up' | 'down' | 'neutral';
  confidence: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskSummary: string;
  modelAccuracy: number;
  horizonSteps: number;
  expectedReturn: number;
  supportLevel: number;
  resistanceLevel: number;
  observedFeatures: FeatureSet;
  performance: {
    rollingAccuracy: number;
    samples: number;
  };
}

export interface PriceForecast {
  assetCode: string;
  generatedAt: number;
  predictions: PredictionOutcome[];
}

export interface TrainingRow {
  features: number[];
  target: number;
}
