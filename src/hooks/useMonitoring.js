import { dispatchAlert } from "../lib/alertsService";

import {
  collectHealthSnapshot,
  collectSystemHealthSnapshot,
  computeHealthScore,
  watchErrors,
} from "../utils/monitoring";
import { alertCenter, evaluateAlertRules } from "../lib/alerts";

export function useMonitoring(pollIntervalMs = 15000) {
  const [snapshot, setSnapshot] = useState(() => ({
    ...collectHealthSnapshot(),
    networkHealth: [],
    latencyHistory: [],
  }));
  const [errors, setErrors] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const stopErrorWatch = watchErrors((error) => {
      setErrors((prev) => [error, ...prev].slice(0, 30));
    });

    let active = true;

    const refreshSnapshot = async () => {
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
    clearAlert: (id) => alertCenter.clear(id),
    resetAlerts: () => alertCenter.reset(),
  };
}

export default useMonitoring;
