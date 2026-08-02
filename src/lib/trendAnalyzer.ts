// Time-series trend analysis for performance metrics
// Provides linear regression, seasonal detection, and anomaly identification

export type TrendDirection = 'increasing' | 'decreasing' | 'stable';

export type TrendPoint = {
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
};

export type TrendAnalysis = {
  name: string;
  slope: number;
  intercept: number;
  rSquared: number;
  direction: TrendDirection;
  confidence: number;
  points: number;
  timeRange: { start: number; end: number };
  trendLine: Array<{ timestamp: number; predicted: number }>;
  anomalies: TrendAnomaly[];
  seasonality?: SeasonalityInfo;
  forecast?: ForecastPoint[];
};

export type TrendAnomaly = {
  index: number;
  timestamp: number;
  actual: number;
  predicted: number;
  residual: number;
  severity: 'low' | 'medium' | 'high';
};

export type SeasonalityInfo = {
  detected: boolean;
  period?: number;
  strength?: number;
  peaks: number[];
};

export type ForecastPoint = {
  timestamp: number;
  predicted: number;
  lowerBound: number;
  upperBound: number;
};

export type MetricSeries = {
  name: string;
  points: TrendPoint[];
};

export interface TrendAnalyzerConfig {
  minPointsForTrend?: number;
  anomalyThreshold?: number;
  forecastHorizon?: number;
  seasonalityDetection?: boolean;
  confidenceLevel?: number;
}

const DEFAULT_CONFIG: Required<TrendAnalyzerConfig> = {
  minPointsForTrend: 3,
  anomalyThreshold: 1.5,
  forecastHorizon: 10,
  seasonalityDetection: true,
  confidenceLevel: 0.95,
};

function linearRegression(points: TrendPoint[]): { slope: number; intercept: number; rSquared: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.value ?? 0, rSquared: 0 };

  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.value);

  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - xMean) * (ys[i] - yMean);
    denominator += (xs[i] - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Calculate R-squared
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared: clamp(rSquared, 0, 1) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getDirection(slope: number, rSquared: number): TrendDirection {
  if (rSquared < 0.2) return 'stable';
  if (Math.abs(slope) < 1e-6) return 'stable';
  return slope > 0 ? 'increasing' : 'decreasing';
}

function detectAnomalies(
  points: TrendPoint[],
  slope: number,
  intercept: number,
  threshold: number
): TrendAnomaly[] {
  const anomalies: TrendAnomaly[] = [];
  const residuals: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const predicted = slope * i + intercept;
    const residual = points[i].value - predicted;
    residuals.push(residual);
  }

  const meanResidual = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const stdResidual = Math.sqrt(
    residuals.reduce((sum, r) => sum + (r - meanResidual) ** 2, 0) / residuals.length
  );

  for (let i = 0; i < points.length; i++) {
    const predicted = slope * i + intercept;
    const residual = points[i].value - predicted;
    const zScore = stdResidual > 0 ? Math.abs(residual - meanResidual) / stdResidual : 0;

    if (zScore > threshold) {
      anomalies.push({
        index: i,
        timestamp: points[i].timestamp,
        actual: points[i].value,
        predicted,
        residual,
        severity: zScore > threshold * 2 ? 'high' : zScore > threshold * 1.5 ? 'medium' : 'low',
      });
    }
  }

  return anomalies;
}

function detectSeasonality(points: TrendPoint[]): SeasonalityInfo {
  const values = points.map((p) => p.value);
  const n = values.length;
  if (n < 10) return { detected: false, peaks: [] };

  // Simple autocorrelation-based seasonality detection
  const maxLag = Math.min(Math.floor(n / 2), 50);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;

  if (variance === 0) return { detected: false, peaks: [] };

  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = 2; lag <= maxLag; lag++) {
    let numerator = 0;
    let count = 0;
    for (let i = 0; i < n - lag; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
      count++;
    }
    const corr = count > 0 ? numerator / (count * variance) : 0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const detected = bestCorr > 0.3 && bestLag > 1;
  const peaks: number[] = [];

  if (detected) {
    for (let i = 0; i < n; i += bestLag) {
      if (i < n) peaks.push(i);
    }
  }

  return {
    detected,
    period: detected ? bestLag : undefined,
    strength: detected ? clamp(bestCorr, 0, 1) : undefined,
    peaks,
  };
}

function generateForecast(
  points: TrendPoint[],
  slope: number,
  intercept: number,
  horizon: number,
  confidenceLevel: number
): ForecastPoint[] {
  const forecast: ForecastPoint[] = [];
  const n = points.length;
  const lastTimestamp = points[n - 1]?.timestamp ?? Date.now();
  const timeStep = n > 1 ? points[1].timestamp - points[0].timestamp : 60000;

  // Calculate residual standard error for confidence intervals
  const residuals = points.map((p, i) => p.value - (slope * i + intercept));
  const rse = Math.sqrt(residuals.reduce((sum, r) => sum + r ** 2, 0) / Math.max(1, n - 2));

  // Z-score for confidence level (approximation)
  const zScore = confidenceLevel >= 0.99 ? 2.576 : confidenceLevel >= 0.95 ? 1.96 : 1.645;

  for (let h = 1; h <= horizon; h++) {
    const futureIndex = n + h - 1;
    const predicted = slope * futureIndex + intercept;
    const margin = Math.max(0.01, zScore * rse * Math.sqrt(1 + 1 / n + (futureIndex - (n - 1) / 2) ** 2 / (n * (n - 1) / 12)));

    forecast.push({
      timestamp: lastTimestamp + h * timeStep,
      predicted,
      lowerBound: predicted - margin,
      upperBound: predicted + margin,
    });
  }

  return forecast;
}

export function analyzeTrend(series: MetricSeries, config: TrendAnalyzerConfig = {}): TrendAnalysis | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { points } = series;

  if (!points || points.length < cfg.minPointsForTrend) {
    return null;
  }

  const { slope, intercept, rSquared } = linearRegression(points);
  const direction = getDirection(slope, rSquared);

  const confidence = rSquared * (points.length / (points.length + 5)); // More points = more confidence

  const trendLine = points.map((_, i) => ({
    timestamp: points[i].timestamp,
    predicted: slope * i + intercept,
  }));

  const anomalies = cfg.anomalyThreshold > 0
    ? detectAnomalies(points, slope, intercept, cfg.anomalyThreshold)
    : [];

  const seasonality = cfg.seasonalityDetection ? detectSeasonality(points) : { detected: false, peaks: [] };

  const forecast = cfg.forecastHorizon > 0
    ? generateForecast(points, slope, intercept, cfg.forecastHorizon, cfg.confidenceLevel)
    : undefined;

  return {
    name: series.name,
    slope,
    intercept,
    rSquared,
    direction,
    confidence,
    points: points.length,
    timeRange: {
      start: points[0].timestamp,
      end: points[points.length - 1].timestamp,
    },
    trendLine,
    anomalies,
    seasonality: seasonality.detected ? seasonality : undefined,
    forecast,
  };
}

export function analyzeMultipleTrends(
  seriesList: MetricSeries[],
  config: TrendAnalyzerConfig = {}
): TrendAnalysis[] {
  return seriesList
    .map((series) => analyzeTrend(series, config))
    .filter((analysis): analysis is TrendAnalysis => analysis !== null);
}

export function compareTrends(analysis1: TrendAnalysis, analysis2: TrendAnalysis): {
  correlation: number;
  divergence: number;
  similarDirection: boolean;
} {
  const len = Math.min(analysis1.trendLine.length, analysis2.trendLine.length);
  if (len < 2) return { correlation: 0, divergence: 0, similarDirection: false };

  const values1 = analysis1.trendLine.slice(0, len).map((p) => p.predicted);
  const values2 = analysis2.trendLine.slice(0, len).map((p) => p.predicted);

  const mean1 = values1.reduce((a, b) => a + b, 0) / len;
  const mean2 = values2.reduce((a, b) => a + b, 0) / len;

  let num = 0;
  let den1 = 0;
  let den2 = 0;
  for (let i = 0; i < len; i++) {
    const d1 = values1[i] - mean1;
    const d2 = values2[i] - mean2;
    num += d1 * d2;
    den1 += d1 ** 2;
    den2 += d2 ** 2;
  }

  const correlation = den1 > 0 && den2 > 0 ? num / Math.sqrt(den1 * den2) : 0;

  const last1 = values1[len - 1];
  const last2 = values2[len - 1];
  const divergence = last1 !== 0 ? Math.abs((last1 - last2) / last1) : 0;

  return {
    correlation,
    divergence,
    similarDirection: analysis1.direction === analysis2.direction,
  };
}

export function getTrendSummary(analyses: TrendAnalysis[]): {
  total: number;
  increasing: number;
  decreasing: number;
  stable: number;
  withAnomalies: number;
  withSeasonality: number;
  avgConfidence: number;
} {
  const summary = {
    total: analyses.length,
    increasing: 0,
    decreasing: 0,
    stable: 0,
    withAnomalies: 0,
    withSeasonality: 0,
    avgConfidence: 0,
  };

  let confSum = 0;
  for (const a of analyses) {
    if (a.direction === 'increasing') summary.increasing++;
    else if (a.direction === 'decreasing') summary.decreasing++;
    else summary.stable++;

    if (a.anomalies.length > 0) summary.withAnomalies++;
    if (a.seasonality?.detected) summary.withSeasonality++;

    confSum += a.confidence;
  }

  summary.avgConfidence = analyses.length > 0 ? confSum / analyses.length : 0;

  return summary;
}

export default {
  analyzeTrend,
  analyzeMultipleTrends,
  compareTrends,
  getTrendSummary,
};