import { describe, it, expect } from 'vitest';
import {
  analyzeTrend,
  analyzeMultipleTrends,
  compareTrends,
  getTrendSummary,
  type TrendAnalysis,
  type MetricSeries,
} from '../trendAnalyzer.js';

describe('trendAnalyzer', () => {
  const createSeries = (name: string, values: number[], baseTime = Date.now() - 60000 * 10): MetricSeries => ({
    name,
    points: values.map((value, i) => ({
      timestamp: baseTime + i * 60000,
      value,
    })),
  });

  describe('analyzeTrend', () => {
    it('returns null for insufficient data points', () => {
      const series = createSeries('test', [100]);
      const result = analyzeTrend(series, { minPointsForTrend: 3 });
      expect(result).toBeNull();
    });

    it('detects increasing trend', () => {
      const series = createSeries('increasing', [100, 150, 200, 250, 300]);
      const result = analyzeTrend(series);
      expect(result).not.toBeNull();
      expect(result?.direction).toBe('increasing');
      expect(result?.slope).toBeGreaterThan(0);
      expect(result?.rSquared).toBeCloseTo(1, 1);
    });

    it('detects decreasing trend', () => {
      const series = createSeries('decreasing', [300, 250, 200, 150, 100]);
      const result = analyzeTrend(series);
      expect(result).not.toBeNull();
      expect(result?.direction).toBe('decreasing');
      expect(result?.slope).toBeLessThan(0);
      expect(result?.rSquared).toBeCloseTo(1, 1);
    });

    it('detects stable trend', () => {
      const series = createSeries('stable', [100, 102, 98, 101, 99]);
      const result = analyzeTrend(series);
      expect(result).not.toBeNull();
      expect(result?.direction).toBe('stable');
      expect(Math.abs(result?.slope ?? 0)).toBeLessThan(5);
    });

    it('computes R-squared correctly', () => {
      // Perfect linear relationship
      const series = createSeries('perfect', [10, 20, 30, 40, 50]);
      const result = analyzeTrend(series);
      expect(result?.rSquared).toBeCloseTo(1, 2);

      // Noisy data
      const noisy = createSeries('noisy', [10, 15, 18, 25, 32]);
      const noisyResult = analyzeTrend(noisy);
      expect(noisyResult?.rSquared).toBeLessThan(1);
      expect(noisyResult?.rSquared).toBeGreaterThan(0);
    });

    it('calculates confidence based on R-squared and sample size', () => {
      const smallSeries = createSeries('small', [100, 150]);
      const largeSeries = createSeries('large', [100, 110, 120, 130, 140, 150, 160, 170, 180, 190]);

      const smallResult = analyzeTrend(smallSeries, { minPointsForTrend: 2 });
      const largeResult = analyzeTrend(largeSeries);

      // Larger sample should have higher confidence (more points factor)
      expect(largeResult?.confidence).toBeGreaterThan(smallResult?.confidence ?? 0);
    });

    it('detects anomalies', () => {
      const series = createSeries('with-anomaly', [100, 105, 1000, 110, 105]);
      const result = analyzeTrend(series, { anomalyThreshold: 1.5 });
      expect(result).not.toBeNull();
      expect(result?.anomalies.length).toBeGreaterThan(0);
      const anomaly = result?.anomalies[0];
      expect(anomaly?.actual).toBe(1000);
    });

    it('detects seasonality in periodic data', () => {
      // Create a periodic pattern
      const values = [];
      for (let i = 0; i < 30; i++) {
        values.push(100 + 50 * Math.sin((i * 2 * Math.PI) / 10));
      }
      const series = createSeries('seasonal', values);
      const result = analyzeTrend(series, { seasonalityDetection: true });
      expect(result).not.toBeNull();
      expect(result?.seasonality?.detected).toBe(true);
    });

    it('generates forecast', () => {
      const series = createSeries('forecast', [100, 110, 120, 130, 140]);
      const result = analyzeTrend(series, { forecastHorizon: 5 });
      expect(result).not.toBeNull();
      expect(result?.forecast).toBeDefined();
      expect(result?.forecast?.length).toBe(5);
      expect(result?.forecast?.[0].predicted).toBeGreaterThan(140);
      expect(result?.forecast?.[0].lowerBound).toBeLessThan(result?.forecast?.[0].predicted);
      expect(result?.forecast?.[0].upperBound).toBeGreaterThan(result?.forecast?.[0].predicted);
    });

    it('includes trend line points', () => {
      const series = createSeries('trendline', [100, 120, 140, 160]);
      const result = analyzeTrend(series);
      expect(result?.trendLine.length).toBe(4);
      expect(result?.trendLine[0].predicted).toBeCloseTo(100, 0);
      expect(result?.trendLine[3].predicted).toBeCloseTo(160, 0);
    });
  });

  describe('analyzeMultipleTrends', () => {
    it('analyzes multiple series', () => {
      const series1 = createSeries('api1', [100, 120, 140]);
      const series2 = createSeries('api2', [200, 180, 160]);
      const series3 = createSeries('api3', [50, 55, 52]);

      const results = analyzeMultipleTrends([series1, series2, series3]);
      expect(results.length).toBe(3);
      expect(results.find((r) => r.name === 'api1')?.direction).toBe('increasing');
      expect(results.find((r) => r.name === 'api2')?.direction).toBe('decreasing');
      expect(results.find((r) => r.name === 'api3')?.direction).toBe('stable');
    });

    it('filters out series with insufficient data', () => {
      const goodSeries = createSeries('good', [100, 110, 120]);
      const badSeries = createSeries('bad', [100]);

      const results = analyzeMultipleTrends([goodSeries, badSeries], { minPointsForTrend: 3 });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('good');
    });
  });

  describe('compareTrends', () => {
    it('computes correlation between trends', () => {
      const analysis1: TrendAnalysis = {
        name: 'api1',
        slope: 10,
        intercept: 100,
        rSquared: 0.95,
        direction: 'increasing',
        confidence: 0.9,
        points: 5,
        timeRange: { start: 0, end: 100 },
        trendLine: [
          { timestamp: 1, predicted: 110 },
          { timestamp: 2, predicted: 120 },
          { timestamp: 3, predicted: 130 },
        ],
        anomalies: [],
      };

      const analysis2: TrendAnalysis = {
        name: 'api2',
        slope: 10,
        intercept: 200,
        rSquared: 0.95,
        direction: 'increasing',
        confidence: 0.9,
        points: 5,
        timeRange: { start: 0, end: 100 },
        trendLine: [
          { timestamp: 1, predicted: 210 },
          { timestamp: 2, predicted: 220 },
          { timestamp: 3, predicted: 230 },
        ],
        anomalies: [],
      };

      const comparison = compareTrends(analysis1, analysis2);
      expect(comparison.correlation).toBeCloseTo(1, 1);
      expect(comparison.similarDirection).toBe(true);
    });

    it('detects divergent trends', () => {
      const analysis1: TrendAnalysis = {
        name: 'api1',
        slope: 10,
        intercept: 100,
        rSquared: 0.95,
        direction: 'increasing',
        confidence: 0.9,
        points: 5,
        timeRange: { start: 0, end: 100 },
        trendLine: [
          { timestamp: 1, predicted: 110 },
          { timestamp: 2, predicted: 120 },
        ],
        anomalies: [],
      };

      const analysis2: TrendAnalysis = {
        name: 'api2',
        slope: -10,
        intercept: 200,
        rSquared: 0.95,
        direction: 'decreasing',
        confidence: 0.9,
        points: 5,
        timeRange: { start: 0, end: 100 },
        trendLine: [
          { timestamp: 1, predicted: 190 },
          { timestamp: 2, predicted: 180 },
        ],
        anomalies: [],
      };

      const comparison = compareTrends(analysis1, analysis2);
      expect(comparison.correlation).toBeCloseTo(-1, 1);
      expect(comparison.similarDirection).toBe(false);
      expect(comparison.divergence).toBeGreaterThan(0);
    });
  });

  describe('getTrendSummary', () => {
    it('summarizes multiple trend analyses', () => {
      const analyses: TrendAnalysis[] = [
        {
          name: 'a',
          slope: 1,
          intercept: 0,
          rSquared: 0.9,
          direction: 'increasing',
          confidence: 0.9,
          points: 10,
          timeRange: { start: 0, end: 100 },
          trendLine: [],
          anomalies: [],
        },
        {
          name: 'b',
          slope: -1,
          intercept: 100,
          rSquared: 0.8,
          direction: 'decreasing',
          confidence: 0.8,
          points: 10,
          timeRange: { start: 0, end: 100 },
          trendLine: [],
          anomalies: [{ index: 0, timestamp: 0, actual: 10, predicted: 5, residual: 5, severity: 'low' }],
        },
        {
          name: 'c',
          slope: 0,
          intercept: 50,
          rSquared: 0.1,
          direction: 'stable',
          confidence: 0.5,
          points: 10,
          timeRange: { start: 0, end: 100 },
          trendLine: [],
          anomalies: [],
        },
      ];

      const summary = getTrendSummary(analyses);
      expect(summary.total).toBe(3);
      expect(summary.increasing).toBe(1);
      expect(summary.decreasing).toBe(1);
      expect(summary.stable).toBe(1);
      expect(summary.withAnomalies).toBe(1);
      expect(summary.avgConfidence).toBeCloseTo(0.733, 2);
    });
  });
});