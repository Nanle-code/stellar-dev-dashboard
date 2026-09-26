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
 * Filter shape accepted by {@link useAuditLog} (same shape as getAuditEntries).
 */
export interface UseAuditLogFilters {
  category?: string;
  severity?: string;
  [key: string]: unknown;
}

/**
 * Options accepted by {@link useAuditLog}.
 */
export interface UseAuditLogOptions {
  pollMs?: number;
}

/**
 * Return value of the {@link useAuditLog} hook.
 */
export interface UseAuditLogReturn<TEntry = Record<string, unknown>> {
  entries: TEntry[];
  refresh: () => void;
}

/**
 * Overrides accepted by the callback returned from {@link useAuditAction}.
 */
export type AuditActionOverrides = Record<string, unknown>;

/**
 * Overrides accepted by the callback returned from {@link useSecurityEvent}.
 */
export type SecurityEventOverrides = Record<string, unknown>;

/**
 * A single security alert with a timestamp.
 */
export interface TimestampedSecurityAlert<TAlert = Record<string, unknown>> extends Record<string, unknown> {
  at: number;
  alert?: TAlert;
}

/**
 * Return value of the {@link useSecurityMonitor} hook.
 */
export interface UseSecurityMonitorReturn<TAlert = Record<string, unknown>> {
  alerts: Array<TAlert & { at: number }>;
  clear: () => void;
}

/**
 * Subscribe to audit entries with optional filters.
 * Re-renders whenever a matching new entry is recorded.
 *
 * @param [filters]  Same shape as getAuditEntries
 * @param [opts]
 */
export function useAuditLog<TEntry = Record<string, unknown>>(
  filters: UseAuditLogFilters = {},
  opts: UseAuditLogOptions = {}
): UseAuditLogReturn<TEntry> {
  const { pollMs = 0 } = opts;
  // Stabilise filter object across renders
  const filterKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => filters, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [entries, setEntries] = useState<TEntry[]>(() => getAuditEntries(stableFilters));

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
export function useAuditAction(
  action: string,
  defaults: AuditActionOverrides = {}
): (overrides?: AuditActionOverrides) => unknown {
  return useCallback(
    (overrides: AuditActionOverrides = {}) =>
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
export function useSecurityEvent(
  eventType: string,
  defaults: SecurityEventOverrides = {}
): (overrides?: SecurityEventOverrides) => unknown {
  return useCallback(
    (overrides: SecurityEventOverrides = {}) => trackSecurityEvent(eventType, { ...defaults, ...overrides }),
    [eventType, JSON.stringify(defaults)], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

/**
 * Subscribe to live security alerts (anomaly detector output).
 * Returns the latest N alerts in chronological order (newest first).
 */
export function useSecurityMonitor<TAlert = Record<string, unknown>>(maxAlerts = 20): UseSecurityMonitorReturn<TAlert> {
  const [alerts, setAlerts] = useState<Array<TAlert & { at: number }>>([]);

  useEffect(() => {
    const unsub = subscribeSecurityAlerts((alert) => {
      setAlerts((prev) => [{ ...alert, at: Date.now() }, ...prev].slice(0, maxAlerts));
    });
    return unsub;
  }, [maxAlerts]);

  const clear = useCallback((): void => setAlerts([]), []);

  return { alerts, clear };
}

/**
 * Aggregated audit stats for dashboards. Refreshes on every new entry.
 */
export function useAuditStats<TStats = Record<string, unknown>>(): TStats {
  const [stats, setStats] = useState<TStats>(() => getAuditStats());

  useEffect(() => {
    const unsub = subscribeAudit(() => setStats(getAuditStats()));
    return unsub;
  }, []);

  return stats;
}
