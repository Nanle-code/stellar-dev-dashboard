const ALERT_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
};

const ALERT_RULE_TYPE = {
  BALANCE_LOW: "balance_low",
  BALANCE_HIGH: "balance_high",
  PAYMENT_INCOMING: "payment_incoming",
  PAYMENT_OUTGOING: "payment_outgoing",
  TRANSACTION_FAILED: "transaction_failed",
  // Add other types as needed
};

const ALERT_CHANNEL = {
  PAYMENTS: "payments",
  EFFECTS: "effects",
  TRANSACTIONS: "transactions",
};

/**
 * @typedef {object} AlertRule
 * @property {string} id - Unique ID for the rule
 * @property {ALERT_RULE_TYPE} type - Type of alert rule (e.g., 'balance_low', 'payment_incoming')
 * @property {number} threshold - Numeric threshold for the rule (e.g., 100 for balance, 0 for payment)
 * @property {string} assetCode - Asset code for balance/payment rules (e.g., 'XLM', 'USD')
 * @property {ALERT_CHANNEL} channel - The stream channel this rule applies to
 * @property {string} [account] - Optional account ID if the rule is specific to an account
 */

export function evaluateAlertRules(snapshot, score) {
  const alerts = [];
  const memory = snapshot?.memory;

  if (!snapshot?.online) {
    alerts.push({
      id: "offline",
      severity: ALERT_SEVERITY.CRITICAL,
      title: "Network disconnected",
      description: "The app is offline. Data may be stale.",
    });
  }

  if (score < 60) {
    alerts.push({
      id: "health-low",
      severity: ALERT_SEVERITY.WARNING,
      title: "System health degraded",
      description: `Current health score is ${score}/100.`,
    });
  }

  if (memory?.jsHeapSizeLimit) {
    const heapRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    if (heapRatio > 0.9) {
      alerts.push({
        id: "heap-critical",
        severity: ALERT_SEVERITY.CRITICAL,
        title: "High memory pressure",
        description: "Memory usage is above 90% of heap limit.",
      });
    }
  }

  return alerts;
}

/**
 * Evaluates an incoming streaming event against a collection of user-defined alert rules.
 * @param {AccountStreamEvent} incomingEvent - The event received from the account stream.
 * @param {AlertRule[]} activeRules - An array of active alert rules.
 * @param {string} watchedAccount - The account ID being watched.
 * @returns {Array<object>} An array of alert payloads for violated rules.
 */
export function evaluateEventRules(incomingEvent, activeRules, watchedAccount) {
  const triggeredAlerts = [];
  const record = incomingEvent.record;

  for (const rule of activeRules) {
    // Filter rules by channel and optionally by specific account if rule.account is set
    if (rule.channel !== incomingEvent.channel) {
      continue;
    }
    if (rule.account && rule.account !== watchedAccount) {
      continue;
    }

    switch (rule.type) {
      case ALERT_RULE_TYPE.BALANCE_LOW:
      case ALERT_RULE_TYPE.BALANCE_HIGH: {
        // This rule type would typically apply to 'effects' channel, specifically 'account_credited'/'account_debited'
        // or a dedicated balance stream if available. For now, we'll assume it's derived from effects.
        // This is a simplification; a real-world scenario might need a dedicated balance stream or periodic checks.
        // For now, we'll check the *transaction amount* against the threshold.
        // This is a significant simplification as it doesn't reflect the actual account balance.
        if (incomingEvent.channel === ALERT_CHANNEL.EFFECTS) {
          const type = String(record.type);
          if (type === 'account_credited' || type === 'account_debited') {
            const assetCode = String(record.asset_code || 'XLM');
            if (assetCode === rule.assetCode) {
              const amount = parseFloat(record.amount);
              if (rule.type === ALERT_RULE_TYPE.BALANCE_LOW && amount < rule.threshold) {
                triggeredAlerts.push({
                  id: `balance-low-${rule.assetCode}-${rule.id}`,
                  severity: ALERT_SEVERITY.CRITICAL,
                  title: `Low ${rule.assetCode} balance detected`,
                  description: `Transaction amount ${amount} is below threshold ${rule.threshold}.`,
                });
              } else if (rule.type === ALERT_RULE_TYPE.BALANCE_HIGH && amount > rule.threshold) {
                triggeredAlerts.push({
                  id: `balance-high-${rule.assetCode}-${rule.id}`,
                  severity: ALERT_SEVERITY.WARNING,
                  title: `High ${rule.assetCode} balance detected`,
                  description: `Transaction amount ${amount} is above threshold ${rule.threshold}.`,
                });
              }
            }
          }
        }
        break;
      }
      case ALERT_RULE_TYPE.PAYMENT_INCOMING: {
        if (incomingEvent.channel === ALERT_CHANNEL.PAYMENTS) {
          const to = String(record.to);
          if (to === watchedAccount) {
            const amount = parseFloat(record.amount);
            const assetCode = String(record.asset_code || 'XLM');
            if (assetCode === rule.assetCode && amount >= rule.threshold) {
              triggeredAlerts.push({
                id: `incoming-payment-${rule.assetCode}-${rule.id}`,
                severity: ALERT_SEVERITY.INFO,
                title: `Incoming ${assetCode} payment received`,
                description: `Received ${amount} ${assetCode} from ${truncateAddr(String(record.from))}.`,
              });
            }
          }
        }
        break;
      }
      case ALERT_RULE_TYPE.PAYMENT_OUTGOING: {
        if (incomingEvent.channel === ALERT_CHANNEL.PAYMENTS) {
          const from = String(record.from);
          if (from === watchedAccount) {
            const amount = parseFloat(record.amount);
            const assetCode = String(record.asset_code || 'XLM');
            if (assetCode === rule.assetCode && amount >= rule.threshold) {
              triggeredAlerts.push({
                id: `outgoing-payment-${rule.assetCode}-${rule.id}`,
                severity: ALERT_SEVERITY.INFO,
                title: `Outgoing ${assetCode} payment sent`,
                description: `Sent ${amount} ${assetCode} to ${truncateAddr(String(record.to))}.`,
              });
            }
          }
        }
        break;
      }
      case ALERT_RULE_TYPE.TRANSACTION_FAILED: {
        if (incomingEvent.channel === ALERT_CHANNEL.TRANSACTIONS) {
          const successful = record.successful;
          if (successful === false) { // Assuming threshold 0 means any failure
            triggeredAlerts.push({
              id: `transaction-failed-${rule.id}`,
              severity: ALERT_SEVERITY.CRITICAL,
              title: `Transaction failed`,
              description: `Transaction ${String(record.id).slice(0, 8)}... failed.`,
            });
          }
        }
        break;
      }
      // Add more rule types as needed
    }
  }
  return triggeredAlerts;
}

// Helper function from useAccountStream.ts, needed here for description truncation
function truncateAddr(addr) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}

export class AlertCenter {
  constructor() {
    this.listeners = new Set();
    this.items = [];
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.items);
    return () => this.listeners.delete(listener);
  }

  push(alerts = []) {
    const merged = [...alerts, ...this.items]
      .filter((alert, index, array) => {
        return array.findIndex((candidate) => candidate.id === alert.id) === index;
      })
      .slice(0, 50);
    this.items = merged;
    this.listeners.forEach((listener) => listener(this.items));
  }

  clear(alertId) {
    this.items = this.items.filter((item) => item.id !== alertId);
    this.listeners.forEach((listener) => listener(this.items));
  }

  reset() {
    this.items = [];
    this.listeners.forEach((listener) => listener(this.items));
  }
}

export const alertCenter = new AlertCenter();

export { ALERT_SEVERITY, ALERT_RULE_TYPE, ALERT_CHANNEL };
