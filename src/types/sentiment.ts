/**
 * Sentiment Analysis Types and Interfaces
 * Defines data structures for AI-powered market sentiment analysis
 */

/**
 * Sentiment score on a scale from -1 (very negative) to +1 (very positive)
 * 0 = neutral
 */
export type SentimentScore = number;

/**
 * Data sources for sentiment collection
 */
export enum SentimentSource {
  TWITTER = 'twitter',
  REDDIT = 'reddit',
  NEWS = 'news',
  ONCHAIN = 'onchain',
  DISCORD = 'discord',
  GITHUB = 'github',
}

/**
 * Raw sentiment input from a single source
 */
export interface RawSentimentInput {
  id: string;
  source: SentimentSource;
  assetCode: string;
  text: string;
  timestamp: number;
  metadata?: {
    author?: string;
    engagement?: number; // likes, retweets, votes, etc.
    url?: string;
    hashtags?: string[];
    mentions?: string[];
    isVerified?: boolean; // for social media accounts
  };
}

/**
 * Analyzed sentiment for a single text input
 */
export interface AnalyzedSentiment {
  id: string;
  source: SentimentSource;
  assetCode: string;
  score: SentimentScore; // -1 to +1
  confidence: number; // 0 to 1, confidence in the score
  label: 'negative' | 'neutral' | 'positive'; // derived from score
  text: string;
  timestamp: number;
  keyPhrases: string[]; // extracted key phrases related to sentiment
  topics: string[]; // detected topics (volatility, adoption, regulation, etc.)
  metadata?: {
    author?: string;
    engagement?: number;
    url?: string;
    isVerified?: boolean;
  };
}

/**
 * Aggregated sentiment metrics for an asset over a time window
 */
export interface AggregatedSentiment {
  assetCode: string;
  timestamp: number;
  windowSize: 'hour' | 'day' | 'week'; // aggregation window
  
  // Core metrics
  averageScore: number; // weighted average sentiment -1 to +1
  medianScore: number;
  sentimentDistribution: {
    positive: number; // % of positive sentiment
    neutral: number;  // % of neutral
    negative: number; // % of negative
  };
  
  // Volume metrics
  totalMentions: number;
  sourceBreakdown: Record<SentimentSource, number>; // count per source
  engagementVolume: number; // sum of engagement across sources
  
  // Trend metrics
  sentiment24hChange: number; // change from 24h ago
  sentimentTrendDirection: 'improving' | 'stable' | 'declining';
  momentum: number; // acceleration/deceleration of change
  
  // Quality metrics
  averageConfidence: number; // average confidence of analyzed texts
  influentialMentions: number; // mentions from high-engagement/verified accounts
}

/**
 * Trend analysis for sentiment over time
 */
export interface SentimentTrend {
  assetCode: string;
  startTime: number;
  endTime: number;
  
  // Historical data points
  dataPoints: Array<{
    timestamp: number;
    averageScore: number;
    totalMentions: number;
  }>;
  
  // Trend metrics
  overallTrend: 'uptrend' | 'downtrend' | 'sideways';
  strengthScore: number; // 0-1, how strong is the trend
  duration: number; // how long trend has been established (ms)
  
  // Predictive metrics
  trendConfidence: number; // 0-1, confidence in trend continuation
  projectedDirection: 'up' | 'down' | 'neutral';
  volatility: number; // sentiment swing magnitude
}

/**
 * On-chain indicators that correlate with sentiment
 */
export interface OnChainIndicators {
  assetCode: string;
  timestamp: number;
  
  // Trading activity
  tradeVolume24h: number;
  tradeCount24h: number;
  averageTradeSize: number;
  
  // Holder metrics
  activeAddresses24h: number;
  largeTransactions: number; // transactions > 100k units
  whale_concentration: number; // % of supply held by top 100 addresses
  
  // Movement metrics
  netFlowExchanges: number; // positive = outflow (holding), negative = inflow
  addressGrowth: number; // new addresses created in 24h
  
  // Supply metrics
  totalSupply: number;
  circulatingSupply: number;
  supplyHeld: number; // % locked in known wallets
}

/**
 * Correlation between sentiment and price/trading metrics
 */
export interface SentimentPriceCorrelation {
  assetCode: string;
  period: 'hour' | 'day' | 'week';
  
  // Correlation coefficients
  sentimentToPriceChange: number; // Pearson correlation
  sentimentToVolume: number;
  sentimentToTrades: number;
  
  // Lag analysis
  bestLag: number; // milliseconds, when correlation peaks
  leadTime: number; // how far ahead sentiment leads price
  
  // Relationship strength
  isSignificant: boolean; // p-value < 0.05
  strength: 'weak' | 'moderate' | 'strong';
  
  // Predictive power
  explanation: number; // R-squared value
  accuracy: number; // backtested accuracy %
}

/**
 * Alerts triggered by sentiment analysis
 */
export interface SentimentAlert {
  id: string;
  assetCode: string;
  type: 'sentiment_spike' | 'sentiment_divergence' | 'emerging_trend' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  
  // Alert content
  title: string;
  description: string;
  reason: string; // explanation of why alert was triggered
  
  // Metrics
  currentSentiment: number;
  sentimentChange: number; // since last baseline
  confidence: number;
  
  // Timing
  triggeredAt: number;
  relatedEvents: string[]; // IDs of underlying sentiment data
  
  // Actionability
  suggestedAction?: string;
  correlatedPriceAction?: {
    direction: 'up' | 'down';
    magnitude: number;
    timeframe: number; // ms
  };
}

/**
 * Sentiment dashboard metrics
 */
export interface SentimentMetrics {
  topPositiveAssets: Array<{
    assetCode: string;
    sentiment: number;
    change24h: number;
    mentions: number;
  }>;
  
  topNegativeAssets: Array<{
    assetCode: string;
    sentiment: number;
    change24h: number;
    mentions: number;
  }>;
  
  emergingTrends: Array<{
    trend: string;
    assets: string[];
    sentiment: number;
    momentum: number;
  }>;
  
  mostDiscussedAssets: Array<{
    assetCode: string;
    mentions: number;
    avgSentiment: number;
    topTopics: string[];
  }>;
  
  systemAccuracy: {
    overallAccuracy: number; // 0-100%
    lastUpdated: number;
    samplesProcessed: number;
    confidenceLevel: number;
  };
}

/**
 * Configuration for sentiment analysis
 */
export interface SentimentConfig {
  // Analysis settings
  enabledSources: SentimentSource[];
  minConfidenceThreshold: number; // 0-1
  
  // Aggregation windows
  aggregationWindows: ('hour' | 'day' | 'week')[];
  historicalDataDays: number;
  
  // Alert thresholds
  sentimentSpikeThreshold: number; // % change
  divergenceThreshold: number; // % difference between sources
  anomalyStdDevs: number; // standard deviations for anomaly detection
  
  // Alert settings
  enableAlerts: boolean;
  alertChannels: ('email' | 'in-app' | 'webhook' | 'discord')[];
  
  // Model settings
  modelUpdateFrequency: number; // ms
  retrainingDataPoints: number;
}

/**
 * Sentiment analysis accuracy metrics
 */
export interface AccuracyMetrics {
  overallAccuracy: number; // 0-100%
  precision: number; // true positives / (true positives + false positives)
  recall: number; // true positives / (true positives + false negatives)
  f1Score: number; // harmonic mean of precision and recall
  
  confusionMatrix: {
    truePositives: number;
    trueNegatives: number;
    falsePositives: number;
    falseNegatives: number;
  };
  
  byClass: {
    positive: { precision: number; recall: number; f1: number };
    neutral: { precision: number; recall: number; f1: number };
    negative: { precision: number; recall: number; f1: number };
  };
  
  lastUpdated: number;
  evaluationSampleSize: number;
}
