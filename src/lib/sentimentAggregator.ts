/**
 * Sentiment Aggregation and Trend Analysis
 * Aggregates sentiment data and performs trend analysis
 */

import {
  AnalyzedSentiment,
  AggregatedSentiment,
  SentimentTrend,
  SentimentSource,
} from '../types/sentiment';

/**
 * Aggregates sentiment data by time window and asset
 */
export class SentimentAggregator {
  private aggregationCache: Map<string, AggregatedSentiment> = new Map();
  private historyCache: Map<string, Array<{ timestamp: number; score: number; count: number }>> = new Map();

  /**
   * Aggregate sentiment within a time window
   */
  aggregateSentiment(
    sentimentData: AnalyzedSentiment[],
    assetCode: string,
    windowSize: 'hour' | 'day' | 'week' = 'day'
  ): AggregatedSentiment {
    const now = Date.now();
    const windowMs = this.getWindowMs(windowSize);
    const cutoffTime = now - windowMs;

    // Filter data within window
    const windowedData = sentimentData.filter(
      d => d.timestamp >= cutoffTime && d.assetCode === assetCode
    );

    if (windowedData.length === 0) {
      return this.createEmptyAggregation(assetCode, windowSize);
    }

    // Calculate weighted scores
    const weightedScores = this.calculateWeightedScores(windowedData);

    // Calculate sentiment distribution
    const distribution = this.calculateDistribution(windowedData);

    // Calculate engagement
    const engagement = windowedData.reduce((sum, d) => {
      return sum + (d.metadata?.engagement || 0);
    }, 0);

    // Count influential mentions (verified or high engagement)
    const influentialMentions = windowedData.filter(d => {
      return d.metadata?.isVerified || (d.metadata?.engagement || 0) > 5000;
    }).length;

    // Calculate momentum
    const previous24h = this.getPrevious24hAverage(assetCode);
    const sentiment24hChange = weightedScores.average - previous24h;

    // Determine trend direction
    const trendDirection = sentiment24hChange > 0.05 ? 'improving' : 
                         sentiment24hChange < -0.05 ? 'declining' : 'stable';

    // Calculate momentum (acceleration)
    const momentum = sentiment24hChange * weightedScores.confidence;

    // Count by source
    const sourceBreakdown = this.countBySource(windowedData);

    const aggregated: AggregatedSentiment = {
      assetCode,
      timestamp: now,
      windowSize,
      averageScore: weightedScores.average,
      medianScore: this.calculateMedian(windowedData.map(d => d.score)),
      sentimentDistribution: distribution,
      totalMentions: windowedData.length,
      sourceBreakdown,
      engagementVolume: engagement,
      sentiment24hChange,
      sentimentTrendDirection: trendDirection,
      momentum,
      averageConfidence: windowedData.reduce((sum, d) => sum + d.confidence, 0) / windowedData.length,
      influentialMentions,
    };

    // Cache it
    const cacheKey = `${assetCode}-${windowSize}`;
    this.aggregationCache.set(cacheKey, aggregated);

    // Store in history
    this.recordHistory(assetCode, weightedScores.average, windowedData.length);

    return aggregated;
  }

  /**
   * Batch aggregate for multiple assets
   */
  batchAggregate(
    sentimentData: AnalyzedSentiment[],
    assetCodes: string[],
    windowSize: 'hour' | 'day' | 'week' = 'day'
  ): AggregatedSentiment[] {
    return assetCodes.map(code => this.aggregateSentiment(sentimentData, code, windowSize));
  }

  /**
   * Analyze trends for an asset
   */
  analyzeTrend(
    sentimentData: AnalyzedSentiment[],
    assetCode: string,
    periodMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days default
  ): SentimentTrend {
    const now = Date.now();
    const startTime = now - periodMs;

    // Filter data for period
    const periodData = sentimentData.filter(
      d => d.assetCode === assetCode && d.timestamp >= startTime
    );

    if (periodData.length < 2) {
      return this.createEmptyTrend(assetCode, startTime, now);
    }

    // Create time series data points (hourly aggregates)
    const dataPoints = this.createTimeSeries(periodData, 3600000); // 1 hour buckets

    // Analyze trend
    const scores = dataPoints.map(p => p.averageScore);
    const trendAnalysis = this.performTrendAnalysis(scores, dataPoints);

    // Calculate volatility
    const volatility = this.calculateVolatility(scores);

    // Project future direction
    const projectedDirection = trendAnalysis.direction === 'uptrend' ? 'up' :
                              trendAnalysis.direction === 'downtrend' ? 'down' : 'neutral';

    const trend: SentimentTrend = {
      assetCode,
      startTime,
      endTime: now,
      dataPoints,
      overallTrend: trendAnalysis.direction,
      strengthScore: trendAnalysis.strength,
      duration: trendAnalysis.duration,
      trendConfidence: trendAnalysis.confidence,
      projectedDirection,
      volatility,
    };

    return trend;
  }

  /**
   * Calculate weighted average sentiment score
   */
  private calculateWeightedScores(sentimentData: AnalyzedSentiment[]) {
    const SOURCE_WEIGHTS: Record<SentimentSource, number> = {
      [SentimentSource.ONCHAIN]: 0.95,
      [SentimentSource.NEWS]: 0.85,
      [SentimentSource.GITHUB]: 0.88,
      [SentimentSource.TWITTER]: 0.72,
      [SentimentSource.REDDIT]: 0.68,
      [SentimentSource.DISCORD]: 0.65,
    };

    let totalWeight = 0;
    let weightedSum = 0;
    let totalConfidence = 0;

    for (const data of sentimentData) {
      const sourceWeight = SOURCE_WEIGHTS[data.source] || 0.5;
      const engagementBoost = Math.min(1.2, 1 + (data.metadata?.engagement || 0) / 100000);
      const verifiedBoost = data.metadata?.isVerified ? 1.15 : 1;
      
      const totalWeight_individual = sourceWeight * engagementBoost * verifiedBoost * data.confidence;
      
      weightedSum += data.score * totalWeight_individual;
      totalWeight += totalWeight_individual;
      totalConfidence += data.confidence;
    }

    return {
      average: totalWeight > 0 ? weightedSum / totalWeight : 0,
      confidence: totalConfidence / sentimentData.length,
    };
  }

  /**
   * Calculate sentiment distribution (positive, neutral, negative %)
   */
  private calculateDistribution(sentimentData: AnalyzedSentiment[]) {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    
    for (const data of sentimentData) {
      if (data.label === 'positive') counts.positive++;
      else if (data.label === 'negative') counts.negative++;
      else counts.neutral++;
    }

    const total = sentimentData.length;
    return {
      positive: (counts.positive / total) * 100,
      neutral: (counts.neutral / total) * 100,
      negative: (counts.negative / total) * 100,
    };
  }

  /**
   * Count mentions by source
   */
  private countBySource(sentimentData: AnalyzedSentiment[]): Record<SentimentSource, number> {
    const counts = {} as Record<SentimentSource, number>;
    
    for (const data of sentimentData) {
      counts[data.source] = (counts[data.source] || 0) + 1;
    }

    return counts;
  }

  /**
   * Calculate median score
   */
  private calculateMedian(scores: number[]): number {
    if (scores.length === 0) return 0;
    
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Perform trend analysis using linear regression
   */
  private performTrendAnalysis(scores: number[], dataPoints: any[]) {
    if (scores.length < 2) {
      return {
        direction: 'sideways' as const,
        strength: 0,
        duration: 0,
        confidence: 0,
      };
    }

    // Linear regression
    const n = scores.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * scores[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = scores.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const yPred = scores.map((_, i) => slope * i + intercept);
    const ssRes = scores.reduce((sum, y, i) => sum + Math.pow(y - yPred[i], 2), 0);
    const rSquared = 1 - (ssRes / ssTotal);

    // Determine direction and strength
    const direction = slope > 0.001 ? 'uptrend' :
                    slope < -0.001 ? 'downtrend' : 'sideways';
    const strength = Math.min(1, Math.abs(slope) * 10);
    const confidence = Math.sqrt(Math.abs(rSquared));

    // Calculate duration (how long trend has been active)
    const firstTime = dataPoints[0]?.timestamp || 0;
    const lastTime = dataPoints[dataPoints.length - 1]?.timestamp || 0;
    const duration = lastTime - firstTime;

    return { direction, strength, duration, confidence };
  }

  /**
   * Calculate sentiment volatility (standard deviation)
   */
  private calculateVolatility(scores: number[]): number {
    if (scores.length < 2) return 0;
    
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
  }

  /**
   * Create hourly time series data points
   */
  private createTimeSeries(
    data: AnalyzedSentiment[],
    bucketMs: number = 3600000
  ) {
    const buckets = new Map<number, AnalyzedSentiment[]>();

    for (const item of data) {
      const bucketKey = Math.floor(item.timestamp / bucketMs);
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(item);
    }

    const dataPoints = Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([key, items]) => {
        const scores = items.map(d => d.score);
        const avg = scores.reduce((a, b) => a + b) / scores.length;
        return {
          timestamp: key * bucketMs,
          averageScore: avg,
          totalMentions: items.length,
        };
      });

    return dataPoints;
  }

  /**
   * Get 24-hour average from history
   */
  private getPrevious24hAverage(assetCode: string): number {
    const history = this.historyCache.get(assetCode) || [];
    if (history.length === 0) return 0;

    const now = Date.now();
    const last24h = history.filter(h => now - h.timestamp < 86400000);
    
    if (last24h.length === 0) return 0;
    
    return last24h.reduce((sum, h) => sum + h.score * h.count, 0) /
           last24h.reduce((sum, h) => sum + h.count, 0);
  }

  /**
   * Record historical sentiment
   */
  private recordHistory(assetCode: string, score: number, count: number) {
    if (!this.historyCache.has(assetCode)) {
      this.historyCache.set(assetCode, []);
    }

    const history = this.historyCache.get(assetCode)!;
    history.push({ timestamp: Date.now(), score, count });

    // Keep only 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.historyCache.set(assetCode, history.filter(h => h.timestamp > cutoff));
  }

  /**
   * Get window size in milliseconds
   */
  private getWindowMs(windowSize: 'hour' | 'day' | 'week'): number {
    switch (windowSize) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Create empty aggregation for no data case
   */
  private createEmptyAggregation(assetCode: string, windowSize: 'hour' | 'day' | 'week'): AggregatedSentiment {
    return {
      assetCode,
      timestamp: Date.now(),
      windowSize,
      averageScore: 0,
      medianScore: 0,
      sentimentDistribution: { positive: 33, neutral: 34, negative: 33 },
      totalMentions: 0,
      sourceBreakdown: {},
      engagementVolume: 0,
      sentiment24hChange: 0,
      sentimentTrendDirection: 'stable',
      momentum: 0,
      averageConfidence: 0,
      influentialMentions: 0,
    };
  }

  /**
   * Create empty trend
   */
  private createEmptyTrend(assetCode: string, startTime: number, endTime: number): SentimentTrend {
    return {
      assetCode,
      startTime,
      endTime,
      dataPoints: [],
      overallTrend: 'sideways',
      strengthScore: 0,
      duration: 0,
      trendConfidence: 0,
      projectedDirection: 'neutral',
      volatility: 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.aggregationCache.clear();
    this.historyCache.clear();
  }

  /**
   * Get aggregation from cache
   */
  getFromCache(assetCode: string, windowSize: 'hour' | 'day' | 'week'): AggregatedSentiment | null {
    const cacheKey = `${assetCode}-${windowSize}`;
    return this.aggregationCache.get(cacheKey) || null;
  }
}

// Export singleton instance
export const sentimentAggregator = new SentimentAggregator();
