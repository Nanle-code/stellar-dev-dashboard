/**
 * Audit Hooks (#118)
 *
 * - useAuditLog: subscribe to the audit ring buffer with filters
 * - useAuditAction: stable callback that records a fixed action type
 * - useSecurityMonitor: live alerts from securityEvents
 * - useAuditStats: aggregated counts for dashboards
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAuditEntries,
  getAuditStats,
  recordAudit,
  subscribeAudit,
} from '../utils/audit.js';
import {
  trackSecurityEvent,
  subscribeSecurityAlerts,
} from '../lib/securityEvents.js';

/**
 * Subscribe to audit entries with optional filters.
 * Re-renders whenever a matching new entry is recorded.
 *
 * @param {object} [filters]  Same shape as getAuditEntries
 * @param {{ pollMs?: number }} [opts]
 */
export function useAuditLog(filters = {}, opts = {}) {
  const { pollMs = 0 } = opts;
  // Stabilise filter object across renders
  const filterKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => filters, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [entries, setEntries] = useState(() => getAuditEntries(stableFilters));

  const refresh = useCallback(() => {
    setEntries(getAuditEntries(stableFilters));
  }, [stableFilters]);

  useEffect(() => {
    refresh();
    const unsub = subscribeAudit((entry) => {
      // Cheap pre-filter: only refresh if the new entry could match
      if (stableFilters.category && entry.category !== stableFilters.category) return;
      if (stableFilters.severity && entry.severity !== stableFilters.severity) return;
      refresh();
    });

    let interval;
    if (pollMs > 0) interval = setInterval(refresh, pollMs);

    return () => {
      unsub();
      if (interval) clearInterval(interval);
    };
  }, [refresh, stableFilters, pollMs]);

  return { entries, refresh };
}

/**
 * Returns a stable callback that records an audit entry with a preset action.
 * Useful for buttons or event handlers that always log the same action.
 *
 * @example
 *   const logExport = useAuditAction('data.export', { category: 'export' });
 *   <button onClick={() => logExport({ metadata: { format: 'csv' } })}>Export</button>
 */
export function useAuditAction(action, defaults = {}) {
  return useCallback(
    (overrides = {}) =>
      recordAudit({ action, ...defaults, ...overrides }),
    [action, JSON.stringify(defaults)], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

/**
 * Returns a stable callback for tracking security events.
 *
 * @example
 *   const trackLoginFail = useSecurityEvent(SecurityEventType.AUTH_LOGIN_FAILED);
 *   trackLoginFail({ actor: address, metadata: { reason: 'bad-sig' } });
 */
export function useSecurityEvent(eventType, defaults = {}) {
  return useCallback(
    (overrides = {}) => trackSecurityEvent(eventType, { ...defaults, ...overrides }),
    [eventType, JSON.stringify(defaults)], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

/**
 * Subscribe to live security alerts (anomaly detector output).
 * Returns the latest N alerts in chronological order (newest first).
 */
export function useSecurityMonitor(maxAlerts = 20) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const unsub = subscribeSecurityAlerts((alert) => {
      setAlerts((prev) => [{ ...alert, at: Date.now() }, ...prev].slice(0, maxAlerts));
    });
    return unsub;
  }, [maxAlerts]);

  const clear = useCallback(() => setAlerts([]), []);

  return { alerts, clear };
}

/**
 * Aggregated audit stats for dashboards. Refreshes on every new entry.
 */
export function useAuditStats() {
  const [stats, setStats] = useState(() => getAuditStats());

  useEffect(() => {
    const unsub = subscribeAudit(() => setStats(getAuditStats()));
    return unsub;
  }, []);

  return stats;
}
