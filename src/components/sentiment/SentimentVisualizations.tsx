/**
 * Sentiment Visualization Components
 * Reusable React components for displaying sentiment analysis
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  AggregatedSentiment,
  SentimentTrend,
  SentimentPriceCorrelation,
  AccuracyMetrics,
} from '../types/sentiment';

/**
 * Color scheme for sentiment visualization
 */
const SENTIMENT_COLORS = {
  positive: '#10b981', // emerald
  neutral: '#6b7280', // gray
  negative: '#ef4444', // red
  sentiment: '#8b5cf6', // purple for overall sentiment
  price: '#3b82f6', // blue for price
};

/**
 * Sentiment Gauge Component
 * Displays current sentiment on a -1 to +1 scale
 */
export const SentimentGauge: React.FC<{ sentiment: number; confidence?: number }> = ({
  sentiment,
  confidence = 0.75,
}) => {
  const percent = ((sentiment + 1) / 2) * 100;
  const color =
    sentiment > 0.2 ? SENTIMENT_COLORS.positive :
    sentiment < -0.2 ? SENTIMENT_COLORS.negative :
    SENTIMENT_COLORS.neutral;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-20 rounded-t-full border-4 border-gray-300 overflow-hidden bg-gray-100">
        <div
          className="absolute top-0 left-0 h-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            backgroundColor: color,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-900">{sentiment.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex gap-4 text-xs font-medium">
        <span className="text-red-600">Negative</span>
        <span className="text-gray-600">Neutral</span>
        <span className="text-green-600">Positive</span>
      </div>
      {confidence && (
        <div className="text-xs text-gray-600">
          Confidence: {(confidence * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
};

/**
 * Sentiment Trend Chart
 * Line chart showing sentiment evolution over time
 */
export const SentimentTrendChart: React.FC<{ trend: SentimentTrend; height?: number }> = ({
  trend,
  height = 300,
}) => {
  const chartData = trend.dataPoints.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    sentiment: Number(point.averageScore.toFixed(3)),
    mentions: point.totalMentions,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis domain={[-1, 1]} />
        <Tooltip
          formatter={(value: any) => {
            if (typeof value === 'number') {
              return value.toFixed(3);
            }
            return value;
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="sentiment"
          stroke={SENTIMENT_COLORS.sentiment}
          dot={false}
          strokeWidth={2}
          name="Sentiment Score"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

/**
 * Sentiment Distribution Chart
 * Pie/Donut chart showing positive/neutral/negative breakdown
 */
export const SentimentDistributionChart: React.FC<{ aggregated: AggregatedSentiment }> = ({
  aggregated,
}) => {
  const data = [
    { name: 'Positive', value: aggregated.sentimentDistribution.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: aggregated.sentimentDistribution.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: aggregated.sentimentDistribution.negative, color: SENTIMENT_COLORS.negative },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: any) => `${value.toFixed(1)}%`} />
      </PieChart>
    </ResponsiveContainer>
  );
};

/**
 * Source Breakdown Chart
 * Shows contribution of each sentiment source
 */
export const SourceBreakdownChart: React.FC<{ aggregated: AggregatedSentiment }> = ({
  aggregated,
}) => {
  const data = Object.entries(aggregated.sourceBreakdown).map(([source, count]) => ({
    name: source.charAt(0).toUpperCase() + source.slice(1),
    count,
  }));

  if (data.length === 0) {
    return <div className="text-gray-500 p-4">No sentiment sources available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill={SENTIMENT_COLORS.sentiment} name="Mentions" />
      </BarChart>
    </ResponsiveContainer>
  );
};

/**
 * Sentiment-Price Correlation Visualization
 */
export const CorrelationVisualization: React.FC<{ correlation: SentimentPriceCorrelation }> = ({
  correlation,
}) => {
  const correlationBars = [
    { label: 'Sentiment → Price', value: correlation.sentimentToPriceChange },
    { label: 'Sentiment → Volume', value: correlation.sentimentToVolume },
    { label: 'Sentiment → Trades', value: correlation.sentimentToTrades },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Best Lag</div>
          <div className="text-lg font-semibold text-blue-600">
            {(correlation.bestLag / 3600000).toFixed(1)}h
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-xs text-gray-600 mb-1">Accuracy</div>
          <div className="text-lg font-semibold text-green-600">
            {correlation.accuracy.toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {correlationBars.map((bar, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="w-32 text-sm text-gray-700">{bar.label}</div>
            <div className="flex-1 h-6 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.abs(bar.value) * 100}%`,
                  backgroundColor: bar.value > 0 ? SENTIMENT_COLORS.positive : SENTIMENT_COLORS.negative,
                }}
              />
            </div>
            <div className="w-12 text-right text-sm font-mono text-gray-700">
              {bar.value.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div className={`p-3 rounded text-sm ${correlation.isSignificant ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-800'}`}>
        {correlation.isSignificant
          ? '✓ Statistically significant correlation detected'
          : '○ Correlation not yet statistically significant'}
      </div>
    </div>
  );
};

/**
 * Sentiment Card Component
 * Compact display of key sentiment metrics
 */
export const SentimentCard: React.FC<{ aggregated: AggregatedSentiment }> = ({ aggregated }) => {
  const scoreColor =
    aggregated.averageScore > 0.2 ? 'text-green-600' :
    aggregated.averageScore < -0.2 ? 'text-red-600' :
    'text-gray-600';

  const trendIcon =
    aggregated.sentimentTrendDirection === 'improving' ? '↑' :
    aggregated.sentimentTrendDirection === 'declining' ? '↓' :
    '→';

  const trendColor =
    aggregated.sentimentTrendDirection === 'improving' ? 'text-green-600' :
    aggregated.sentimentTrendDirection === 'declining' ? 'text-red-600' :
    'text-gray-600';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs text-gray-600 mb-1">Sentiment Score</div>
          <div className={`text-2xl font-bold ${scoreColor}`}>
            {aggregated.averageScore.toFixed(2)}
          </div>
        </div>
        <div className={`text-2xl ${trendColor}`}>{trendIcon}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-600">Mentions:</span>
          <div className="font-semibold">{aggregated.totalMentions}</div>
        </div>
        <div>
          <span className="text-gray-600">Engagement:</span>
          <div className="font-semibold">
            {(aggregated.engagementVolume / 1000000).toFixed(1)}M
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-200">
        <div className="flex gap-1">
          <div className="flex-1 h-1 rounded" style={{ backgroundColor: SENTIMENT_COLORS.positive, width: `${aggregated.sentimentDistribution.positive}%` }} />
          <div className="flex-1 h-1 rounded" style={{ backgroundColor: SENTIMENT_COLORS.neutral, width: `${aggregated.sentimentDistribution.neutral}%` }} />
          <div className="flex-1 h-1 rounded" style={{ backgroundColor: SENTIMENT_COLORS.negative, width: `${aggregated.sentimentDistribution.negative}%` }} />
        </div>
      </div>
    </div>
  );
};

/**
 * Trend Indicator Component
 * Shows trend strength and direction
 */
export const TrendIndicator: React.FC<{ trend: SentimentTrend }> = ({ trend }) => {
  const strengthPercent = (trend.strengthScore * 100);
  const directionLabel =
    trend.overallTrend === 'uptrend' ? 'Uptrend' :
    trend.overallTrend === 'downtrend' ? 'Downtrend' :
    'Sideways';

  const directionColor =
    trend.overallTrend === 'uptrend' ? SENTIMENT_COLORS.positive :
    trend.overallTrend === 'downtrend' ? SENTIMENT_COLORS.negative :
    SENTIMENT_COLORS.neutral;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Sentiment Trend</h3>
        <div style={{ color: directionColor }} className="text-sm font-bold">
          {directionLabel}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Trend Strength</span>
          <span className="font-mono font-semibold">{strengthPercent.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${strengthPercent}%`,
              backgroundColor: directionColor,
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Volatility</span>
          <span className="font-mono font-semibold">{(trend.volatility * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Confidence</span>
          <span className="font-mono font-semibold">{(trend.trendConfidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      {trend.projectedDirection === 'neutral' ? null : (
        <div className={`p-3 rounded text-sm font-medium ${
          trend.projectedDirection === 'up' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {trend.projectedDirection === 'up'
            ? '📈 Uptrend expected to continue'
            : '📉 Downtrend expected to continue'}
        </div>
      )}
    </div>
  );
};

/**
 * Accuracy Metrics Display
 */
export const AccuracyMetricsDisplay: React.FC<{ metrics: AccuracyMetrics }> = ({ metrics }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Model Accuracy</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 p-3 rounded">
          <div className="text-xs text-gray-600">Overall</div>
          <div className="text-2xl font-bold text-blue-600">{metrics.overallAccuracy.toFixed(1)}%</div>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <div className="text-xs text-gray-600">Precision</div>
          <div className="text-2xl font-bold text-purple-600">{(metrics.precision * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <div className="text-xs text-gray-600">Recall</div>
          <div className="text-2xl font-bold text-green-600">{(metrics.recall * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-orange-50 p-3 rounded">
          <div className="text-xs text-gray-600">F1 Score</div>
          <div className="text-2xl font-bold text-orange-600">{(metrics.f1Score * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div className="text-xs text-gray-600 pt-2 border-t border-gray-200">
        Evaluated on {metrics.evaluationSampleSize} samples
      </div>
    </div>
  );
};
