/**
 * Browser Storage Quota — detection, eviction selection, and recovery notifications
 *
 * Browsers throw different errors when persistent storage (IndexedDB, localStorage)
 * runs out of quota:
 *   - Modern browsers (Chrome, Edge, Safari, current Firefox): a `DOMException`
 *     with `name === 'QuotaExceededError'` (and legacy `code === 22`).
 *   - Older Firefox: `name === 'NS_ERROR_DOM_QUOTA_REACHED'` (and legacy `code === 1014`).
 *
 * This module is DOM/IndexedDB-agnostic on purpose so it can be unit tested without
 * a real (or faked) IndexedDB implementation. `storage.js` uses it to detect quota
 * errors on writes, decide which "safe" (re-fetchable) cache entries to evict first,
 * and notify subscribers so the UI can explain recovery options to the user.
 */

const QUOTA_ERROR_NAMES = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']);
const QUOTA_ERROR_CODES = new Set([22, 1014]);

/**
 * Determine whether an error represents a storage quota exhaustion failure.
 * Handles missing/invalid input gracefully (returns false rather than throwing).
 * @param {*} error
 * @returns {boolean}
 */
export function isQuotaExceededError(error) {
  if (!error || typeof error !== 'object') return false;

  if (typeof error.name === 'string' && QUOTA_ERROR_NAMES.has(error.name)) return true;
  if (typeof error.code === 'number' && QUOTA_ERROR_CODES.has(error.code)) return true;

  // Last resort: some environments only surface this in the message text.
  if (typeof error.message === 'string') {
    const message = error.message.toLowerCase();
    if (message.includes('quota') && (message.includes('exceed') || message.includes('reached') || message.includes('full'))) {
      return true;
    }
  }

  return false;
}

/**
 * Pick which cache records to evict to free up quota, given a maximum number
 * of entries to remove. Expired entries are evicted first (no cost to the user),
 * then the oldest still-alive entries (least likely to be reused soon).
 *
 * Pure function — no IndexedDB dependency — so it's independently testable.
 *
 * @param {Array<{ key: string, expiresAt: number, cachedAt: number }>} records
 * @param {number} maxEntries  Maximum number of entries to select for eviction
 * @param {number} [now]       Injectable clock for deterministic tests
 * @returns {Array<{ key: string, expiresAt: number, cachedAt: number }>}
 */
export function selectEvictionCandidates(records, maxEntries, now = Date.now()) {
  if (!Array.isArray(records) || maxEntries <= 0) return [];

  const expired = records.filter((r) => r.expiresAt <= now);
  const alive = records
    .filter((r) => r.expiresAt > now)
    .sort((a, b) => a.cachedAt - b.cachedAt);

  return [...expired, ...alive].slice(0, maxEntries);
}

/**
 * Whether the current environment supports querying storage usage/quota.
 * @returns {boolean}
 */
export function isStorageEstimateSupported() {
  return typeof navigator !== 'undefined' &&
    !!navigator.storage &&
    typeof navigator.storage.estimate === 'function';
}

/**
 * Read the browser's storage usage estimate, if supported.
 * Returns null in unsupported environments or on failure — never throws.
 * @returns {Promise<{ usage: number, quota: number, usageRatio: number }|null>}
 */
export async function getStorageEstimate() {
  if (!isStorageEstimateSupported()) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota, usageRatio: quota > 0 ? usage / quota : 0 };
  } catch {
    return null;
  }
}

// ─── Recovery notifications ────────────────────────────────────────────────────
// Plain pub/sub so this module has no React dependency. UI layers (e.g. a hook)
// subscribe to explain recovery options to the user when quota is exhausted.

const listeners = new Set();

/**
 * @typedef {Object} QuotaEvent
 * @property {string} store            Which store the write targeted (e.g. 'api-cache')
 * @property {string} [key]            The key being written, if applicable
 * @property {boolean} recovered       Whether eviction + retry freed enough space
 * @property {number} evictedCount     Number of entries evicted during recovery
 * @property {string} [fallback]       Fallback storage used, if any (e.g. 'localStorage')
 */

/**
 * Subscribe to quota-exceeded events.
 * @param {(event: QuotaEvent) => void} listener
 * @returns {() => void} Unsubscribe function
 */
export function onQuotaExceeded(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Emit a quota-exceeded event to all subscribers. Listener errors are swallowed
 * so a broken subscriber can never break a storage write.
 * @param {QuotaEvent} event
 */
export function notifyQuotaExceeded(event) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A subscriber (e.g. a UI toast) must never break the storage layer.
    }
  }
}

/**
 * Remove all subscribers. Exposed for test teardown.
 * @internal
 */
export function _resetQuotaListeners() {
  listeners.clear();
}
