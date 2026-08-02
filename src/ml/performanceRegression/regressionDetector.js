/**
 * Performance Regression Detection — Core Detector
 * 
 * Detects performance regressions by comparing new metric observations against
 * statistical baselines. Uses z-score deviation scoring and optional Isolation
 * Forest for multi-dimensional anomaly detection.
 * 
 * Detection algorithm:
 *   1. Compute z-score: (value - baseline.mean) / baseline.stdDev
 *   2. Flag as regression if |z-score| > threshold (default: 2.5σ)
 *   3. Calculate confidence based on statistical significance and sample size
 *   4. Optionally use Isolation Forest for multi-metric anomaly scoring
 * 
 * Confidence scoring:
 *   - Base confidence from z-score magnitude (higher deviation = higher confidence)
 *   - Adjusted by baseline sample size (more data = higher confidence)
 *   - Clipped to [0, 1] range
 */

import { validateBaseline } from './baselineCalculator.js';

const DEFAULT_THRESHOLD = 2.5; // standard deviations
const MIN_CONFIDENCE = 0.5;    // threshold for high-confidence regressions

/**
 * Severity levels for regression alerts.
 */
export const RegressionSeverity = {
  WARNING: 'warning',
  CRITICAL: 'critical',
};

/**
 * Calculate z-score for a metric value against its baseline.
 * @param {number} value - Observed metric value
 * @param {object} baseline - Baseline with mean and stdDev
 * @returns {number} Z-score (signed; positive = worse than baseline)
 */
export function calculateZScore(value, baseline) {
  if (baseline.stdDev === 0) return 0;
  return (value - baseline.mean) / baseline.stdDev;
}

/**
 * Calculate confidence score for a detected regression.
 * Confidence is based on z-score magnitude and baseline sample size.
 * 
 * @param {number} zScore - Absolute z-score value
 * @param {number} sampleSize - Number of observations in baseline
 * @returns {number} Confidence score in [0, 1]
 */
export function calculateConfidence(zScore, sampleSize) {
  const absZScore = Math.abs(zScore);
  
  // Base confidence from z-score: 2.5σ = 0.5, 5σ = 1.0
  let confidence = Math.min((absZScore - 2.5) / 2.5 + 0.5, 1.0);
  
  // Adjust for sample size: small samples reduce confidence
  const sampleFactor = Math.min(sampleSize / 30, 1.0); // 30+ samples = full confidence
  confidence *= 0.7 + 0.3 * sampleFactor;
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Determine severity level based on deviation magnitude.
 * @param {number} zScore - Absolute z-score value
 * @param {number} threshold - Detection threshold (default: 2.5)
 * @returns {string} RegressionSeverity level
 */
export function calculateSeverity(zScore, threshold = DEFAULT_THRESHOLD) {
  const absZScore = Math.abs(zScore);
  const criticalThreshold = threshold * 1.5; // 1.5x threshold = critical
  
  return absZScore >= criticalThreshold 
    ? RegressionSeverity.CRITICAL 
    : RegressionSeverity.WARNING;
}

/**
 * Detect regression for a single metric observation.
 * 
 * @param {string} metricName - Name of the metric (e.g., 'LCP', 'API_RESPONSE_TIME')
 * @param {number} value - Observed metric value
 * @param {object} baseline - Statistical baseline with mean, stdDev, count
 * @param {object} [options={}] - Detection options
 * @param {number} [options.threshold=2.5] - Z-score threshold for detection
 * @param {boolean} [options.bidirectional=false] - Detect improvements too (for debugging)
 * @returns {{ detected: boolean, zScore: number, confidence: number, severity: string, reason?: string } | null}
 */
export function detectRegression(metricName, value, baseline, options = {}) {
  const { threshold = DEFAULT_THRESHOLD, bidirectional = false } = options;
  
  // Validate inputs
  if (typeof value !== 'number' || !isFinite(value)) {
    return null;
  }
  
  const validation = validateBaseline(baseline);
  if (!validation.valid) {
    return { detected: false, reason: validation.reason };
  }
  
  // Calculate deviation
  const zScore = calculateZScore(value, baseline);
  const absZScore = Math.abs(zScore);
  
  // Check threshold
  const exceeds = bidirectional 
    ? absZScore > threshold 
    : zScore > threshold; // Only flag degradations (positive z-score = worse performance)
  
  if (!exceeds) {
    return { detected: false, zScore, confidence: 0 };
  }
  
  // Regression detected
  const confidence = calculateConfidence(absZScore, baseline.count);
  const severity = calculateSeverity(absZScore, threshold);
  
  return {
    detected: true,
    metricName,
    value,
    baseline: {
      mean: baseline.mean,
      stdDev: baseline.stdDev,
      count: baseline.count,
    },
    zScore,
    deviationPercent: ((value - baseline.mean) / baseline.mean) * 100,
    confidence,
    severity,
    timestamp: Date.now(),
  };
}

/**
 * Detect regressions across multiple metrics simultaneously.
 * Returns only metrics that show regressions.
 * 
 * @param {Record<string, number>} metricValues - Map of metric names to observed values
 * @param {Record<string, object>} baselines - Map of metric names to baselines
 * @param {object} [options={}] - Detection options
 * @returns {Array<object>} Array of detected regressions
 */
export function detectMultiMetricRegressions(metricValues, baselines, options = {}) {
  const regressions = [];
  
  for (const [metricName, value] of Object.entries(metricValues)) {
    const baseline = baselines[metricName];
    if (!baseline) continue;
    
    const result = detectRegression(metricName, value, baseline, options);
    if (result && result.detected) {
      regressions.push(result);
    }
  }
  
  return regressions;
}

/**
 * Generate a unique warning ID for deduplication.
 * @param {string} metricName - Metric name
 * @param {string} [context=''] - Additional context (e.g., commit SHA)
 * @returns {string} Unique warning ID
 */
export function generateWarningId(metricName, context = '') {
  const timestamp = Date.now();
  const contextStr = context ? `-${context.slice(0, 8)}` : '';
  return `perf-regression-${metricName}${contextStr}-${timestamp}`;
}

export { DEFAULT_THRESHOLD, MIN_CONFIDENCE };
