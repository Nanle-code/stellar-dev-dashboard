/**
 * Performance Regression Detection — Early Warning System
 * 
 * Emits regression warnings using the existing AlertCenter infrastructure.
 * Provides deduplication, severity mapping, and warning payload formatting.
 * 
 * Integration:
 *   - Uses src/lib/alerts.js AlertCenter for pub/sub notification
 *   - Maps regression severity to AlertCenter severity levels
 *   - Includes correlated commits in warning descriptions
 */

import { alertCenter, ALERT_SEVERITY } from '../../../lib/alerts.js';
import { generateWarningId } from './regressionDetector.js';
import { formatCommitSummary } from './changeCorrelation.js';

const WARNING_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Track emitted warnings for deduplication
const _emittedWarnings = new Map();

/**
 * Map regression severity to AlertCenter severity.
 * @param {string} regressionSeverity - 'warning' or 'critical'
 * @returns {string} AlertCenter severity level
 */
function mapSeverity(regressionSeverity) {
  switch (regressionSeverity) {
    case 'critical':
      return ALERT_SEVERITY.CRITICAL;
    case 'warning':
      return ALERT_SEVERITY.WARNING;
    default:
      return ALERT_SEVERITY.INFO;
  }
}

/**
 * Format a regression detection result into a warning payload.
 * 
 * @param {object} regression - Detected regression object
 * @param {Array<object>} [commits=[]] - Correlated commits
 * @returns {object} Alert payload for AlertCenter
 */
export function formatWarningPayload(regression, commits = []) {
  const {
    metricName,
    value,
    baseline,
    zScore,
    deviationPercent,
    confidence,
    severity,
    timestamp,
  } = regression;
  
  const warningId = generateWarningId(metricName, commits[0]?.hash);
  
  // Build description
  let description = [
    `Current value: ${value.toFixed(2)}`,
    `Baseline: ${baseline.mean.toFixed(2)} ± ${baseline.stdDev.toFixed(2)} (n=${baseline.count})`,
    `Deviation: ${deviationPercent.toFixed(1)}% (${zScore.toFixed(2)}σ)`,
    `Confidence: ${(confidence * 100).toFixed(0)}%`,
  ];
  
  if (commits.length > 0) {
    description.push('', '**Recent commits:**', formatCommitSummary(commits, 3));
  }
  
  return {
    id: warningId,
    severity: mapSeverity(severity),
    title: `Performance regression detected: ${metricName}`,
    description: description.join('\n'),
    timestamp,
    metadata: {
      metricName,
      value,
      baselineMean: baseline.mean,
      baselineStdDev: baseline.stdDev,
      zScore,
      confidence,
      commits: commits.map(c => ({
        hash: c.hash.slice(0, 8),
        author: c.author,
        message: c.message,
      })),
    },
  };
}

/**
 * Check if a warning has already been emitted recently (deduplication).
 * 
 * @param {string} warningId - Warning ID
 * @returns {boolean} True if warning was recently emitted
 */
function isDuplicate(warningId) {
  const lastEmitted = _emittedWarnings.get(warningId);
  if (!lastEmitted) return false;
  
  const elapsed = Date.now() - lastEmitted;
  return elapsed < WARNING_RETENTION_MS;
}

/**
 * Emit a regression warning through the AlertCenter.
 * Deduplicates warnings within a 24-hour window.
 * 
 * @param {object} regression - Detected regression
 * @param {Array<object>} [commits=[]] - Correlated commits
 * @returns {{ emitted: boolean, warning: object | null }}
 */
export function emitWarning(regression, commits = []) {
  const warning = formatWarningPayload(regression, commits);
  
  // Check for duplicates
  if (isDuplicate(warning.id)) {
    return { emitted: false, warning: null, reason: 'Duplicate warning suppressed' };
  }
  
  // Emit warning
  alertCenter.push([warning]);
  
  // Track emission
  _emittedWarnings.set(warning.id, Date.now());
  
  // Prune old entries
  pruneExpiredWarnings();
  
  return { emitted: true, warning };
}

/**
 * Emit multiple regression warnings in a batch.
 * 
 * @param {Array<{ regression: object, commits: Array }>} items - Array of regression/commit pairs
 * @returns {{ emitted: number, warnings: Array<object> }}
 */
export function emitBatchWarnings(items) {
  const warnings = [];
  let emittedCount = 0;
  
  for (const { regression, commits } of items) {
    const result = emitWarning(regression, commits);
    if (result.emitted) {
      warnings.push(result.warning);
      emittedCount++;
    }
  }
  
  return { emitted: emittedCount, warnings };
}

/**
 * Prune expired warning records from deduplication map.
 */
function pruneExpiredWarnings() {
  const now = Date.now();
  for (const [id, timestamp] of _emittedWarnings.entries()) {
    if (now - timestamp > WARNING_RETENTION_MS) {
      _emittedWarnings.delete(id);
    }
  }
}

/**
 * Clear all emitted warning records (for testing).
 */
export function clearWarningHistory() {
  _emittedWarnings.clear();
}

/**
 * Get count of tracked warnings (for debugging).
 * @returns {number}
 */
export function getWarningCount() {
  return _emittedWarnings.size;
}
