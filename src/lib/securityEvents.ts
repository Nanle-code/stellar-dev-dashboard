/**
 * Security Event Tracking (#118)
 *
 * High-level helpers that record security-significant events into the
 * audit trail and run lightweight anomaly detection (failed-auth bursts,
 * rate-limit exhaustion, unusual transaction values).
 */

import {
  recordAudit,
  AuditCategory,
  AuditSeverity,
  subscribeAudit,
} from '../utils/audit.js';

// ─── Canonical security event types ──────────────────────────────────────────

export const SecurityEventType = Object.freeze({
  // Authentication
  AUTH_LOGIN_SUCCESS:      'auth.login.success',
  AUTH_LOGIN_FAILED:       'auth.login.failed',
  AUTH_LOGOUT:             'auth.logout',
  AUTH_SESSION_EXPIRED:    'auth.session.expired',

  // Wallet
  WALLET_CONNECTED:        'wallet.connected',
  WALLET_DISCONNECTED:     'wallet.disconnected',
  WALLET_SIGN_REQUEST:     'wallet.sign.request',
  WALLET_SIGN_REJECTED:    'wallet.sign.rejected',
  WALLET_KEY_EXPORTED:     'wallet.key.exported',

  // Transactions
  TX_SUBMITTED:            'tx.submitted',
  TX_FAILED:               'tx.failed',
  TX_HIGH_VALUE:           'tx.high_value',
  TX_SUSPICIOUS:           'tx.suspicious',

  // Network / config
  NETWORK_SWITCHED:        'network.switched',
  CONFIG_CHANGED:          'config.changed',

  // Defensive
  RATE_LIMIT_HIT:          'security.rate_limit_hit',
  CSP_VIOLATION:           'security.csp_violation',
  XSS_ATTEMPT:             'security.xss_attempt',
  PERMISSION_DENIED:       'security.permission_denied',
  INTEGRITY_VIOLATION:     'security.integrity_violation',
});

// Severity mapping for each event type
const SEVERITY_MAP = {
  [SecurityEventType.AUTH_LOGIN_SUCCESS]:    AuditSeverity.INFO,
  [SecurityEventType.AUTH_LOGIN_FAILED]:     AuditSeverity.MEDIUM,
  [SecurityEventType.AUTH_LOGOUT]:           AuditSeverity.INFO,
  [SecurityEventType.AUTH_SESSION_EXPIRED]:  AuditSeverity.LOW,

  [SecurityEventType.WALLET_CONNECTED]:      AuditSeverity.INFO,
  [SecurityEventType.WALLET_DISCONNECTED]:   AuditSeverity.INFO,
  [SecurityEventType.WALLET_SIGN_REQUEST]:   AuditSeverity.LOW,
  [SecurityEventType.WALLET_SIGN_REJECTED]:  AuditSeverity.LOW,
  [SecurityEventType.WALLET_KEY_EXPORTED]:   AuditSeverity.HIGH,

  [SecurityEventType.TX_SUBMITTED]:          AuditSeverity.INFO,
  [SecurityEventType.TX_FAILED]:             AuditSeverity.LOW,
  [SecurityEventType.TX_HIGH_VALUE]:         AuditSeverity.MEDIUM,
  [SecurityEventType.TX_SUSPICIOUS]:         AuditSeverity.HIGH,

  [SecurityEventType.NETWORK_SWITCHED]:      AuditSeverity.LOW,
  [SecurityEventType.CONFIG_CHANGED]:        AuditSeverity.LOW,

  [SecurityEventType.RATE_LIMIT_HIT]:        AuditSeverity.MEDIUM,
  [SecurityEventType.CSP_VIOLATION]:         AuditSeverity.HIGH,
  [SecurityEventType.XSS_ATTEMPT]:           AuditSeverity.CRITICAL,
  [SecurityEventType.PERMISSION_DENIED]:     AuditSeverity.MEDIUM,
  [SecurityEventType.INTEGRITY_VIOLATION]:   AuditSeverity.CRITICAL,
};

const CATEGORY_MAP = {
  'auth':     AuditCategory.AUTH,
  'wallet':   AuditCategory.WALLET,
  'tx':       AuditCategory.TRANSACTION,
  'network':  AuditCategory.NETWORK,
  'config':   AuditCategory.CONFIG,
  'security': AuditCategory.SECURITY,
};

function categoryFor(eventType) {
  const prefix = eventType.split('.')[0];
  return CATEGORY_MAP[prefix] ?? AuditCategory.SYSTEM;
}

// ─── Anomaly detection state ─────────────────────────────────────────────────

const _failedAuthByActor = new Map();         // actor -> timestamps
const _ratelimitHitsByAction = new Map();     // action -> timestamps
const FAILED_AUTH_WINDOW_MS = 5 * 60_000;
const FAILED_AUTH_THRESHOLD = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT_THRESHOLD = 10;

const _alertSubscribers = new Set();

export function subscribeSecurityAlerts(handler) {
  _alertSubscribers.add(handler);
  return () => _alertSubscribers.delete(handler);
}

function emitAlert(alert) {
  for (const fn of _alertSubscribers) {
    try { fn(alert); } catch { /* swallow */ }
  }
}

function pruneOlderThan(arr, cutoff) {
  return arr.filter((t) => t >= cutoff);
}

function checkAnomalies(eventType, payload) {
  const now = Date.now();

  if (eventType === SecurityEventType.AUTH_LOGIN_FAILED) {
    const actor = payload.actor || 'anonymous';
    const list = pruneOlderThan(
      _failedAuthByActor.get(actor) ?? [],
      now - FAILED_AUTH_WINDOW_MS,
    );
    list.push(now);
    _failedAuthByActor.set(actor, list);
    if (list.length >= FAILED_AUTH_THRESHOLD) {
      const alert = {
        kind: 'brute_force_suspected',
        actor,
        count: list.length,
        windowMs: FAILED_AUTH_WINDOW_MS,
      };
      emitAlert(alert);
      recordAudit({
        action: 'security.alert.brute_force_suspected',
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.CRITICAL,
        actor,
        outcome: 'denied',
        metadata: alert,
      });
    }
  }

  if (eventType === SecurityEventType.RATE_LIMIT_HIT) {
    const action = payload.metadata?.action || 'unknown';
    const list = pruneOlderThan(
      _ratelimitHitsByAction.get(action) ?? [],
      now - RATE_LIMIT_WINDOW_MS,
    );
    list.push(now);
    _ratelimitHitsByAction.set(action, list);
    if (list.length >= RATE_LIMIT_THRESHOLD) {
      const alert = {
        kind: 'rate_limit_storm',
        action,
        count: list.length,
        windowMs: RATE_LIMIT_WINDOW_MS,
      };
      emitAlert(alert);
      recordAudit({
        action: 'security.alert.rate_limit_storm',
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.HIGH,
        outcome: 'denied',
        metadata: alert,
      });
    }
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Record a security-significant event.
 *
 * @param {string} eventType  one of SecurityEventType
 * @param {{
 *   actor?: string,
 *   target?: string,
 *   outcome?: 'success'|'failure'|'denied',
 *   metadata?: Record<string, unknown>,
 *   severityOverride?: string,
 * }} [opts]
 * @returns {Promise<object>}
 */
export function trackSecurityEvent(eventType, opts = {}) {
  const severity = opts.severityOverride ?? SEVERITY_MAP[eventType] ?? AuditSeverity.INFO;
  const category = categoryFor(eventType);

  const promise = recordAudit({
    action: eventType,
    category,
    severity,
    actor: opts.actor ?? null,
    target: opts.target ?? null,
    outcome: opts.outcome ?? 'success',
    metadata: opts.metadata ?? {},
  });

  // Side-effect: anomaly detection
  checkAnomalies(eventType, opts);

  return promise;
}

// ─── Built-in CSP / global error listeners ──────────────────────────────────

let _listenersInstalled = false;

export function installSecurityEventListeners() {
  if (_listenersInstalled || typeof window === 'undefined') return;
  _listenersInstalled = true;

  document.addEventListener('securitypolicyviolation', (e) => {
    trackSecurityEvent(SecurityEventType.CSP_VIOLATION, {
      target: e.violatedDirective,
      outcome: 'denied',
      metadata: {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        sourceFile: e.sourceFile,
        lineNumber: e.lineNumber,
      },
    });
  });
}

// ─── Convenience re-exports for the rest of the app ─────────────────────────

export { subscribeAudit, AuditSeverity, AuditCategory };
