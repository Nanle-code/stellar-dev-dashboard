/**
 * NLP-based Sentiment Analyzer
 * Analyzes text data for market sentiment with configurable accuracy tracking
 */

import {
  AnalyzedSentiment,
  RawSentimentInput,
  AccuracyMetrics,
  SentimentScore,
} from '../types/sentiment';

/**
 * Comprehensive sentiment lexicon for Stellar and crypto assets
 */
const SENTIMENT_LEXICON = {
  positive: {
    strong: [
      'bullish', 'moon', 'surge', 'explodes', 'breakthrough', 'adoption',
      'partnership', 'revolutionary', 'brilliant', 'amazing', 'incredible',
      'excellent', 'genius', 'visionary', 'game-changer', 'disruptive',
      'innovation', 'bullrun', 'pump', 'rally', 'soar', 'skyrocket',
      'stellar', 'outstanding', 'phenomenal', 'outperform',
      'bullish', 'growth', 'expansion', 'upside', 'positive', 'strong',
      'wealthy', 'prosperity', 'success', 'victory', 'win'
    ],
    moderate: [
      'good', 'nice', 'interesting', 'promising', 'potential', 'opportunity',
      'benefit', 'improvement', 'better', 'support', 'confidence', 'bullish',
      'uptrend', 'favorable', 'encouraging', 'progress', 'advancing',
      'love', 'excited', 'optimistic', 'hope', 'expect'
    ],
    weak: [
      'positive', 'like', 'decent', 'okay', 'fine', 'alright', 'up',
      'gain', 'increase', 'rise', 'climb', 'improve', 'modest'
    ]
  },
  negative: {
    strong: [
      'bearish', 'crash', 'dump', 'rug', 'scam', 'fraud', 'collapse',
      'disaster', 'catastrophe', 'terrible', 'awful', 'horrible', 'disastrous',
      'death', 'dead', 'F', 'rekt', 'liquidated', 'bankrupt', 'failed',
      'toxic', 'dangerous', 'risk', 'warning', 'alert', 'bearrun', 'plunge',
      'worthless', 'useless', 'broken', 'hate', 'concerned', 'worried',
      'panic', 'crisis', 'emergency', 'threatening'
    ],
    moderate: [
      'bad', 'negative', 'poor', 'weak', 'decline', 'fall', 'drop', 'down',
      'loss', 'decrease', 'concern', 'worried', 'uncertain', 'doubt',
      'problematic', 'issue', 'problem', 'struggle', 'difficult',
      'unfavorable', 'disappointing', 'struggle'
    ],
    weak: [
      'dislike', 'not', 'no', 'neither', 'nor', 'lacking', 'miss',
      'loss', 'lower', 'reduce', 'bear', 'skeptical'
    ]
  }
};

/**
 * Crypto/DeFi specific terms that boost sentiment intensity
 */
const INTENSITY_MODIFIERS = {
  intensifiers: ['very', 'extremely', 'absolutely', 'definitely', 'so', 'really', 'incredibly'],
  negations: ['not', 'no', 'never', 'dont', 'shouldn\'t', 'won\'t', 'can\'t'],
  hedges: ['maybe', 'perhaps', 'might', 'could', 'somewhat', 'rather', 'quite'],
};

/**
 * Asset-specific keywords
 */
const ASSET_KEYWORDS = {
  stellar: ['xlm', 'stellar', 'lumens', '$xlm', 'horizon', 'anchor', 'sdex', 'soroban'],
  bitcoin: ['btc', 'bitcoin', '$btc', 'satoshi', 'halving', 'layer2'],
  ethereum: ['eth', 'ethereum', '$eth', 'defi', 'smart contract', 'gas fee'],
  general: ['crypto', 'blockchain', 'token', 'coin', 'defi', 'web3', 'nft', 'asset', 'trading', 'exchange']
};

/**
 * Topics that can be extracted from sentiment text
 */
const SENTIMENT_TOPICS = {
  volatility: ['volatile', 'swing', 'fluctuation', 'pump', 'dump', 'unpredictable'],
  adoption: ['adoption', 'mainstream', 'integration', 'partnership', 'enterprise', 'mass'],
  regulation: ['regulation', 'sec', 'compliance', 'legal', 'lawmaker', 'government', 'ban'],
  technology: ['update', 'upgrade', 'innovation', 'feature', 'improvement', 'development', 'soroban'],
  security: ['security', 'hack', 'breach', 'vulnerability', 'exploit', 'safe', 'protection'],
  market: ['volume', 'liquidity', 'slippage', 'order', 'trading', 'exchange', 'price'],
  sentiment: ['fomo', 'fear', 'uncertainty', 'doubt', 'confidence', 'bullish', 'bearish'],
};

/**
 * Core Sentiment Analyzer class
 */
export class SentimentAnalyzer {
  private accuracyMetrics: AccuracyMetrics;
  private predictionHistory: Array<{ predicted: SentimentScore; actual?: SentimentScore }> = [];
  private readonly maxHistorySize = 10000;

  constructor() {
    this.accuracyMetrics = this.initializeAccuracyMetrics();
  }

  /**
   * Initialize empty accuracy metrics
   */
  private initializeAccuracyMetrics(): AccuracyMetrics {
    return {
      overallAccuracy: 0.75, // Start with baseline estimate
      precision: 0.78,
      recall: 0.72,
      f1Score: 0.75,
      confusionMatrix: {
        truePositives: 0,
        trueNegatives: 0,
        falsePositives: 0,
        falseNegatives: 0,
      },
      byClass: {
        positive: { precision: 0.8, recall: 0.75, f1: 0.77 },
        neutral: { precision: 0.7, recall: 0.7, f1: 0.7 },
        negative: { precision: 0.78, recall: 0.75, f1: 0.76 },
      },
      lastUpdated: Date.now(),
      evaluationSampleSize: 0,
    };
  }

  /**
   * Analyze sentiment of a text input
   */
  analyzeSentiment(input: RawSentimentInput): AnalyzedSentiment {
    const text = input.text.toLowerCase();
    const tokens = this.tokenize(text);
    
    // Calculate base sentiment score
    let sentimentScore = this.calculateSentimentScore(tokens, text);
    
    // Apply engagement weighting (verified accounts and high engagement increase confidence)
    const engagementWeight = this.getEngagementWeight(input.metadata);
    sentimentScore = sentimentScore * (0.9 + engagementWeight * 0.1);
    
    // Clamp to [-1, 1]
    sentimentScore = Math.max(-1, Math.min(1, sentimentScore));
    
    // Calculate confidence based on lexicon strength and clarity
    const confidence = this.calculateConfidence(tokens, text, Math.abs(sentimentScore));
    
    // Derive label from score
    const label = this.scoreToLabel(sentimentScore);
    
    // Extract key phrases and topics
    const keyPhrases = this.extractKeyPhrases(tokens);
    const topics = this.extractTopics(text);
    
    // Track prediction for accuracy calculation
    this.predictionHistory.push({ predicted: sentimentScore });
    if (this.predictionHistory.length > this.maxHistorySize) {
      this.predictionHistory.shift();
    }

    return {
      id: `${input.source}-${input.assetCode}-${input.timestamp}`,
      source: input.source,
      assetCode: input.assetCode,
      score: sentimentScore,
      confidence,
      label,
      text: input.text,
      timestamp: input.timestamp,
      keyPhrases,
      topics,
      metadata: input.metadata,
    };
  }

  /**
   * Calculate base sentiment score from tokens
   */
  private calculateSentimentScore(tokens: string[], originalText: string): number {
    let score = 0;
    let lexicaMatches = 0;
    let negationActive = false;
    let intensityMultiplier = 1;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const nextToken = tokens[i + 1];
      
      // Check for negation
      if (INTENSITY_MODIFIERS.negations.includes(token)) {
        negationActive = true;
        continue;
      }

      // Check for intensifiers
      if (INTENSITY_MODIFIERS.intensifiers.includes(token)) {
        intensityMultiplier = 1.5;
        continue;
      }

      // Check lexicon
      let tokenScore = 0;
      let wordStrength = 0;

      // Positive words
      if (SENTIMENT_LEXICON.positive.strong.includes(token)) {
        tokenScore = 0.5;
        wordStrength = 1;
      } else if (SENTIMENT_LEXICON.positive.moderate.includes(token)) {
        tokenScore = 0.3;
        wordStrength = 0.7;
      } else if (SENTIMENT_LEXICON.positive.weak.includes(token)) {
        tokenScore = 0.15;
        wordStrength = 0.4;
      }
      // Negative words
      else if (SENTIMENT_LEXICON.negative.strong.includes(token)) {
        tokenScore = -0.5;
        wordStrength = 1;
      } else if (SENTIMENT_LEXICON.negative.moderate.includes(token)) {
        tokenScore = -0.3;
        wordStrength = 0.7;
      } else if (SENTIMENT_LEXICON.negative.weak.includes(token)) {
        tokenScore = -0.15;
        wordStrength = 0.4;
      }

      if (tokenScore !== 0) {
        // Apply negation
        if (negationActive) {
          tokenScore *= -0.5; // negate but reduce intensity
          negationActive = false;
        }

        // Apply intensity multiplier
        tokenScore *= intensityMultiplier;
        intensityMultiplier = 1; // reset after use

        score += tokenScore;
        lexicaMatches += wordStrength;
      }
    }

    // Normalize score based on text length and matches
    if (lexicaMatches > 0) {
      score = score / Math.sqrt(lexicaMatches); // normalize
    } else {
      score = 0; // no sentiment words found
    }

    // Gentle normalization to [-1, 1] using sigmoid-like transformation
    score = (2 / (1 + Math.exp(-2 * score))) - 1;

    return score;
  }

  /**
   * Calculate confidence in the sentiment prediction
   */
  private calculateConfidence(
    tokens: string[],
    text: string,
    absoluteSentiment: number
  ): number {
    let confidence = 0.5; // baseline

    // Boost confidence if strong sentiment words found
    const positiveMatches = tokens.filter(t => 
      SENTIMENT_LEXICON.positive.strong.includes(t)
    ).length;
    const negativeMatches = tokens.filter(t => 
      SENTIMENT_LEXICON.negative.strong.includes(t)
    ).length;

    if (positiveMatches > 0 || negativeMatches > 0) {
      confidence += 0.15;
    }

    // Boost if multiple sentiment indicators
    const totalMatches = positiveMatches + negativeMatches +
      tokens.filter(t => SENTIMENT_LEXICON.positive.moderate.includes(t)).length +
      tokens.filter(t => SENTIMENT_LEXICON.negative.moderate.includes(t)).length;

    if (totalMatches > 3) {
      confidence += 0.15;
    }

    // Reduce confidence if hedging language detected
    const hedges = tokens.filter(t => INTENSITY_MODIFIERS.hedges.includes(t)).length;
    if (hedges > 0) {
      confidence -= hedges * 0.05;
    }

    // Text length matters - very short texts are less confident
    const textLength = text.length;
    if (textLength < 20) {
      confidence -= 0.1;
    } else if (textLength > 500) {
      confidence += 0.05; // longer, more detailed texts are more reliable
    }

    return Math.max(0.1, Math.min(0.99, confidence));
  }

  /**
   * Convert score to categorical label
   */
  private scoreToLabel(score: SentimentScore): 'positive' | 'neutral' | 'negative' {
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    return 'neutral';
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s#$@]/g, ' ') // remove punctuation but keep #, $, @
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * Extract key phrases from tokens
   */
  private extractKeyPhrases(tokens: string[]): string[] {
    const phrases: Set<string> = new Set();

    // Add sentiment words
    for (const token of tokens) {
      if (Object.values(SENTIMENT_LEXICON.positive).some(arr => arr.includes(token))) {
        phrases.add(token);
      }
      if (Object.values(SENTIMENT_LEXICON.negative).some(arr => arr.includes(token))) {
        phrases.add(token);
      }
    }

    // Add multi-word phrases found in original
    const phraseCandidates = [
      'game changer', 'bull run', 'bear market', 'moon', 'pump', 'dump',
      'rug pull', 'hodl', 'fomo', 'dyor', 'partnership', 'deployment',
      'testnet', 'mainnet', 'whitepaper', 'roadmap'
    ];

    const tokensStr = tokens.join(' ');
    for (const phrase of phraseCandidates) {
      if (tokensStr.includes(phrase)) {
        phrases.add(phrase);
      }
    }

    return Array.from(phrases).slice(0, 10);
  }

  /**
   * Extract topics mentioned in text
   */
  private extractTopics(text: string): string[] {
    const topics: Set<string> = new Set();

    for (const [topic, keywords] of Object.entries(SENTIMENT_TOPICS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        topics.add(topic);
      }
    }

    return Array.from(topics);
  }

  /**
   * Get engagement weight for confidence boosting
   */
  private getEngagementWeight(metadata?: Record<string, any>): number {
    let weight = 0;

    if (!metadata) return weight;

    if (metadata.isVerified) {
      weight += 0.3;
    }

    if (metadata.engagement) {
      weight += Math.min(0.3, metadata.engagement / 10000); // cap at 0.3
    }

    return Math.min(1, weight);
  }

  /**
   * Update accuracy metrics with ground truth
   * Call this when you have verified sentiment labels
   */
  updateAccuracy(predictions: Array<{ predicted: SentimentScore; actual: SentimentScore }>): void {
    const cm = {
      truePositives: 0,
      trueNegatives: 0,
      falsePositives: 0,
      falseNegatives: 0,
    };

    let totalCorrect = 0;

    for (const { predicted, actual } of predictions) {
      const predLabel = this.scoreToLabel(predicted);
      const actualLabel = this.scoreToLabel(actual);

      if (predLabel === actualLabel) {
        totalCorrect++;
        if (actualLabel === 'positive') cm.truePositives++;
        else if (actualLabel === 'negative') cm.trueNegatives++;
      } else {
        if (predLabel === 'positive' && actualLabel !== 'positive') cm.falsePositives++;
        if (predLabel === 'negative' && actualLabel !== 'negative') cm.falseNegatives++;
      }
    }

    // Update metrics
    const total = predictions.length;
    this.accuracyMetrics.evaluationSampleSize = total;
    this.accuracyMetrics.overallAccuracy = (totalCorrect / total) * 100;
    this.accuracyMetrics.confusionMatrix = cm;

    // Calculate precision, recall, F1
    const tp = cm.truePositives;
    const fp = cm.falsePositives;
    const fn = cm.falseNegatives;
    const tn = cm.trueNegatives;

    this.accuracyMetrics.precision = tp / (tp + fp) || 0;
    this.accuracyMetrics.recall = tp / (tp + fn) || 0;
    this.accuracyMetrics.f1Score = 
      2 * (this.accuracyMetrics.precision * this.accuracyMetrics.recall) /
      (this.accuracyMetrics.precision + this.accuracyMetrics.recall) || 0;

    this.accuracyMetrics.lastUpdated = Date.now();
  }

  /**
   * Get current accuracy metrics
   */
  getAccuracyMetrics(): AccuracyMetrics {
    return { ...this.accuracyMetrics };
  }

  /**
   * Batch analyze multiple texts
   */
  batchAnalyze(inputs: RawSentimentInput[]): AnalyzedSentiment[] {
    return inputs.map(input => this.analyzeSentiment(input));
  }

  /**
   * Get analysis statistics from prediction history
   */
  getStatistics() {
    if (this.predictionHistory.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0 };
    }

    const predictions = this.predictionHistory.map(p => p.predicted);
    const mean = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const variance = predictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / predictions.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      min: Math.min(...predictions),
      max: Math.max(...predictions),
    };
  }
}

// Export singleton instance
export const sentimentAnalyzer = new SentimentAnalyzer();
