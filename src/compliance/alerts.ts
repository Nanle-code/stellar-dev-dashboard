import { Finding } from './engine';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
  id: string;
  accountId: string;
  severity: Severity;
  message: string;
  findings: Finding[];
  timestamp: string;
}

let sequence = 1;

export function emitAlert(accountId: string, findings: Finding[]): Alert {
  const highest = findings.reduce((acc, f) => {
    const order = { low: 0, medium: 1, high: 2, critical: 3 } as Record<Severity, number>;
    return order[f.severity] > order[acc] ? f.severity : acc;
  }, 'low' as Severity);

  const alert: Alert = {
    id: `alert-${Date.now()}-${sequence++}`,
    accountId,
    severity: highest,
    message: `Compliance alert (${highest}) for account ${accountId}`,
    findings,
    timestamp: new Date().toISOString(),
  };

  // For now, we simply log. In production this would push to a queue or notification system.
  // eslint-disable-next-line no-console
  console.warn('Compliance Alert:', JSON.stringify(alert));

  return alert;
}
