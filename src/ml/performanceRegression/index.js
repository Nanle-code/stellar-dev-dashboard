/**
 * Performance Regression Detection — Public API
 * 
 * Main entry point for the predictive performance regression detection system.
 * Orchestrates baseline management, regression detection, and warning emission.
 * 
 * Usage:
 *   import { analyzePerformanceMetrics, recordMetric } from './ml/performanceRegression';
 *   
 *   // Record ongoing metrics
 *   await recordMetric('LCP', 2400);
 *   
 *   // Analyze metrics for regressions
 *   const { regressions, warnings } = await analyzePerformanceMetrics({
 *     LCP: 3500,
 *     FCP: 2100,
 *     API_RESPONSE_TIME: 950,
 *   });
 */

import { computeBaseline, addObservation } from './baselineCalculator.js';
import { detectMultiMetricRegressions, MIN_CONFIDENCE } from './regressionDetector.js';
import { correlateWithCommits } from './changeCorrelation.js';
import { loadMetricData, saveMetricData, loadMultipleBaselines, recordObservation } from './storage.js';
import { emitWarning, emitBatchWarnings } from './earlyWarningSystem.js';

/**
 * Record a single metric observation and update its baseline.
 * 
 * @param {string} metricName - Metric name
 * @param {number} value - Observed value
 * @param {object} [options={}] - Options
 * @param {number} [options.lookbackDays=14] - Rolling window size
 * @returns {Promise<{ baseline: object, regression: object | null }>}
 */
export async function recordMetric(metricName, value, options = {}) {
  const { lookbackDays = 14 } = options;
  
  // Load existing data
  let data = await loadMetricData(metricName);
  if (!data) {
    data = { observations: [], baseline: null };
  }
  
  // Add observation
  const observations = addObservation(data.observations, value, Date.now(), lookbackDays);
  
  // Recompute baseline
  const baseline = computeBaseline(observations, lookbackDays);
  
  // Save
  await saveMetricData(metricName, observations, baseline);
  
  return { baseline, observations };
}

/**
 * Analyze multiple performance metrics for regressions.
 * Detects regressions, correlates with commits, and emits warnings.
 * 
 * @param {Record<string, number>} metricValues - Map of metric names to observed values
 * @param {object} [options={}] - Analysis options
 * @param {number} [options.threshold=2.5] - Z-score threshold for detection
 * @param {boolean} [options.emitWarnings=true] - Emit warnings through AlertCenter
 * @param {boolean} [options.correlateCommits=true] - Correlate with git commits
 * @returns {Promise<{ regressions: Array, warnings: Array, baselines: object }>}
 */
export async function analyzePerformanceMetrics(metricValues, options = {}) {
  const {
    threshold = 2.5,
    emitWarnings = true,
    correlateCommits = true,
  } = options;
  
  // Load baselines for all metrics
  const metricNames = Object.keys(metricValues);
  const baselines = await loadMultipleBaselines(metricNames);
  
  // Detect regressions
  const regressions = detectMultiMetricRegressions(metricValues, baselines, { threshold });
  
  if (regressions.length === 0) {
    return { regressions: [], warnings: [], baselines };
  }
  
  // Correlate with commits
  let warnings = [];
  if (emitWarnings) {
    const items = [];
    
    for (const regression of regressions) {
      const commits = correlateCommits ? await correlateWithCommits(regression) : [];
      items.push({ regression, commits });
    }
    
    const result = emitBatchWarnings(items);
    warnings = result.warnings;
  }
  
  return { regressions, warnings, baselines };
}

/**
 * Get high-confidence regressions that should fail CI.
 * 
 * @param {Array<object>} regressions - Array of detected regressions
 * @returns {Array<object>} High-confidence regressions
 */
export function getHighConfidenceRegressions(regressions) {
  return regressions.filter(r => r.confidence >= MIN_CONFIDENCE);
}

/**
 * Check if any high-confidence regression exists (for CI gate).
 * 
 * @param {Array<object>} regressions - Array of detected regressions
 * @returns {boolean}
 */
export function shouldFailCI(regressions) {
  return getHighConfidenceRegressions(regressions).length > 0;
}

// Re-export utilities
export { computeBaseline, addObservation } from './baselineCalculator.js';
export { detectRegression, calculateZScore, calculateConfidence } from './regressionDetector.js';
export { getRecentCommits, correlateWithCommits } from './changeCorrelation.js';
export { loadMetricData, saveMetricData, deleteMetricData } from './storage.js';
export { emitWarning, clearWarningHistory } from './earlyWarningSystem.js';
