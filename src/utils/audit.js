/**
 * Audit Trail Utilities (#118, #447)
 *
 * Provides:
 *  - Tamper-evident audit log records (each entry hash-chained to its predecessor)
 *  - In-memory ring buffer for fast reads + IndexedDB persistence
 *  - Severity levels and category enums
 *  - PII / secret redaction before persistence
 *  - Export helpers (JSON / CSV) for compliance review
 *  - Subscription API for real-time audit viewers
 *  - Compliance context enrichment (#447)
 *  - Multi-environment tagging (#447)
 */

import { getStoredValue, setStoredValue } from '../lib/storage.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const AuditSeverity = Object.freeze({
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const AuditCategory = Object.freeze({
  AUTH: 'auth',
  WALLET: 'wallet',
  TRANSACTION: 'transaction',
  CONTRACT: 'contract',
  NETWORK: 'network',
  CONFIG: 'config',
  DATA_ACCESS: 'data_access',
  EXPORT: 'export',
  SECURITY: 'security',
  ADMIN: 'admin',
  SYSTEM: 'system',
  COMPLIANCE: 'compliance',
  RETENTION: 'retention',
  ANALYTICS: 'analytics',
});

export const AuditComplianceTag = Object.freeze({
  SOC2: 'soc2',
  GDPR: 'gdpr',
  SOX: 'sox',
  PCI_DSS: 'pci_dss',
  INTERNAL: 'internal',
});

export const AuditEnvironment = Object.freeze({
  PRODUCTION: 'production',
  STAGING: 'staging',
  DEVELOPMENT: 'development',
  TEST: 'test',
});

const STORAGE_KEY = 'audit-log';
const MAX_RING_SIZE = 1000;

// ─── State ────────────────────────────────────────────────────────────────────

const _ring = [];
let _lastHash = '0';
let _sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
let _hydrated = false;
const _subscribers = new Set();

// ─── Hashing (browser SubtleCrypto with fallback) ─────────────────────────────

async function hashEntry(payload) {
  const str = JSON.stringify(payload);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback: lightweight non-crypto hash (still deterministic & chained)
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ─── Redaction ────────────────────────────────────────────────────────────────

const SECRET_KEY_PATTERN = /\bS[A-Z2-7]{55}\b/g;
const SENSITIVE_FIELD_NAMES = new Set([
  'secret', 'secretKey', 'privateKey', 'seed', 'mnemonic',
  'password', 'passphrase', 'token', 'apiKey', 'authorization',
]);

export function redactSensitive(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.replace(SECRET_KEY_PATTERN, '[REDACTED_SECRET_KEY]');
  }
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_FIELD_NAMES.has(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSensitive(v);
      }
    }
    return out;
  }
  return value;
}

// ─── Hydration / persistence ─────────────────────────────────────────────────

async function hydrate() {
  if (_hydrated || typeof window === 'undefined') return;
  _hydrated = true;
  try {
    const stored = await getStoredValue(STORAGE_KEY);
    if (Array.isArray(stored) && stored.length) {
      _ring.push(...stored.slice(-MAX_RING_SIZE));
      _lastHash = _ring[_ring.length - 1]?.hash ?? '0';
    }
  } catch {
    // Storage unavailable — operate in-memory only
  }
}

async function persist() {
  if (typeof window === 'undefined') return;
  try {
    await setStoredValue(STORAGE_KEY, _ring);
  } catch {
    // Best-effort persistence
  }
}

// Kick off hydration on module load
hydrate();

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeAudit(handler) {
  _subscribers.add(handler);
  return () => _subscribers.delete(handler);
}

function notify(entry) {
  for (const fn of _subscribers) {
    try { fn(entry); } catch { /* swallow subscriber errors */ }
  }
}

// ─── Recording ───────────────────────────────────────────────────────────────

let _seq = 0;

export async function recordAudit({
  action,
  category = AuditCategory.SYSTEM,
  severity = AuditSeverity.INFO,
  actor = null,
  target = null,
  outcome = 'success',
  metadata = {},
  complianceTags = [],
  environment = null,
  source = null,
  correlationId = null,
} = {}) {
  if (!action || typeof action !== 'string') {
    throw new Error('audit.record requires a string action');
  }
  await hydrate();

  const base = {
    id: `audit-${Date.now()}-${(++_seq).toString(36)}`,
    timestamp: new Date().toISOString(),
    action,
    category,
    severity,
    actor,
    target,
    outcome,
    metadata: redactSensitive(metadata),
    sessionId: _sessionId,
    url: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    complianceTags: complianceTags.length > 0 ? complianceTags : undefined,
    environment: environment || undefined,
    source: source || undefined,
    correlationId: correlationId || undefined,
    prevHash: _lastHash,
  };

  const hash = await hashEntry(base);
  const entry = { ...base, hash };

  _ring.push(entry);
  if (_ring.length > MAX_RING_SIZE) _ring.shift();
  _lastHash = hash;

  // Mirror critical events to the console for live debugging
  if (severity === AuditSeverity.CRITICAL || severity === AuditSeverity.HIGH) {
    // eslint-disable-next-line no-console
    console.warn(`[audit:${severity}] ${action}`, metadata);
  }

  notify(entry);
  // Fire-and-forget persistence so callers don't await disk I/O
  persist();
  return entry;
}

// ─── Query API ───────────────────────────────────────────────────────────────

export function getAuditEntries({
  category,
  severity,
  actor,
  search,
  since,
  until,
  limit = 200,
  outcome,
  sessionId,
  complianceTag,
  environment,
  source,
  correlationId,
} = {}) {
  let entries = _ring.slice();

  if (category) entries = entries.filter((e) => e.category === category);
  if (severity) entries = entries.filter((e) => e.severity === severity);
  if (actor) entries = entries.filter((e) => e.actor === actor);
  if (outcome) entries = entries.filter((e) => e.outcome === outcome);
  if (sessionId) entries = entries.filter((e) => e.sessionId === sessionId);
  if (environment) entries = entries.filter((e) => e.environment === environment);
  if (source) entries = entries.filter((e) => e.source === source);
  if (correlationId) entries = entries.filter((e) => e.correlationId === correlationId);

  if (complianceTag) {
    entries = entries.filter((e) => e.complianceTags?.includes(complianceTag));
  }

  if (since) {
    const t = +new Date(since);
    entries = entries.filter((e) => +new Date(e.timestamp) >= t);
  }
  if (until) {
    const t = +new Date(until);
    entries = entries.filter((e) => +new Date(e.timestamp) <= t);
  }

  if (search) {
    const needle = search.toLowerCase();
    entries = entries.filter((e) => {
      const haystack = `${e.action} ${e.actor ?? ''} ${e.target ?? ''} ${JSON.stringify(e.metadata)}`.toLowerCase();
      return haystack.includes(needle);
    });
  }

  // Most recent first
  return entries.reverse().slice(0, limit);
}

// ─── Integrity verification ───────────────────────────────────────────────────

export async function verifyAuditChain() {
  let prevHash = '0';
  for (let i = 0; i < _ring.length; i++) {
    const entry = _ring[i];
    if (entry.prevHash !== prevHash) {
      return { valid: false, brokenAt: i, reason: 'prevHash mismatch' };
    }
    const { hash, ...rest } = entry;
    const expected = await hashEntry(rest);
    if (expected !== hash) {
      return { valid: false, brokenAt: i, reason: 'hash mismatch' };
    }
    prevHash = hash;
  }
  return { valid: true, brokenAt: -1 };
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export function exportAuditJson(entries = _ring.slice()) {
  return JSON.stringify(entries, null, 2);
}

export function exportAuditCsv(entries = _ring.slice()) {
  const headers = [
    'id', 'timestamp', 'severity', 'category', 'action',
    'actor', 'target', 'outcome', 'sessionId', 'hash',
  ];
  const escape = (v) => {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = entries.map((e) => headers.map((h) => escape(e[h])).join(','));
  return [headers.join(','), ...rows].join('\n');
}

// ─── Bulk recording ──────────────────────────────────────────────────────────

export async function bulkRecordAudit(entries) {
  const results = [];
  for (const entry of entries) {
    results.push(await recordAudit(entry));
  }
  return results;
}

// ─── Enhanced stats with compliance breakdown ────────────────────────────────

export function getAuditStats({ includeComplianceBreakdown = false } = {}) {
  const stats = {
    total: _ring.length,
    bySeverity: {},
    byCategory: {},
    byOutcome: { success: 0, failure: 0, denied: 0 },
  };

  if (includeComplianceBreakdown) {
    stats.byComplianceTag = {};
  }

  for (const e of _ring) {
    stats.bySeverity[e.severity] = (stats.bySeverity[e.severity] ?? 0) + 1;
    stats.byCategory[e.category] = (stats.byCategory[e.category] ?? 0) + 1;
    stats.byOutcome[e.outcome] = (stats.byOutcome[e.outcome] ?? 0) + 1;

    if (includeComplianceBreakdown && e.complianceTags) {
      for (const tag of e.complianceTags) {
        stats.byComplianceTag[tag] = (stats.byComplianceTag[tag] ?? 0) + 1;
      }
    }
  }
  return stats;
}

// ─── Test / admin helpers ────────────────────────────────────────────────────

export function clearAuditLog() {
  _ring.length = 0;
  _lastHash = '0';
  _seq = 0;
  persist();
}

export function getSessionId() {
  return _sessionId;
}

export function setSessionId(id) {
  _sessionId = id;
}
