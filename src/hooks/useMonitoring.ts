import { useEffect, useMemo, useState } from 'react';
import {
  collectHealthSnapshot,
  collectSystemHealthSnapshot,
  computeHealthScore,
  watchErrors,
} from '../utils/monitoring';
import { alertCenter, evaluateAlertRules } from '../lib/alerts';

export interface HealthSnapshot {
  timestamp: string;
  online: boolean;
  memory: Record<string, number> | null;
  navigation: Record<string, number> | null;
  networkHealth: unknown[];
  latencyHistory: unknown[];
  [key: string]: unknown;
}

export interface AlertItem {
  id: string;
  severity: string;
  message: string;
  [key: string]: unknown;
}

export interface UseMonitoringReturn {
  snapshot: HealthSnapshot;
  score: number;
  alerts: AlertItem[];
  errors: Error[];
  clearAlert: (id: string) => void;
  resetAlerts: () => void;
}

export function useMonitoring(pollIntervalMs = 15000): UseMonitoringReturn {
  const [snapshot, setSnapshot] = useState<HealthSnapshot>(() => ({
    ...collectHealthSnapshot(),
    networkHealth: [],
    latencyHistory: [],
  }));
  const [errors, setErrors] = useState<Error[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    const stopErrorWatch = watchErrors((error: Error) => {
      setErrors((prev) => [error, ...prev].slice(0, 30));
    });

    let active = true;

    const refreshSnapshot = async () => {
      setSnapshot((current) => ({ ...current, ...collectHealthSnapshot() }));
      try {
        const systemSnapshot = await collectSystemHealthSnapshot();
        if (!active) return;
        setSnapshot(systemSnapshot);
      } catch (error) {
        if (!active) return;
        console.warn('Unable to refresh system health snapshot:', error);
      }
    };

    refreshSnapshot();
    const id = setInterval(refreshSnapshot, pollIntervalMs);
    const unsubscribeAlerts = alertCenter.subscribe((items: AlertItem[]) => setAlerts(items));

    return () => {
      active = false;
      stopErrorWatch();
      clearInterval(id);
      unsubscribeAlerts();
    };
  }, [pollIntervalMs]);

  const score = useMemo(() => computeHealthScore(snapshot), [snapshot]);

  useEffect(() => {
    alertCenter.push(evaluateAlertRules(snapshot, score));
  }, [snapshot, score]);

  return {
    snapshot,
    score,
    alerts,
    errors,
    clearAlert: (id: string) => alertCenter.clear(id),
    resetAlerts: () => alertCenter.reset(),
  };
}

export default useMonitoring;
