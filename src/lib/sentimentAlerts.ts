/**
 * Sentiment-Based Alert System
 * Detects and generates alerts based on sentiment analysis
 */

import {
  SentimentAlert,
  AggregatedSentiment,
  SentimentTrend,
  AnalyzedSentiment,
  SentimentSource,
  SentimentConfig,
} from '../types/sentiment';

/**
 * Default alert configuration
 */
const DEFAULT_CONFIG: SentimentConfig = {
  enabledSources: [
    SentimentSource.ONCHAIN,
    SentimentSource.NEWS,
    SentimentSource.GITHUB,
    SentimentSource.TWITTER,
    SentimentSource.REDDIT,
  ],
  minConfidenceThreshold: 0.6,
  aggregationWindows: ['hour', 'day', 'week'],
  historicalDataDays: 30,
  sentimentSpikeThreshold: 0.15, // 15% change
  divergenceThreshold: 0.3, // 30% difference between sources
  anomalyStdDevs: 2, // 2 standard deviations
  enableAlerts: true,
  alertChannels: ['in-app', 'webhook'],
  modelUpdateFrequency: 3600000, // 1 hour
  retrainingDataPoints: 1000,
};

/**
 * Manages sentiment-based alerts
 */
export class SentimentAlertManager {
  private config: SentimentConfig;
  private alertHistory: Map<string, SentimentAlert[]> = new Map();
  private previousAggregations: Map<string, AggregatedSentiment> = new Map();
  private sourceStats: Map<string, { mean: number; stdDev: number }> = new Map();

  constructor(config: Partial<SentimentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze aggregated sentiment for alerts
   */
  async analyzeForAlerts(
    assetCode: string,
    aggregated: AggregatedSentiment,
    trend: SentimentTrend,
    sentimentData: AnalyzedSentiment[]
  ): Promise<SentimentAlert[]> {
    const alerts: SentimentAlert[] = [];

    if (!this.config.enableAlerts) {
      return alerts;
    }

    // Check for sentiment spike
    const spikeAlert = this.detectSentimentSpike(assetCode, aggregated);
    if (spikeAlert) alerts.push(spikeAlert);

    // Check for sentiment divergence (sources disagreeing)
    const divergenceAlert = this.detectDivergence(assetCode, sentimentData);
    if (divergenceAlert) alerts.push(divergenceAlert);

    // Check for emerging trends
    const trendAlert = this.detectEmergingTrend(assetCode, trend);
    if (trendAlert) alerts.push(trendAlert);

    // Check for anomalies
    const anomalies = this.detectAnomalies(assetCode, aggregated, sentimentData);
    alerts.push(...anomalies);

    // Store alerts
    if (!this.alertHistory.has(assetCode)) {
      this.alertHistory.set(assetCode, []);
    }
    this.alertHistory.get(assetCode)!.push(...alerts);

    // Update previous aggregation for next comparison
    this.previousAggregations.set(assetCode, aggregated);

    return alerts;
  }

  /**
   * Detect rapid sentiment changes (spikes)
   */
  private detectSentimentSpike(
    assetCode: string,
    aggregated: AggregatedSentiment
  ): SentimentAlert | null {
    const previous = this.previousAggregations.get(assetCode);
    if (!previous) return null;

    const sentimentChange = Math.abs(aggregated.averageScore - previous.averageScore);
    if (sentimentChange < this.config.sentimentSpikeThreshold) {
      return null;
    }

    const direction = aggregated.averageScore > previous.averageScore ? 'positive' : 'negative';
    const severity = sentimentChange > 0.3 ? 'critical' : sentimentChange > 0.2 ? 'warning' : 'info';
    
    const alert: SentimentAlert = {
      id: `spike-${assetCode}-${Date.now()}`,
      assetCode,
      type: 'sentiment_spike',
      severity,
      title: `Sentiment Spike Detected: ${direction.toUpperCase()}`,
      description: `${assetCode} sentiment shifted ${direction} by ${(sentimentChange * 100).toFixed(1)}%`,
      reason: `Previous score: ${previous.averageScore.toFixed(2)}, Current: ${aggregated.averageScore.toFixed(2)}`,
      currentSentiment: aggregated.averageScore,
      sentimentChange,
      confidence: aggregated.averageConfidence,
      triggeredAt: Date.now(),
      relatedEvents: [],
      suggestedAction: direction === 'positive' 
        ? 'Consider evaluating positive momentum and market opportunity'
        : 'Monitor for further negative sentiment and market pressure',
    };

    return alert;
  }

  /**
   * Detect disagreement between sources (divergence)
   */
  private detectDivergence(
    assetCode: string,
    sentimentData: AnalyzedSentiment[]
  ): SentimentAlert | null {
    if (sentimentData.length < 2) return null;

    // Calculate sentiment by source
    const sourceScores = new Map<SentimentSource, number[]>();
    for (const data of sentimentData) {
      if (!sourceScores.has(data.source)) {
        sourceScores.set(data.source, []);
      }
      sourceScores.get(data.source)!.push(data.score);
    }

    // Calculate mean by source
    const sourceMeans = new Map<SentimentSource, number>();
    for (const [source, scores] of sourceScores) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      sourceMeans.set(source, mean);
    }

    if (sourceMeans.size < 2) return null;

    // Find max and min
    const means = Array.from(sourceMeans.values());
    const max = Math.max(...means);
    const min = Math.min(...means);
    const divergence = Math.abs(max - min);

    if (divergence < this.config.divergenceThreshold) {
      return null;
    }

    // Find sources that disagree
    const bullishSources = Array.from(sourceMeans.entries())
      .filter(([_, score]) => score > 0.2)
      .map(([source]) => source);
    
    const bearishSources = Array.from(sourceMeans.entries())
      .filter(([_, score]) => score < -0.2)
      .map(([source]) => source);

    if (bullishSources.length === 0 || bearishSources.length === 0) {
      return null;
    }

    const alert: SentimentAlert = {
      id: `divergence-${assetCode}-${Date.now()}`,
      assetCode,
      type: 'sentiment_divergence',
      severity: 'warning',
      title: 'Source Sentiment Divergence Detected',
      description: `${assetCode}: ${bullishSources.join(', ')} bullish vs ${bearishSources.join(', ')} bearish`,
      reason: `Divergence score: ${divergence.toFixed(3)} (threshold: ${this.config.divergenceThreshold})`,
      currentSentiment: (max + min) / 2,
      sentimentChange: divergence,
      confidence: 0.8,
      triggeredAt: Date.now(),
      relatedEvents: [],
      suggestedAction: 'Investigate conflicting signals from different sources for better context',
    };

    return alert;
  }

  /**
   * Detect emerging trends
   */
  private detectEmergingTrend(assetCode: string, trend: SentimentTrend): SentimentAlert | null {
    // Alert if trend just started and has high confidence
    if (trend.strengthScore < 0.5 || trend.trendConfidence < 0.6) {
      return null;
    }

    // Only alert on strong, confident trends
    if (trend.duration < 3600000) {
      // Less than 1 hour old
      return null;
    }

    const trendName = trend.overallTrend === 'uptrend' ? 'bullish' : 'bearish';
    const color = trend.overallTrend === 'uptrend' ? '📈' : '📉';

    const alert: SentimentAlert = {
      id: `trend-${assetCode}-${Date.now()}`,
      assetCode,
      type: 'emerging_trend',
      severity: trend.overallTrend === 'uptrend' ? 'info' : 'warning',
      title: `${color} ${trendName.toUpperCase()} Trend Emerging`,
      description: `Strong ${trendName} sentiment trend detected for ${assetCode}`,
      reason: `Trend strength: ${(trend.strengthScore * 100).toFixed(0)}%, Confidence: ${(trend.trendConfidence * 100).toFixed(0)}%`,
      currentSentiment: trend.dataPoints[trend.dataPoints.length - 1]?.averageScore || 0,
      sentimentChange: trend.strengthScore,
      confidence: trend.trendConfidence,
      triggeredAt: Date.now(),
      relatedEvents: [],
      suggestedAction: trend.overallTrend === 'uptrend'
        ? 'Consider long positions if fundamentals support the trend'
        : 'Exercise caution and review risk management',
    };

    return alert;
  }

  /**
   * Detect anomalies in sentiment data
   */
  private detectAnomalies(
    assetCode: string,
    aggregated: AggregatedSentiment,
    sentimentData: AnalyzedSentiment[]
  ): SentimentAlert[] {
    const alerts: SentimentAlert[] = [];

    // Calculate statistics for this asset
    const stats = this.calculateStats(assetCode, sentimentData);
    
    // Check for statistical anomaly
    const zScore = Math.abs((aggregated.averageScore - stats.mean) / (stats.stdDev + 0.0001));
    
    if (zScore > this.config.anomalyStdDevs) {
      const isExtreme = zScore > this.config.anomalyStdDevs * 2;
      
      const alert: SentimentAlert = {
        id: `anomaly-${assetCode}-${Date.now()}`,
        assetCode,
        type: 'anomaly',
        severity: isExtreme ? 'critical' : 'warning',
        title: `Sentiment Anomaly Detected`,
        description: `${assetCode} sentiment is ${isExtreme ? 'extremely' : 'unusually'} ${aggregated.averageScore > 0 ? 'positive' : 'negative'}`,
        reason: `Z-score: ${zScore.toFixed(2)}, Normal range: ${(stats.mean).toFixed(2)} ± ${(stats.stdDev).toFixed(2)}`,
        currentSentiment: aggregated.averageScore,
        sentimentChange: aggregated.averageScore - stats.mean,
        confidence: aggregated.averageConfidence,
        triggeredAt: Date.now(),
        relatedEvents: sentimentData.slice(0, 10).map(d => d.id),
        suggestedAction: 'Investigate if anomaly is driven by significant news or events',
      };

      alerts.push(alert);
    }

    // Check for unusual engagement spike
    if (aggregated.totalMentions > stats.mentionMean * 2) {
      const alert: SentimentAlert = {
        id: `engagement-${assetCode}-${Date.now()}`,
        assetCode,
        type: 'anomaly',
        severity: 'info',
        title: 'Unusual Engagement Spike',
        description: `${assetCode} mentions increased significantly (${aggregated.totalMentions} vs avg ${stats.mentionMean.toFixed(0)})`,
        reason: `Potential major news or market event driving discussion`,
        currentSentiment: aggregated.averageScore,
        sentimentChange: 0,
        confidence: 0.8,
        triggeredAt: Date.now(),
        relatedEvents: [],
        suggestedAction: 'Check recent news and social media for context',
      };

      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Calculate statistical summary
   */
  private calculateStats(assetCode: string, sentimentData: AnalyzedSentiment[]) {
    const scores = sentimentData.map(d => d.score);
    const mentions = sentimentData.length;

    // Get cached stats if available
    if (this.sourceStats.has(assetCode)) {
      const cached = this.sourceStats.get(assetCode)!;
      return {
        mean: cached.mean,
        stdDev: cached.stdDev,
        mentionMean: mentions,
      };
    }

    // Calculate from data
    const mean = scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;
    const variance = scores.length > 0
      ? scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
      : 0;
    const stdDev = Math.sqrt(variance);

    // Cache it
    this.sourceStats.set(assetCode, { mean, stdDev });

    return { mean, stdDev, mentionMean: mentions };
  }

  /**
   * Get alerts for asset
   */
  getAlerts(assetCode: string, limit: number = 100): SentimentAlert[] {
    const alerts = this.alertHistory.get(assetCode) || [];
    return alerts.slice(-limit);
  }

  /**
   * Get recent critical alerts across all assets
   */
  getRecentCriticalAlerts(limit: number = 10): SentimentAlert[] {
    const allAlerts: SentimentAlert[] = [];
    for (const alerts of this.alertHistory.values()) {
      allAlerts.push(...alerts.filter(a => a.severity === 'critical'));
    }
    return allAlerts.sort((a, b) => b.triggeredAt - a.triggeredAt).slice(0, limit);
  }

  /**
   * Clear old alerts (older than 30 days)
   */
  cleanupOldAlerts(): void {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const [asset, alerts] of this.alertHistory) {
      const filtered = alerts.filter(a => a.triggeredAt > cutoff);
      if (filtered.length > 0) {
        this.alertHistory.set(asset, filtered);
      } else {
        this.alertHistory.delete(asset);
      }
    }
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<SentimentConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config
   */
  getConfig(): SentimentConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const sentimentAlertManager = new SentimentAlertManager();
