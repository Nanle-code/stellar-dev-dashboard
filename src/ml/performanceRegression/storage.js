/**
 * Performance Regression Detection — Baseline Storage
 * 
 * Persists performance metric baselines and historical observations to IndexedDB
 * using the existing storage infrastructure. Provides CRUD operations for baselines
 * and observation history.
 * 
 * Storage schema:
 *   - Key: metric name (string)
 *   - Value: { observations: [...], baseline: {...}, updatedAt: number }
 */

import { getStoredValue, setStoredValue, removeStoredValue } from '../../../lib/storage.js';

const STORAGE_PREFIX = 'perf-baseline:';
const MAX_OBSERVATIONS_PER_METRIC = 1000; // Prevent unbounded growth

/**
 * Load baseline and observations for a metric.
 * 
 * @param {string} metricName - Metric name
 * @returns {Promise<{ observations: Array, baseline: object | null, updatedAt: number } | null>}
 */
export async function loadMetricData(metricName) {
  try {
    const key = `${STORAGE_PREFIX}${metricName}`;
    const data = await getStoredValue(key);
    return data || null;
  } catch (error) {
    console.error(`Failed to load metric data for ${metricName}:`, error);
    return null;
  }
}

/**
 * Save baseline and observations for a metric.
 * 
 * @param {string} metricName - Metric name
 * @param {Array<{ value: number, timestamp: number }>} observations - Historical observations
 * @param {object} baseline - Computed baseline statistics
 * @returns {Promise<void>}
 */
export async function saveMetricData(metricName, observations, baseline) {
  try {
    // Limit observations to prevent storage bloat
    const limitedObs = observations.slice(-MAX_OBSERVATIONS_PER_METRIC);
    
    const data = {
      observations: limitedObs,
      baseline,
      updatedAt: Date.now(),
    };
    
    const key = `${STORAGE_PREFIX}${metricName}`;
    await setStoredValue(key, data);
  } catch (error) {
    console.error(`Failed to save metric data for ${metricName}:`, error);
  }
}

/**
 * Delete stored data for a metric.
 * 
 * @param {string} metricName - Metric name
 * @returns {Promise<void>}
 */
export async function deleteMetricData(metricName) {
  try {
    const key = `${STORAGE_PREFIX}${metricName}`;
    await removeStoredValue(key);
  } catch (error) {
    console.error(`Failed to delete metric data for ${metricName}:`, error);
  }
}

/**
 * Load baselines for multiple metrics.
 * 
 * @param {string[]} metricNames - Array of metric names
 * @returns {Promise<Record<string, object>>} Map of metric names to baselines
 */
export async function loadMultipleBaselines(metricNames) {
  const baselines = {};
  
  await Promise.all(
    metricNames.map(async (name) => {
      const data = await loadMetricData(name);
      if (data && data.baseline) {
        baselines[name] = data.baseline;
      }
    })
  );
  
  return baselines;
}

/**
 * Record a new observation for a metric and update its baseline.
 * 
 * @param {string} metricName - Metric name
 * @param {number} value - Observed value
 * @param {Function} computeBaselineFn - Function to recompute baseline from observations
 * @returns {Promise<{ baseline: object, observation: object }>}
 */
export async function recordObservation(metricName, value, computeBaselineFn) {
  // Load existing data
  let data = await loadMetricData(metricName);
  if (!data) {
    data = { observations: [], baseline: null, updatedAt: Date.now() };
  }
  
  // Add new observation
  const observation = { value, timestamp: Date.now() };
  data.observations.push(observation);
  
  // Recompute baseline
  const baseline = computeBaselineFn(data.observations);
  data.baseline = baseline;
  
  // Save updated data
  await saveMetricData(metricName, data.observations, baseline);
  
  return { baseline, observation };
}

/**
 * Clear all stored performance baselines (for testing/reset).
 * Note: This is a destructive operation.
 * 
 * @returns {Promise<number>} Number of metrics cleared
 */
export async function clearAllBaselines() {
  // Note: This is a simplified implementation that relies on storage.js
  // not providing a prefix-based query API. In production, consider adding
  // a dedicated store for performance baselines with cursor-based clearing.
  
  console.warn('clearAllBaselines: Manual clearing required. Metrics cleared: 0');
  return 0;
}

export { STORAGE_PREFIX, MAX_OBSERVATIONS_PER_METRIC };
