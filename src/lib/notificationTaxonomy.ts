/**
 * Centralized Notification & Toast Severity Taxonomy
 *
 * Defines unified severity levels, persistence rules, accessibility roles,
 * and ARIA announcement configurations across the Stellar Developer Dashboard.
 */

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error' | 'critical';

export interface SeverityConfig {
  severity: NotificationSeverity;
  role: 'status' | 'alert';
  ariaLive: 'polite' | 'assertive';
  ariaAtomic: boolean;
  defaultAutoDismissMs: number; // 0 indicates persistent (manual dismissal required)
  color: string;
  accent: string;
  bg: string;
  badgeLabel: string;
}

export const SEVERITY_TAXONOMY: Record<NotificationSeverity, SeverityConfig> = {
  info: {
    severity: 'info',
    role: 'status',
    ariaLive: 'polite',
    ariaAtomic: true,
    defaultAutoDismissMs: 4000,
    color: 'var(--cyan, #06b6d4)',
    accent: 'rgba(6, 182, 212, 0.5)',
    bg: 'rgba(6, 182, 212, 0.08)',
    badgeLabel: 'Info',
  },
  success: {
    severity: 'success',
    role: 'status',
    ariaLive: 'polite',
    ariaAtomic: true,
    defaultAutoDismissMs: 5000,
    color: 'var(--success, #22c55e)',
    accent: 'rgba(34, 197, 94, 0.5)',
    bg: 'rgba(34, 197, 94, 0.08)',
    badgeLabel: 'Success',
  },
  warning: {
    severity: 'warning',
    role: 'alert',
    ariaLive: 'assertive',
    ariaAtomic: true,
    defaultAutoDismissMs: 8000,
    color: 'var(--warning, #f59e0b)',
    accent: 'rgba(245, 158, 11, 0.5)',
    bg: 'rgba(245, 158, 11, 0.08)',
    badgeLabel: 'Warning',
  },
  error: {
    severity: 'error',
    role: 'alert',
    ariaLive: 'assertive',
    ariaAtomic: true,
    defaultAutoDismissMs: 0, // Persistent by default
    color: 'var(--error, #ef4444)',
    accent: 'rgba(239, 68, 68, 0.5)',
    bg: 'rgba(239, 68, 68, 0.08)',
    badgeLabel: 'Error',
  },
  critical: {
    severity: 'critical',
    role: 'alert',
    ariaLive: 'assertive',
    ariaAtomic: true,
    defaultAutoDismissMs: 0, // Persistent, requires explicit acknowledgement
    color: 'var(--purple, #a855f7)',
    accent: 'rgba(168, 85, 247, 0.6)',
    bg: 'rgba(168, 85, 247, 0.12)',
    badgeLabel: 'Critical',
  },
};

/**
 * Normalizes legacy or heterogeneous types/levels into a standard NotificationSeverity.
 */
export function normalizeSeverity(raw?: string | null): NotificationSeverity {
  if (!raw || typeof raw !== 'string') {
    return 'info';
  }

  const normalized = raw.trim().toLowerCase();
  switch (normalized) {
    case 'critical':
    case 'fatal':
    case 'emergency':
    case 'panic':
      return 'critical';

    case 'error':
    case 'err':
    case 'danger':
    case 'failure':
      return 'error';

    case 'warning':
    case 'warn':
    case 'price_alert':
      return 'warning';

    case 'success':
    case 'tx_confirm':
    case 'confirmed':
      return 'success';

    case 'info':
    case 'notice':
    case 'account_change':
    case 'network_event':
    default:
      return 'info';
  }
}

/**
 * Determines whether a notification is persistent based on its severity and custom override.
 */
export function isNotificationPersistent(
  severity: NotificationSeverity,
  customTimeout?: number | null
): boolean {
  if (typeof customTimeout === 'number') {
    return customTimeout <= 0;
  }
  return SEVERITY_TAXONOMY[severity].defaultAutoDismissMs === 0;
}

/**
 * Resolves the effective auto-dismiss duration in milliseconds.
 */
export function resolveDismissDuration(
  severity: NotificationSeverity,
  customTimeout?: number | null
): number {
  if (typeof customTimeout === 'number') {
    return Math.max(0, customTimeout);
  }
  return SEVERITY_TAXONOMY[severity].defaultAutoDismissMs;
}

/**
 * Resolves accessibility attributes for a notification based on its severity.
 */
export function resolveAccessibilityConfig(severity: NotificationSeverity) {
  const config = SEVERITY_TAXONOMY[severity] || SEVERITY_TAXONOMY.info;
  return {
    role: config.role,
    'aria-live': config.ariaLive,
    'aria-atomic': config.ariaAtomic,
  };
}
