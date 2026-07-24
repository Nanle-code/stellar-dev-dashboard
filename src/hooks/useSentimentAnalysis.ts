/**
 * Sentiment Analysis Hook
 * Provides sentiment data and analysis to React components
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AnalyzedSentiment,
  AggregatedSentiment,
  SentimentTrend,
  SentimentAlert,
  AccuracyMetrics,
  OnChainIndicators,
  SentimentPriceCorrelation,
} from '../types/sentiment';
import { sentimentAnalyzer } from '../lib/sentimentAnalyzer';
import { sentimentPipeline } from '../lib/sentimentPipeline';
import { sentimentAggregator } from '../lib/sentimentAggregator';
import { sentimentAlertManager } from '../lib/sentimentAlerts';
import { onChainIndicatorManager, sentimentCorrelationAnalyzer } from '../lib/sentimentCorrelation';

export interface SentimentHookData {
  // Current data
  aggregatedSentiment: Map<string, AggregatedSentiment>;
  sentimentTrends: Map<string, SentimentTrend>;
  alerts: SentimentAlert[];
  
  // Metrics
  accuracyMetrics: AccuracyMetrics;
  onChainIndicators: Map<string, OnChainIndicators>;
  correlations: Map<string, SentimentPriceCorrelation>;
  
  // Health
  isLoading: boolean;
  error: Error | null;
  lastUpdate: number;
}

/**
 * Hook for sentiment analysis
 */
export function useSentimentAnalysis(
  assetCodes: string[],
  interval: number = 60000 // 1 minute
): SentimentHookData {
  const [data, setData] = useState<SentimentHookData>({
    aggregatedSentiment: new Map(),
    sentimentTrends: new Map(),
    alerts: [],
    accuracyMetrics: sentimentAnalyzer.getAccuracyMetrics(),
    onChainIndicators: new Map(),
    correlations: new Map(),
    isLoading: true,
    error: null,
    lastUpdate: 0,
  });

  const fetchSentimentData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch raw sentiment data
      const rawSentiments = await sentimentPipeline.fetchAllSources(assetCodes);

      // Aggregate sentiments
      const aggregated = new Map<string, AggregatedSentiment>();
      for (const code of assetCodes) {
        const agg = sentimentAggregator.aggregateSentiment(rawSentiments, code, 'day');
        aggregated.set(code, agg);
      }

      // Analyze trends
      const trends = new Map<string, SentimentTrend>();
      for (const code of assetCodes) {
        const trend = sentimentAggregator.analyzeTrend(rawSentiments, code);
        trends.set(code, trend);
      }

      // Generate alerts
      const allAlerts: SentimentAlert[] = [];
      for (const code of assetCodes) {
        const agg = aggregated.get(code);
        const trend = trends.get(code);
        if (agg && trend) {
          const codeAlerts = await sentimentAlertManager.analyzeForAlerts(
            code,
            agg,
            trend,
            rawSentiments.filter(s => s.assetCode === code)
          );
          allAlerts.push(...codeAlerts);
        }
      }

      // Fetch on-chain indicators
      const onChainData = await onChainIndicatorManager.batchFetchIndicators(assetCodes);

      // Calculate correlations
      const correlations = new Map<string, SentimentPriceCorrelation>();
      for (const code of assetCodes) {
        const trend = trends.get(code);
        if (trend) {
          const correlation = sentimentCorrelationAnalyzer.analyzeSentimentPriceCorrelation(
            trend.dataPoints.map(p => ({
              timestamp: p.timestamp,
              score: p.averageScore,
            })),
            code,
            'day'
          );
          correlations.set(code, correlation);
        }
      }

      setData({
        aggregatedSentiment: aggregated,
        sentimentTrends: trends,
        alerts: allAlerts,
        accuracyMetrics: sentimentAnalyzer.getAccuracyMetrics(),
        onChainIndicators: onChainData,
        correlations,
        isLoading: false,
        error: null,
        lastUpdate: Date.now(),
      });
    } catch (error) {
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [assetCodes]);

  // Fetch on mount and setup interval
  useEffect(() => {
    fetchSentimentData();
    const timer = setInterval(fetchSentimentData, interval);
    return () => clearInterval(timer);
  }, [fetchSentimentData, interval]);

  return data;
}

/**
 * Hook for sentiment alerts
 */
export function useSentimentAlerts(assetCode?: string) {
  const [alerts, setAlerts] = useState<SentimentAlert[]>([]);

  useEffect(() => {
    if (assetCode) {
      const currentAlerts = sentimentAlertManager.getAlerts(assetCode, 50);
      setAlerts(currentAlerts);
    } else {
      const criticalAlerts = sentimentAlertManager.getRecentCriticalAlerts(20);
      setAlerts(criticalAlerts);
    }

    // Poll for updates every 30 seconds
    const timer = setInterval(() => {
      if (assetCode) {
        const currentAlerts = sentimentAlertManager.getAlerts(assetCode, 50);
        setAlerts(currentAlerts);
      } else {
        const criticalAlerts = sentimentAlertManager.getRecentCriticalAlerts(20);
        setAlerts(criticalAlerts);
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [assetCode]);

  return alerts;
}

/**
 * Hook for single asset sentiment
 */
export function useAssetSentiment(assetCode: string) {
  const data = useSentimentAnalysis([assetCode]);
  
  return {
    aggregated: data.aggregatedSentiment.get(assetCode) || null,
    trend: data.sentimentTrends.get(assetCode) || null,
    onChain: data.onChainIndicators.get(assetCode) || null,
    correlation: data.correlations.get(assetCode) || null,
    isLoading: data.isLoading,
    error: data.error,
  };
}
