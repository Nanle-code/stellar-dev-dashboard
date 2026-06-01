import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAuditEntries,
  getAuditStats,
  recordAudit,
  subscribeAudit,
} from '../utils/audit.js';
import { trackSecurityEvent, subscribeSecurityAlerts } from '../lib/securityEvents.js';

export interface AuditEntry {
  id: string;
  action: string;
  category?: string;
  severity?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AuditFilters {
  category?: string;
  severity?: string;
  [key: string]: unknown;
}

export interface AuditStats {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  [key: string]: unknown;
}

export interface SecurityAlert {
  type: string;
  at: number;
  [key: string]: unknown;
}

export interface UseAuditLogReturn {
  entries: AuditEntry[];
  refresh: () => void;
}

export interface UseAuditLogOptions {
  pollMs?: number;
}

export function useAuditLog(
  filters: AuditFilters = {},
  opts: UseAuditLogOptions = {},
): UseAuditLogReturn {
  const { pollMs = 0 } = opts;
  const filterKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => filters, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [entries, setEntries] = useState<AuditEntry[]>(() => getAuditEntries(stableFilters));

  const refresh = useCallback(() => {
    setEntries(getAuditEntries(stableFilters));
  }, [stableFilters]);

  useEffect(() => {
    refresh();
    const unsub = subscribeAudit((entry: AuditEntry) => {
      if (stableFilters.category && entry.category !== stableFilters.category) return;
      if (stableFilters.severity && entry.severity !== stableFilters.severity) return;
      refresh();
    });

    let interval: ReturnType<typeof setInterval> | undefined;
    if (pollMs > 0) interval = setInterval(refresh, pollMs);

    return () => {
      unsub();
      if (interval) clearInterval(interval);
    };
  }, [refresh, stableFilters, pollMs]);

  return { entries, refresh };
}

export function useAuditAction(
  action: string,
  defaults: Record<string, unknown> = {},
): (overrides?: Record<string, unknown>) => void {
  return useCallback(
    (overrides: Record<string, unknown> = {}) => recordAudit({ action, ...defaults, ...overrides }),
    [action, JSON.stringify(defaults)], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

export function useSecurityEvent(
  eventType: string,
  defaults: Record<string, unknown> = {},
): (overrides?: Record<string, unknown>) => void {
  return useCallback(
    (overrides: Record<string, unknown> = {}) =>
      trackSecurityEvent(eventType, { ...defaults, ...overrides }),
    [eventType, JSON.stringify(defaults)], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

export interface UseSecurityMonitorReturn {
  alerts: SecurityAlert[];
  clear: () => void;
}

export function useSecurityMonitor(maxAlerts = 20): UseSecurityMonitorReturn {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);

  useEffect(() => {
    const unsub = subscribeSecurityAlerts((alert: Omit<SecurityAlert, 'at'>) => {
      setAlerts((prev) => [{ ...alert, at: Date.now() }, ...prev].slice(0, maxAlerts));
    });
    return unsub;
  }, [maxAlerts]);

  const clear = useCallback(() => setAlerts([]), []);

  return { alerts, clear };
}

export function useAuditStats(): AuditStats {
  const [stats, setStats] = useState<AuditStats>(() => getAuditStats());

  useEffect(() => {
    const unsub = subscribeAudit(() => setStats(getAuditStats()));
    return unsub;
  }, []);

  return stats;
}
