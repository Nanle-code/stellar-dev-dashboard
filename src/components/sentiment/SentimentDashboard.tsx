/**
 * Sentiment Analysis Dashboard
 * Main component displaying comprehensive sentiment analysis
 */

import React, { useMemo } from 'react';
import {
  SentimentGauge,
  SentimentTrendChart,
  SentimentDistributionChart,
  SourceBreakdownChart,
  SentimentCard,
  TrendIndicator,
  CorrelationVisualization,
  AccuracyMetricsDisplay,
} from './SentimentVisualizations';
import { useSentimentAnalysis, useSentimentAlerts } from '../hooks/useSentimentAnalysis';
import { SentimentAlert } from '../types/sentiment';

interface SentimentDashboardProps {
  assetCodes?: string[];
  showDetails?: boolean;
  className?: string;
}

/**
 * Alert Card Component
 */
const AlertCard: React.FC<{ alert: SentimentAlert }> = ({ alert }) => {
  const severityColors = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    critical: 'bg-red-50 border-red-200 text-red-900',
  };

  const severityIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  };

  return (
    <div className={`border rounded-lg p-3 ${severityColors[alert.severity]}`}>
      <div className="flex items-start gap-3">
        <div className="text-lg">{severityIcons[alert.severity]}</div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">{alert.title}</h4>
          <p className="text-xs mt-1 opacity-90">{alert.description}</p>
          {alert.suggestedAction && (
            <p className="text-xs mt-2 font-medium">💡 {alert.suggestedAction}</p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Quick Stats Section
 */
const QuickStats: React.FC<{ assetCode: string; aggregated: any }> = ({ assetCode, aggregated }) => {
  if (!aggregated) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
        <div className="text-xs text-purple-700 font-medium">Sentiment</div>
        <div className="text-xl font-bold text-purple-900">
          {aggregated.averageScore.toFixed(2)}
        </div>
      </div>
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
        <div className="text-xs text-blue-700 font-medium">Mentions</div>
        <div className="text-xl font-bold text-blue-900">
          {aggregated.totalMentions}
        </div>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
        <div className="text-xs text-green-700 font-medium">Positive</div>
        <div className="text-xl font-bold text-green-900">
          {aggregated.sentimentDistribution.positive.toFixed(0)}%
        </div>
      </div>
      <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3">
        <div className="text-xs text-red-700 font-medium">Negative</div>
        <div className="text-xl font-bold text-red-900">
          {aggregated.sentimentDistribution.negative.toFixed(0)}%
        </div>
      </div>
    </div>
  );
};

/**
 * Main Sentiment Dashboard Component
 */
export const SentimentDashboard: React.FC<SentimentDashboardProps> = ({
  assetCodes = ['XLM', 'USDC', 'BTC', 'ETH'],
  showDetails = true,
  className = '',
}) => {
  const sentimentData = useSentimentAnalysis(assetCodes, 60000);
  const alerts = useSentimentAlerts();

  const criticalAlerts = useMemo(
    () => alerts.filter(a => a.severity === 'critical').slice(0, 5),
    [alerts]
  );

  const selectedAsset = assetCodes[0];
  const selectedAggregated = sentimentData.aggregatedSentiment.get(selectedAsset);
  const selectedTrend = sentimentData.sentimentTrends.get(selectedAsset);
  const selectedCorrelation = sentimentData.correlations.get(selectedAsset);

  if (sentimentData.isLoading && !selectedAggregated) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading sentiment analysis...</p>
        </div>
      </div>
    );
  }

  if (sentimentData.error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <h3 className="font-semibold text-red-900 mb-2">Error Loading Sentiment Data</h3>
        <p className="text-sm text-red-800">{sentimentData.error.message}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Market Sentiment Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">
            Last updated: {new Date(sentimentData.lastUpdate).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-900 mb-3">🚨 Critical Alerts</h3>
          <div className="space-y-2">
            {criticalAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      {selectedAggregated && (
        <>
          {/* Quick Stats */}
          <QuickStats assetCode={selectedAsset} aggregated={selectedAggregated} />

          {/* Primary Visualizations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sentiment Gauge */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 flex justify-center">
              <SentimentGauge
                sentiment={selectedAggregated.averageScore}
                confidence={selectedAggregated.averageConfidence}
              />
            </div>

            {/* Sentiment Card */}
            <div>
              <SentimentCard aggregated={selectedAggregated} />
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Sentiment Distribution</h3>
              <SentimentDistributionChart aggregated={selectedAggregated} />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Source Breakdown</h3>
              <SourceBreakdownChart aggregated={selectedAggregated} />
            </div>
          </div>

          {/* Trend & Correlation */}
          {showDetails && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedTrend && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Sentiment Trend</h3>
                    <SentimentTrendChart trend={selectedTrend} height={250} />
                  </div>
                )}

                <div>
                  {selectedTrend && <TrendIndicator trend={selectedTrend} />}
                </div>
              </div>

              {/* Correlation Analysis */}
              {selectedCorrelation && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    Sentiment-Price Correlation
                  </h3>
                  <CorrelationVisualization correlation={selectedCorrelation} />
                </div>
              )}

              {/* Model Accuracy */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <AccuracyMetricsDisplay metrics={sentimentData.accuracyMetrics} />
              </div>
            </>
          )}

          {/* Asset Comparison */}
          {assetCodes.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Asset Sentiment Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Asset</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Sentiment</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Trend</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Mentions</th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700">Positive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetCodes.map(code => {
                      const agg = sentimentData.aggregatedSentiment.get(code);
                      if (!agg) return null;

                      const sentimentColor =
                        agg.averageScore > 0.2 ? 'text-green-600' :
                        agg.averageScore < -0.2 ? 'text-red-600' :
                        'text-gray-600';

                      const trendIcon =
                        agg.sentimentTrendDirection === 'improving' ? '📈' :
                        agg.sentimentTrendDirection === 'declining' ? '📉' :
                        '→';

                      return (
                        <tr key={code} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-gray-900">{code}</td>
                          <td className={`py-3 px-3 font-semibold ${sentimentColor}`}>
                            {agg.averageScore.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-lg">{trendIcon}</td>
                          <td className="py-3 px-3 text-gray-600">{agg.totalMentions}</td>
                          <td className="py-3 px-3 text-gray-600">
                            {agg.sentimentDistribution.positive.toFixed(0)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Alerts */}
          {alerts.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Recent Alerts</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {alerts.slice(0, 10).map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-xs text-gray-600 text-center">
          Sentiment analysis achieved {sentimentData.accuracyMetrics.overallAccuracy.toFixed(1)}% accuracy.
          Results are for informational purposes and should not be considered financial advice.
        </p>
      </div>
    </div>
  );
};

export default SentimentDashboard;
