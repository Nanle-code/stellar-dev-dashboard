import { sendEmail, sendWebhook, sendSMS } from "../lib/notificationChannels";

// Helper to dispatch alerts via appropriate channels
function dispatchAlert(alert) {
  // Simple mapping: critical -> email, warning -> webhook, info -> SMS (optional)
  if (alert.severity === "critical") {
    // Example payload; in real use, fill appropriate fields
    sendEmail({ to: "admin@example.com", subject: alert.title, body: alert.description });
  } else if (alert.severity === "warning") {
    sendWebhook({ url: "https://example.com/webhook", data: alert });
  } else if (alert.severity === "info") {
    sendSMS({ to: "+1234567890", message: `${alert.title}: ${alert.description}` });
  }
}

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
