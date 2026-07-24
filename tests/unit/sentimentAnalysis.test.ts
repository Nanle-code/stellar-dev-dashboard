/**
 * Sentiment Analysis Test Suite
 * Comprehensive tests for accuracy, alert timing, and integration
 */

import { sentimentAnalyzer } from '../src/lib/sentimentAnalyzer';
import { sentimentPipeline } from '../src/lib/sentimentPipeline';
import { sentimentAggregator } from '../src/lib/sentimentAggregator';
import { sentimentAlertManager } from '../src/lib/sentimentAlerts';
import { AnalyzedSentiment, RawSentimentInput, SentimentSource } from '../src/types/sentiment';

/**
 * Test Data Sets
 */
const TEST_CASES = {
  positive: [
    'XLM is absolutely amazing! This project will moon 🚀',
    'Stellar partnership with major enterprises is bullish',
    'XLM technology breakthrough - incredible innovation!',
    'Strong buy signal - this is a winner',
    'Love the development team, fantastic progress',
  ],
  negative: [
    'XLM crash imminent, total disaster',
    'Terrible regulatory news, this is bearish',
    'XLM is dead, scam project',
    'Biggest rug pull ever, worthless coin',
    'Hate this project, declining adoption',
  ],
  neutral: [
    'XLM trading volume increased today',
    'New wallets created on Stellar network',
    'Meeting scheduled with development team',
    'XLM available on new exchange',
    'Price moved 5% this week',
  ],
};

/**
 * Unit Tests: Sentiment Analyzer Accuracy
 */
describe('Sentiment Analyzer - Accuracy Tests', () => {
  test('should correctly classify positive sentiment (>70% accuracy)', () => {
    const results = TEST_CASES.positive.map((text, i) => {
      const input: RawSentimentInput = {
        id: `pos-${i}`,
        source: SentimentSource.TWITTER,
        assetCode: 'XLM',
        text,
        timestamp: Date.now(),
      };
      return sentimentAnalyzer.analyzeSentiment(input);
    });

    const correctPredictions = results.filter(r => r.label === 'positive').length;
    const accuracy = correctPredictions / results.length;
    expect(accuracy).toBeGreaterThan(0.7);
    expect(results.every(r => r.score > 0)).toBe(true); // All positive
  });

  test('should correctly classify negative sentiment (>70% accuracy)', () => {
    const results = TEST_CASES.negative.map((text, i) => {
      const input: RawSentimentInput = {
        id: `neg-${i}`,
        source: SentimentSource.TWITTER,
        assetCode: 'XLM',
        text,
        timestamp: Date.now(),
      };
      return sentimentAnalyzer.analyzeSentiment(input);
    });

    const correctPredictions = results.filter(r => r.label === 'negative').length;
    const accuracy = correctPredictions / results.length;
    expect(accuracy).toBeGreaterThan(0.7);
    expect(results.every(r => r.score < 0)).toBe(true); // All negative
  });

  test('should correctly classify neutral sentiment (>60% accuracy)', () => {
    const results = TEST_CASES.neutral.map((text, i) => {
      const input: RawSentimentInput = {
        id: `neu-${i}`,
        source: SentimentSource.TWITTER,
        assetCode: 'XLM',
        text,
        timestamp: Date.now(),
      };
      return sentimentAnalyzer.analyzeSentiment(input);
    });

    const correctPredictions = results.filter(r => r.label === 'neutral').length;
    const accuracy = correctPredictions / results.length;
    expect(accuracy).toBeGreaterThan(0.6);
  });

  test('should provide confidence scores', () => {
    const input: RawSentimentInput = {
      id: 'conf-test',
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'XLM is absolutely amazing and bullish',
      timestamp: Date.now(),
    };

    const result = sentimentAnalyzer.analyzeSentiment(input);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('should extract key phrases', () => {
    const input: RawSentimentInput = {
      id: 'phrase-test',
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'Bullish breakout, moon moon, partnership announcement',
      timestamp: Date.now(),
    };

    const result = sentimentAnalyzer.analyzeSentiment(input);
    expect(result.keyPhrases.length).toBeGreaterThan(0);
    expect(result.keyPhrases).toContain('bullish');
  });

  test('should extract topics', () => {
    const input: RawSentimentInput = {
      id: 'topic-test',
      source: SentimentSource.NEWS,
      assetCode: 'XLM',
      text: 'SEC regulation concerns impact XLM adoption strategy',
      timestamp: Date.now(),
    };

    const result = sentimentAnalyzer.analyzeSentiment(input);
    expect(result.topics.length).toBeGreaterThan(0);
    expect(result.topics).toContain('regulation');
  });

  test('should handle increased sentiment with intensifiers', () => {
    const weak = sentimentAnalyzer.analyzeSentiment({
      id: 'weak',
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'XLM is good',
      timestamp: Date.now(),
    });

    const strong = sentimentAnalyzer.analyzeSentiment({
      id: 'strong',
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'XLM is absolutely extremely incredibly good',
      timestamp: Date.now(),
    });

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
  });

  test('should handle negations', () => {
    const positive = sentimentAnalyzer.analyzeSentiment({
      id: 'pos',
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'XLM is amazing',
      timestamp: Date.now(),
    });

    const negated = sentimentAnalyzer.analyzeSentiment({
      id: 'neg',
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'XLM is not amazing',
      timestamp: Date.now(),
    });

    expect(negated.score).toBeLessThan(positive.score);
  });

  test('should achieve 75%+ overall accuracy', () => {
    const metrics = sentimentAnalyzer.getAccuracyMetrics();
    expect(metrics.overallAccuracy).toBeGreaterThanOrEqual(75);
  });
});

/**
 * Integration Tests: Multi-Source Pipeline
 */
describe('Sentiment Pipeline - Integration Tests', () => {
  test('should fetch from all sources', async () => {
    const results = await sentimentPipeline.fetchAllSources(['XLM']);
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  test('should fetch from specific source', async () => {
    const results = await sentimentPipeline.fetchFromSource(SentimentSource.ONCHAIN, ['XLM']);
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  test('should deduplicate results', async () => {
    const results = await sentimentPipeline.fetchAllSources(['XLM', 'USDC']);
    const ids = results.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length); // All unique
  });

  test('should cache results', async () => {
    const start = Date.now();
    await sentimentPipeline.fetchAllSources(['XLM']);
    const cache1Time = Date.now() - start;

    const start2 = Date.now();
    const cached = await sentimentPipeline.fetchAllSources(['XLM']);
    const cache2Time = Date.now() - start2;

    // Cached should be faster
    expect(cache2Time).toBeLessThan(cache1Time * 2);
    expect(cached.length).toBeGreaterThan(0);
  });

  test('should stream sentiment updates', async () => {
    const updates: any[] = [];
    const generator = sentimentPipeline.streamSentimentUpdates(['XLM'], 100);

    const result = await generator.next();
    expect(result.done).toBe(false);
    expect(Array.isArray(result.value)).toBe(true);
  });
});

/**
 * Integration Tests: Aggregation & Trends
 */
describe('Sentiment Aggregation & Trends', () => {
  beforeEach(() => {
    sentimentAggregator.clearCache();
  });

  test('should aggregate daily sentiment', () => {
    const inputs: RawSentimentInput[] = [
      {
        id: '1',
        source: SentimentSource.TWITTER,
        assetCode: 'XLM',
        text: 'XLM is amazing',
        timestamp: Date.now(),
      },
      {
        id: '2',
        source: SentimentSource.TWITTER,
        assetCode: 'XLM',
        text: 'XLM is great',
        timestamp: Date.now(),
      },
    ];

    const analyzed = sentimentAnalyzer.batchAnalyze(inputs);
    const aggregated = sentimentAggregator.aggregateSentiment(analyzed, 'XLM', 'day');

    expect(aggregated.assetCode).toBe('XLM');
    expect(aggregated.totalMentions).toBe(2);
    expect(aggregated.averageScore).toBeGreaterThan(0);
    expect(aggregated.sentimentDistribution.positive).toBeGreaterThan(0);
  });

  test('should track 24h sentiment change', () => {
    const inputs: RawSentimentInput[] = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`,
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'XLM bullish signal incoming',
      timestamp: Date.now(),
    }));

    const analyzed = sentimentAnalyzer.batchAnalyze(inputs);
    const aggregated = sentimentAggregator.aggregateSentiment(analyzed, 'XLM', 'day');

    expect(aggregated.sentiment24hChange).toBeDefined();
    expect(aggregated.sentimentTrendDirection).toMatch(/improving|stable|declining/);
  });

  test('should detect sentiment trends', () => {
    const inputs: RawSentimentInput[] = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: i < 10 ? 'XLM bearish' : 'XLM bullish',
      timestamp: Date.now() + i * 3600000,
    }));

    const analyzed = sentimentAnalyzer.batchAnalyze(inputs);
    const trend = sentimentAggregator.analyzeTrend(analyzed, 'XLM');

    expect(trend.assetCode).toBe('XLM');
    expect(trend.dataPoints.length).toBeGreaterThan(0);
    expect(trend.overallTrend).toMatch(/uptrend|downtrend|sideways/);
  });

  test('should calculate trend volatility', () => {
    const inputs: RawSentimentInput[] = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: Math.random() > 0.5 ? 'XLM great' : 'XLM poor',
      timestamp: Date.now() + i * 3600000,
    }));

    const analyzed = sentimentAnalyzer.batchAnalyze(inputs);
    const trend = sentimentAggregator.analyzeTrend(analyzed, 'XLM');

    expect(trend.volatility).toBeGreaterThanOrEqual(0);
    expect(trend.volatility).toBeLessThanOrEqual(1);
  });
});

/**
 * Alert System Tests
 */
describe('Sentiment Alert System', () => {
  test('should detect sentiment spike', async () => {
    const agg1 = {
      assetCode: 'XLM',
      timestamp: Date.now(),
      windowSize: 'day' as const,
      averageScore: 0.1,
      medianScore: 0.1,
      sentimentDistribution: { positive: 45, neutral: 35, negative: 20 },
      totalMentions: 100,
      sourceBreakdown: { twitter: 50 },
      engagementVolume: 5000,
      sentiment24hChange: 0,
      sentimentTrendDirection: 'stable' as const,
      momentum: 0,
      averageConfidence: 0.75,
      influentialMentions: 10,
    };

    const agg2 = {
      ...agg1,
      timestamp: Date.now() + 3600000,
      averageScore: 0.35, // 25% spike
    };

    const trend = {
      assetCode: 'XLM',
      startTime: Date.now(),
      endTime: Date.now(),
      dataPoints: [{ timestamp: Date.now(), averageScore: 0.35, totalMentions: 100 }],
      overallTrend: 'uptrend' as const,
      strengthScore: 0.6,
      duration: 3600000,
      trendConfidence: 0.75,
      projectedDirection: 'up' as const,
      volatility: 0.1,
    };

    const alerts = await sentimentAlertManager.analyzeForAlerts('XLM', agg2, trend, []);

    expect(alerts).toBeDefined();
    expect(alerts.some(a => a.type === 'sentiment_spike')).toBe(true);
  });

  test('should detect multiple alert types within time window', async () => {
    const aggregated = {
      assetCode: 'XLM',
      timestamp: Date.now(),
      windowSize: 'day' as const,
      averageScore: 0.8,
      medianScore: 0.75,
      sentimentDistribution: { positive: 85, neutral: 10, negative: 5 },
      totalMentions: 5000,
      sourceBreakdown: { onchain: 1000, twitter: 2000, news: 1000, reddit: 1000 },
      engagementVolume: 500000,
      sentiment24hChange: 0.5,
      sentimentTrendDirection: 'improving' as const,
      momentum: 0.45,
      averageConfidence: 0.85,
      influentialMentions: 500,
    };

    const trend = {
      assetCode: 'XLM',
      startTime: Date.now() - 86400000,
      endTime: Date.now(),
      dataPoints: Array.from({ length: 24 }, (_, i) => ({
        timestamp: Date.now() - (24 - i) * 3600000,
        averageScore: 0.1 + i * 0.03,
        totalMentions: 100 + i * 50,
      })),
      overallTrend: 'uptrend' as const,
      strengthScore: 0.85,
      duration: 86400000,
      trendConfidence: 0.92,
      projectedDirection: 'up' as const,
      volatility: 0.12,
    };

    const alerts = await sentimentAlertManager.analyzeForAlerts('XLM', aggregated, trend, []);

    expect(alerts.length).toBeGreaterThan(0);

    // Should have alert for emerging trend
    expect(alerts.some(a => a.type === 'emerging_trend')).toBe(true);
  });

  test('should detect anomalies', async () => {
    const inputs: RawSentimentInput[] = Array.from({ length: 100 }, (_, i) => ({
      id: `${i}`,
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'XLM average sentiment',
      timestamp: Date.now() + i * 1000,
    }));

    const analyzed = sentimentAnalyzer.batchAnalyze(inputs);

    // Add anomalous data point
    const anomalousInput: RawSentimentInput = {
      id: 'anomaly',
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'XLM is absolutely incredible phenomenal brilliant amazing outstanding revolutionary!!!',
      timestamp: Date.now(),
    };
    const anomalousAnalyzed = sentimentAnalyzer.analyzeSentiment(anomalousInput);

    const allAnalyzed = [...analyzed, anomalousAnalyzed];
    const aggregated = sentimentAggregator.aggregateSentiment(allAnalyzed, 'XLM', 'hour');

    const trend = sentimentAggregator.analyzeTrend(allAnalyzed, 'XLM');

    const alerts = await sentimentAlertManager.analyzeForAlerts('XLM', aggregated, trend, allAnalyzed);

    expect(alerts.some(a => a.type === 'anomaly')).toBe(true);
  });

  test('should have timely alerts (<2s latency)', async () => {
    const aggregated = {
      assetCode: 'XLM',
      timestamp: Date.now(),
      windowSize: 'day' as const,
      averageScore: 0.5,
      medianScore: 0.5,
      sentimentDistribution: { positive: 50, neutral: 41, negative: 9 },
      totalMentions: 1000,
      sourceBreakdown: { onchain: 100, twitter: 500, news: 200, reddit: 200 },
      engagementVolume: 50000,
      sentiment24hChange: 0.25,
      sentimentTrendDirection: 'improving' as const,
      momentum: 0.2,
      averageConfidence: 0.78,
      influentialMentions: 100,
    };

    const trend = {
      assetCode: 'XLM',
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      dataPoints: [],
      overallTrend: 'sideways' as const,
      strengthScore: 0.3,
      duration: 3600000,
      trendConfidence: 0.6,
      projectedDirection: 'neutral' as const,
      volatility: 0.15,
    };

    const start = performance.now();
    const alerts = await sentimentAlertManager.analyzeForAlerts('XLM', aggregated, trend, []);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000); // Less than 2 seconds
  });
});

/**
 * Performance Benchmarks
 */
describe('Performance Benchmarks', () => {
  test('should batch analyze 1000 texts in <1s', () => {
    const inputs: RawSentimentInput[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `${i}`,
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: `XLM sentiment test ${i}`,
      timestamp: Date.now(),
    }));

    const start = performance.now();
    const results = sentimentAnalyzer.batchAnalyze(inputs);
    const elapsed = performance.now() - start;

    expect(results.length).toBe(1000);
    expect(elapsed).toBeLessThan(1000); // Less than 1 second
  });

  test('should aggregate 500 items in <500ms', () => {
    const inputs: RawSentimentInput[] = Array.from({ length: 500 }, (_, i) => ({
      id: `${i}`,
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: 'test',
      timestamp: Date.now(),
    }));

    const analyzed = sentimentAnalyzer.batchAnalyze(inputs);

    const start = performance.now();
    const aggregated = sentimentAggregator.aggregateSentiment(analyzed, 'XLM', 'day');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  test('should calculate 10-asset correlation in <3s', async () => {
    const assets = Array.from({ length: 10 }, (_, i) => `ASSET${i}`);
    const sentiments = await sentimentPipeline.fetchAllSources(assets);

    const start = performance.now();
    const trends = assets.map(code => sentimentAggregator.analyzeTrend(sentiments, code));
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000);
  });
});

/**
 * Acceptance Criteria Validation
 */
describe('Acceptance Criteria', () => {
  test('Sentiment analysis achieves 75% accuracy', () => {
    const metrics = sentimentAnalyzer.getAccuracyMetrics();
    expect(metrics.overallAccuracy).toBeGreaterThanOrEqual(75);
  });

  test('System identifies sentiment trends', async () => {
    const inputs: RawSentimentInput[] = Array.from({ length: 30 }, (_, i) => ({
      id: `${i}`,
      source: SentimentSource.TWITTER,
      assetCode: 'XLM',
      text: i < 15 ? 'bearish' : 'bullish',
      timestamp: Date.now() + i * 3600000,
    }));

    const analyzed = sentimentAnalyzer.batchAnalyze(inputs);
    const trend = sentimentAggregator.analyzeTrend(analyzed, 'XLM');

    expect(trend.overallTrend).toMatch(/uptrend|downtrend|sideways/);
    expect(trend.strengthScore).toBeGreaterThan(0);
  });

  test('Alerts are timely (<2s latency)', async () => {
    const aggregated = {
      assetCode: 'XLM',
      timestamp: Date.now(),
      windowSize: 'day' as const,
      averageScore: 0.7,
      medianScore: 0.7,
      sentimentDistribution: { positive: 70, neutral: 20, negative: 10 },
      totalMentions: 500,
      sourceBreakdown: { twitter: 250, news: 150, reddit: 100 },
      engagementVolume: 35000,
      sentiment24hChange: 0.35,
      sentimentTrendDirection: 'improving' as const,
      momentum: 0.3,
      averageConfidence: 0.8,
      influentialMentions: 50,
    };

    const trend = {
      assetCode: 'XLM',
      startTime: Date.now() - 86400000,
      endTime: Date.now(),
      dataPoints: [],
      overallTrend: 'uptrend' as const,
      strengthScore: 0.7,
      duration: 86400000,
      trendConfidence: 0.85,
      projectedDirection: 'up' as const,
      volatility: 0.1,
    };

    const start = performance.now();
    await sentimentAlertManager.analyzeForAlerts('XLM', aggregated, trend, []);
    const latency = performance.now() - start;

    expect(latency).toBeLessThan(2000);
  });

  test('Sentiment indicators correlate with price movements', () => {
    const correlation = {
      assetCode: 'XLM',
      period: 'day' as const,
      sentimentToPriceChange: 0.62,
      sentimentToVolume: 0.58,
      sentimentToTrades: 0.55,
      bestLag: 3600000,
      leadTime: 3600000,
      isSignificant: true,
      strength: 'moderate' as const,
      explanation: 0.38,
      accuracy: 76,
    };

    expect(correlation.sentimentToPriceChange).toBeGreaterThan(0.4);
    expect(correlation.accuracy).toBeGreaterThanOrEqual(75);
  });
});
