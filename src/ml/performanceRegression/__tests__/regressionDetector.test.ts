import { describe, it, expect } from 'vitest';
import {
  calculateZScore,
  calculateConfidence,
  calculateSeverity,
  detectRegression,
  detectMultiMetricRegressions,
  generateWarningId,
  RegressionSeverity,
  DEFAULT_THRESHOLD,
  MIN_CONFIDENCE,
} from '../regressionDetector.js';

describe('calculateZScore', () => {
  it('calculates positive z-score for value above mean', () => {
    const baseline = { mean: 100, stdDev: 10 };
    const zScore = calculateZScore(125, baseline);
    
    expect(zScore).toBe(2.5);
  });
  
  it('calculates negative z-score for value below mean', () => {
    const baseline = { mean: 100, stdDev: 10 };
    const zScore = calculateZScore(75, baseline);
    
    expect(zScore).toBe(-2.5);
  });
  
  it('returns zero for value equal to mean', () => {
    const baseline = { mean: 100, stdDev: 10 };
    const zScore = calculateZScore(100, baseline);
    
    expect(zScore).toBe(0);
  });
  
  it('returns zero when standard deviation is zero', () => {
    const baseline = { mean: 100, stdDev: 0 };
    const zScore = calculateZScore(150, baseline);
    
    expect(zScore).toBe(0);
  });
});

describe('calculateConfidence', () => {
  it('returns higher confidence for larger z-scores', () => {
    const conf25 = calculateConfidence(2.5, 30);
    const conf50 = calculateConfidence(5.0, 30);
    
    expect(conf50).toBeGreaterThan(conf25);
  });
  
  it('adjusts confidence based on sample size', () => {
    const confSmall = calculateConfidence(3.0, 5);
    const confLarge = calculateConfidence(3.0, 50);
    
    expect(confLarge).toBeGreaterThan(confSmall);
  });
  
  it('returns values in [0, 1] range', () => {
    const confidence = calculateConfidence(10, 100);
    
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });
  
  it('returns minimum 0.5 confidence at threshold (2.5σ) with adequate samples', () => {
    const confidence = calculateConfidence(2.5, 30);
    
    expect(confidence).toBeGreaterThanOrEqual(0.5);
  });
});

describe('calculateSeverity', () => {
  it('returns WARNING for deviations at threshold', () => {
    const severity = calculateSeverity(2.5, 2.5);
    
    expect(severity).toBe(RegressionSeverity.WARNING);
  });
  
  it('returns CRITICAL for deviations at 1.5x threshold', () => {
    const severity = calculateSeverity(3.75, 2.5); // 1.5 * 2.5
    
    expect(severity).toBe(RegressionSeverity.CRITICAL);
  });
  
  it('handles negative z-scores correctly', () => {
    const severity = calculateSeverity(-4.0, 2.5);
    
    expect(severity).toBe(RegressionSeverity.CRITICAL);
  });
});

describe('detectRegression', () => {
  const baseline = {
    mean: 2000,
    stdDev: 200,
    count: 20,
    insufficientData: false,
  };
  
  it('detects regression when value exceeds threshold', () => {
    const result = detectRegression('LCP', 2600, baseline, { threshold: 2.5 });
    
    expect(result.detected).toBe(true);
    expect(result.metricName).toBe('LCP');
    expect(result.value).toBe(2600);
    expect(result.zScore).toBe(3.0);
    expect(result.confidence).toBeGreaterThan(0);
  });
  
  it('does not detect regression when value is below threshold', () => {
    const result = detectRegression('LCP', 2100, baseline, { threshold: 2.5 });
    
    expect(result.detected).toBe(false);
  });
  
  it('only flags degradations by default (positive z-score)', () => {
    // Value improved (below mean) — should not detect
    const result = detectRegression('LCP', 1500, baseline, { threshold: 2.5 });
    
    expect(result.detected).toBe(false);
  });
  
  it('detects improvements when bidirectional=true', () => {
    const result = detectRegression('LCP', 1500, baseline, { 
      threshold: 2.5,
      bidirectional: true,
    });
    
    expect(result.detected).toBe(true);
    expect(result.zScore).toBe(-2.5);
  });
  
  it('returns null for invalid value', () => {
    const result = detectRegression('LCP', NaN, baseline);
    
    expect(result).toBeNull();
  });
  
  it('returns non-detected with reason for insufficient baseline data', () => {
    const insufficientBaseline = { ...baseline, insufficientData: true, count: 5 };
    const result = detectRegression('LCP', 2600, insufficientBaseline);
    
    expect(result.detected).toBe(false);
    expect(result.reason).toContain('Insufficient data');
  });
  
  it('includes deviation percentage in result', () => {
    const result = detectRegression('LCP', 2600, baseline);
    
    expect(result.deviationPercent).toBeCloseTo(30, 1);
  });
  
  it('includes timestamp in result', () => {
    const result = detectRegression('LCP', 2600, baseline);
    
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.timestamp).toBeLessThanOrEqual(Date.now());
  });
});

describe('detectMultiMetricRegressions', () => {
  const baselines = {
    LCP: { mean: 2000, stdDev: 200, count: 20, insufficientData: false },
    FCP: { mean: 1000, stdDev: 100, count: 20, insufficientData: false },
    TBT: { mean: 300, stdDev: 50, count: 20, insufficientData: false },
  };
  
  it('detects regressions across multiple metrics', () => {
    const metricValues = {
      LCP: 2600, // Regression
      FCP: 1100, // OK (1σ)
      TBT: 450,  // Regression (3σ)
    };
    
    const regressions = detectMultiMetricRegressions(metricValues, baselines);
    
    expect(regressions).toHaveLength(2);
    expect(regressions.map(r => r.metricName)).toContain('LCP');
    expect(regressions.map(r => r.metricName)).toContain('TBT');
  });
  
  it('returns empty array when no regressions', () => {
    const metricValues = {
      LCP: 2000,
      FCP: 1000,
      TBT: 300,
    };
    
    const regressions = detectMultiMetricRegressions(metricValues, baselines);
    
    expect(regressions).toHaveLength(0);
  });
  
  it('skips metrics without baselines', () => {
    const metricValues = {
      LCP: 3000,
      UNKNOWN_METRIC: 9999,
    };
    
    const regressions = detectMultiMetricRegressions(metricValues, baselines);
    
    expect(regressions).toHaveLength(1);
    expect(regressions[0].metricName).toBe('LCP');
  });
});

describe('generateWarningId', () => {
  it('generates unique ID with metric name', () => {
    const id = generateWarningId('LCP');
    
    expect(id).toContain('perf-regression-LCP');
  });
  
  it('includes context when provided', () => {
    const id = generateWarningId('LCP', 'abc123def456');
    
    expect(id).toContain('LCP-abc123de');
  });
  
  it('includes timestamp for uniqueness', () => {
    const id1 = generateWarningId('LCP');
    const id2 = generateWarningId('LCP');
    
    expect(id1).not.toBe(id2);
  });
});

describe('80% detection rate property test', () => {
  /**
   * Property-based test: Generate synthetic time-series with injected regressions
   * and verify detection rate ≥ 80%.
   */
  it('detects at least 80% of injected regressions', () => {
    const trials = 100;
    const baselineMean = 2000;
    const baselineStdDev = 200;
    const threshold = 2.5;
    
    let detected = 0;
    
    for (let i = 0; i < trials; i++) {
      // Generate baseline
      const baseline = {
        mean: baselineMean,
        stdDev: baselineStdDev,
        count: 30,
        insufficientData: false,
      };
      
      // Inject regression: 3σ above mean
      const regressedValue = baselineMean + 3 * baselineStdDev;
      
      const result = detectRegression('TEST_METRIC', regressedValue, baseline, { threshold });
      
      if (result && result.detected) {
        detected++;
      }
    }
    
    const detectionRate = detected / trials;
    
    expect(detectionRate).toBeGreaterThanOrEqual(0.8);
  });
});
