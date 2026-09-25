import { dispatchAlert } from "../lib/alertsService";

import {
  collectHealthSnapshot,
  collectSystemHealthSnapshot,
  computeHealthScore,
  watchErrors,
} from "../utils/monitoring";
import { alertCenter, evaluateAlertRules } from "../lib/alerts";

/**
 * Health snapshot tracked by the {@link useMonitoring} hook.
 */
export type MonitoringSnapshot = ReturnType<typeof collectHealthSnapshot> & {
  networkHealth: unknown[];
  latencyHistory: unknown[];
};

/**
 * A single error captured by the error watcher.
 */
export type MonitoringError = unknown;

/**
 * A single alert surfaced by the alert center.
 */
export type MonitoringAlert = Record<string, unknown>;

/**
 * Return value of the {@link useMonitoring} hook.
 */
export interface UseMonitoringReturn {
  snapshot: MonitoringSnapshot;
  score: number;
  alerts: MonitoringAlert[];
  errors: MonitoringError[];
  clearAlert: (id: string) => void;
  resetAlerts: () => void;
}

export function useMonitoring(pollIntervalMs = 15000): UseMonitoringReturn {
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot>(() => ({
    ...collectHealthSnapshot(),
    networkHealth: [],
    latencyHistory: [],
  }));
  const [errors, setErrors] = useState<MonitoringError[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);

  useEffect(() => {
    const stopErrorWatch = watchErrors((error: MonitoringError) => {
      setErrors((prev) => [error, ...prev].slice(0, 30));
    });

    let active = true;

    const refreshSnapshot = async (): Promise<void> => {
      setSnapshot((current) => ({
        ...current,
        ...collectHealthSnapshot(),
      }));

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

    const unsubscribeAlerts = alertCenter.subscribe((items) => setAlerts(items));

    return () => {
      active = false;
      stopErrorWatch();
      clearInterval(id);
      unsubscribeAlerts();
    };
  }, [pollIntervalMs]);

  const score = useMemo(() => computeHealthScore(snapshot), [snapshot]);

  useEffect(() => {
    const newAlerts = evaluateAlertRules(snapshot, score);
    alertCenter.push(newAlerts);
    newAlerts.forEach(dispatchAlert);
  }, [snapshot, score]);

  return {
    snapshot,
    score,
    alerts,
    errors,
    clearAlert: (id: string): void => alertCenter.clear(id),
    resetAlerts: (): void => alertCenter.reset(),
  };
}

export default useMonitoring;
