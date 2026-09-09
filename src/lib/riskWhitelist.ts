/* src/lib/riskWhitelist.js */

// Persistent whitelist of known safe Stellar addresses.
// The list is stored in localStorage under the key 'stellarRiskWhitelist'.
// Users can add addresses via UI extensions (not included here).

const STORAGE_KEY = 'stellarRiskWhitelist';

function loadWhitelist() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveWhitelist(set) {
  try {
    const arr = Array.from(set);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {}
}

export const whitelist = loadWhitelist();

/**
 * Returns true if the address is in the whitelist.
 */
export function isWhitelistedAddress(address) {
  return whitelist.has(address);
}

/**
 * Adds an address to the whitelist and persists it.
 */
export function addWhitelistedAddress(address) {
  if (!address) return;
  whitelist.add(address);
  saveWhitelist(whitelist);
}

/**
 * Removes an address from the whitelist.
 */
export function removeWhitelistedAddress(address) {
  whitelist.delete(address);
  saveWhitelist(whitelist);
}
