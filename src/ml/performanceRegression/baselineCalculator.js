/**
 * Performance Regression Detection — Baseline Calculator
 * 
 * Computes rolling statistical baselines (mean, stdDev) for performance metrics
 * using a configurable lookback window. Baselines are persisted to IndexedDB
 * and used by the regression detector to identify anomalous measurements.
 * 
 * Algorithm:
 *   For each metric, maintains a time-series of recent observations within
 *   the lookback window. Calculates mean and standard deviation using
 *   Welford's online algorithm for numerical stability.
 * 
 * Assumptions:
 *   - Metric distributions are approximately normal (validated via statistical tests)
 *   - Performance does not have strong seasonal patterns within the lookback window
 *   - Sufficient data points (minimum 7) are required for reliable statistics
 * 
 * Limitations:
 *   - Does not handle concept drift (baseline resets if mean shifts significantly)
 *   - Simple rolling window; does not account for weekday/weekend patterns
 *   - May flag legitimate improvements as regressions (alerts for better performance too)
 */

const DEFAULT_LOOKBACK_DAYS = 14;
const MIN_DATA_POINTS = 7;

/**
 * Calculate mean and standard deviation for a dataset.
 * Uses Welford's online algorithm for numerical stability.
 * @param {number[]} values - Array of numeric observations
 * @returns {{ mean: number, stdDev: number, count: number }}
 */
export function calculateStats(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { mean: 0, stdDev: 0, count: 0 };
  }

  let count = 0;
  let mean = 0;
  let m2 = 0;

  for (const value of values) {
    if (typeof value !== 'number' || !isFinite(value)) continue;
    count += 1;
    const delta = value - mean;
    mean += delta / count;
    const delta2 = value - mean;
    m2 += delta * delta2;
  }

  const variance = count > 1 ? m2 / (count - 1) : 0;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev, count };
}

/**
 * Compute a rolling baseline for a metric given its historical observations.
 * Only observations within the lookback window are included.
 * 
 * @param {Array<{ value: number, timestamp: number }>} observations - Historical data points
 * @param {number} [lookbackDays=14] - Number of days to include in rolling window
 * @returns {{ mean: number, stdDev: number, count: number, insufficientData: boolean }}
 */
export function computeBaseline(observations, lookbackDays = DEFAULT_LOOKBACK_DAYS) {
  const now = Date.now();
  const cutoff = now - lookbackDays * 24 * 60 * 60 * 1000;

  const recentValues = observations
    .filter(obs => obs.timestamp >= cutoff && typeof obs.value === 'number' && isFinite(obs.value))
    .map(obs => obs.value);

  const stats = calculateStats(recentValues);
  const insufficientData = stats.count < MIN_DATA_POINTS;

  return {
    ...stats,
    insufficientData,
    lookbackDays,
    computedAt: now,
  };
}

/**
 * Add a new observation to the historical dataset and prune old entries.
 * @param {Array<{ value: number, timestamp: number }>} observations - Existing observations
 * @param {number} value - New metric value
 * @param {number} [timestamp=Date.now()] - Observation timestamp
 * @param {number} [lookbackDays=14] - Retention window in days
 * @returns {Array<{ value: number, timestamp: number }>} Updated observations
 */
export function addObservation(observations, value, timestamp = Date.now(), lookbackDays = DEFAULT_LOOKBACK_DAYS) {
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new Error(`Invalid metric value: ${value}`);
  }

  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  const pruned = observations.filter(obs => obs.timestamp >= cutoff);
  pruned.push({ value, timestamp });
  
  return pruned;
}

/**
 * Validate that a baseline has sufficient data for regression detection.
 * @param {object} baseline - Baseline object from computeBaseline
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateBaseline(baseline) {
  if (!baseline) {
    return { valid: false, reason: 'Baseline not found' };
  }

  if (baseline.insufficientData) {
    return { 
      valid: false, 
      reason: `Insufficient data: ${baseline.count} observations (minimum: ${MIN_DATA_POINTS})` 
    };
  }

  if (baseline.stdDev === 0) {
    return { 
      valid: false, 
      reason: 'Zero standard deviation (constant metric values)' 
    };
  }

  return { valid: true };
}

export { DEFAULT_LOOKBACK_DAYS, MIN_DATA_POINTS };
