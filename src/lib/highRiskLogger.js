/* src/lib/highRiskLogger.js */

// Utility for logging high‑risk transactions that the user approved.
// Stored in browser localStorage under the key 'stellarHighRiskLogs'.
// Each entry records minimal info to allow later review in the UI.

const STORAGE_KEY = 'stellarHighRiskLogs';

/**
 * Retrieve the current log array from localStorage.
 * @returns {Array<Object>} Array of log objects.
 */
export function getHighRiskLogs() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Append a new log entry for an approved high‑risk transaction.
 * @param {Object} entry - Information about the transaction.
 *   Expected fields: { transactionId, riskLevel, riskScore, timestamp, details }
 */
export function logApprovedHighRiskTransaction(entry) {
  if (!entry || !entry.transactionId) return;
  const logs = getHighRiskLogs();
  const enriched = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  };
  logs.push(enriched);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {}
}

/**
 * Clear all high‑risk logs (e.g., for debugging or user reset).
 */
export function clearHighRiskLogs() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
