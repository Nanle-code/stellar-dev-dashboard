// src/lib/reputationSystem.js

// Safe storage wrapper with memory fallback for testing environments
let memoryStorage = {};
const storage = {
  getItem(key) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        // Fallback if localStorage is disabled/restricted
      }
    }
    return memoryStorage[key] || null;
  },
  setItem(key, value) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback
      }
    }
    memoryStorage[key] = value;
  },
  clear() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.clear();
      } catch (e) {
        // Fallback
      }
    }
    memoryStorage = {};
  }
};

const WHITELIST_KEY = 'stellar_reputation_whitelist';
const REPORTS_KEY = 'stellar_reputation_reports';
const BLACKLIST_KEY = 'stellar_reputation_blacklist';

// Helper to get whitelist from storage
function getWhitelist() {
  const data = storage.getItem(WHITELIST_KEY);
  return data ? JSON.parse(data) : [];
}

// Helper to save whitelist to storage
function saveWhitelist(whitelist) {
  storage.setItem(WHITELIST_KEY, JSON.stringify(whitelist));
}

// Helper to get reports from storage
function getReports() {
  const data = storage.getItem(REPORTS_KEY);
  return data ? JSON.parse(data) : {};
}

// Helper to save reports to storage
function saveReports(reports) {
  storage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

// Helper to get manual blacklist
function getBlacklist() {
  const data = storage.getItem(BLACKLIST_KEY);
  return data ? JSON.parse(data) : [];
}

// Helper to save manual blacklist
function saveBlacklist(blacklist) {
  storage.setItem(BLACKLIST_KEY, JSON.stringify(blacklist));
}

/**
 * Check if address is whitelisted
 * @param {string} address - Stellar address
 * @returns {boolean} True if whitelisted
 */
export function isAddressWhitelisted(address) {
  if (!address) return false;
  return getWhitelist().includes(address);
}

/**
 * Add address to whitelist
 * @param {string} address - Stellar address
 */
export function whitelistAddress(address) {
  if (!address) return;
  const whitelist = getWhitelist();
  if (!whitelist.includes(address)) {
    whitelist.push(address);
    saveWhitelist(whitelist);
  }
  // Also remove from blacklist if whitelisted
  const blacklist = getBlacklist();
  const index = blacklist.indexOf(address);
  if (index > -1) {
    blacklist.splice(index, 1);
    saveBlacklist(blacklist);
  }
}

/**
 * Remove address from whitelist
 * @param {string} address - Stellar address
 */
export function unwhitelistAddress(address) {
  if (!address) return;
  const whitelist = getWhitelist();
  const index = whitelist.indexOf(address);
  if (index > -1) {
    whitelist.splice(index, 1);
    saveWhitelist(whitelist);
  }
}

/**
 * Add address to manual blacklist
 * @param {string} address - Stellar address
 */
export function blacklistAddress(address) {
  if (!address) return;
  const blacklist = getBlacklist();
  if (!blacklist.includes(address)) {
    blacklist.push(address);
    saveBlacklist(blacklist);
  }
  // Remove from whitelist if blacklisted
  unwhitelistAddress(address);
}

/**
 * Report a malicious address
 * @param {string} address - Stellar address
 * @param {string} reason - Reason for report
 */
export function reportMaliciousAddress(address, reason = '') {
  if (!address) return;
  const reports = getReports();
  if (!reports[address]) {
    reports[address] = {
      count: 0,
      reasons: [],
      reportedAt: []
    };
  }
  
  reports[address].count += 1;
  if (reason && !reports[address].reasons.includes(reason)) {
    reports[address].reasons.push(reason);
  }
  reports[address].reportedAt.push(new Date().toISOString());
  
  saveReports(reports);
  
  // If reported 3 or more times, auto-add to blacklist
  if (reports[address].count >= 3) {
    blacklistAddress(address);
  }
}

/**
 * Calculate reputation score for an address
 * @param {string} address - Stellar address
 * @param {object} details - Additional risk factors for deduction
 * @param {boolean} [details.recipientIsNew] - Is the recipient a new/unestablished account?
 * @param {boolean} [details.isDomainSuspicious] - Is there a suspicious domain associated?
 * @returns {number} Reputation score from 0.0 (unsafe) to 1.0 (safe)
 */
export function getReputationScore(address, { recipientIsNew = false, isDomainSuspicious = false } = {}) {
  if (!address) return 0.8;
  
  // Whitelisted address always gets 1.0 (legitimate)
  if (isAddressWhitelisted(address)) {
    return 1.0;
  }
  
  // Explicitly blacklisted address gets 0.0 (malicious)
  if (getBlacklist().includes(address)) {
    return 0.0;
  }
  
  // Baseline reputation score
  let score = 0.8;
  
  // 1. Deduct based on reports (0.2 per report, up to 0.6 max)
  const reports = getReports();
  const addressReports = reports[address]?.count || 0;
  const reportDeduction = Math.min(0.6, addressReports * 0.2);
  score -= reportDeduction;
  
  // 2. Deduct if domain verification is unverified or suspicious
  if (isDomainSuspicious) {
    score -= 0.3;
  }
  
  // 3. Deduct if recipient is a new/unestablished account
  if (recipientIsNew) {
    score -= 0.1;
  }
  
  // Clamp reputation score between 0.0 and 1.0
  return parseFloat(Math.max(0.0, Math.min(1.0, score)).toFixed(2));
}

/**
 * Clear all reputation data (useful for test isolation)
 */
export function clearReputationData() {
  storage.clear();
}
