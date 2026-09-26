/**
 * ApiDegradationBanner (#821)
 *
 * Renders a dismissible, accessible banner describing degraded or unavailable
 * Horizon / Soroban RPC services, together with retry guidance. The heavy
 * lifting lives in `src/lib/apiDegradation.ts` so the banner stays a thin,
 * presentational layer.
 *
 * Accessibility: uses `role="status"` with `aria-live="polite"` for degradation
 * warnings and `role="alert"` for outages so screen readers announce outages
 * immediately.
 */

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, ServerCrash, X } from 'lucide-react';
import {
  evaluateApiDegradation,
  type DegradationBanner,
  type ServiceStatusInput,
} from '../../lib/apiDegradation';

export interface ApiDegradationBannerProps {
  /** Latest health signals collected by the polling layer. */
  statuses: ServiceStatusInput[];
  /** Called when the user asks to retry immediately. */
  onRetry?: () => void;
  /** Allow the user to dismiss the banner (auto-reappears on severity change). */
  dismissible?: boolean;
  /** Retry attempt counter, used to compute the backoff delay. */
  attempt?: number;
  style?: React.CSSProperties;
}

function severityStyles(severity: DegradationBanner['severity']) {
  switch (severity) {
    case 'critical':
      return {
        accent: '#ef4444',
        icon: <ServerCrash size={22} aria-hidden="true" />,
        border: '1px solid rgba(239, 68, 68, 0.35)',
      };
    case 'warning':
      return {
        accent: '#f59e0b',
        icon: <AlertTriangle size={22} aria-hidden="true" />,
        border: '1px solid rgba(245, 158, 11, 0.35)',
      };
    default:
      return {
        accent: '#00e5ff',
        icon: <AlertTriangle size={22} aria-hidden="true" />,
        border: '1px solid rgba(0, 229, 255, 0.35)',
      };
  }
}

export default function ApiDegradationBanner({
  statuses,
  onRetry,
  dismissible = true,
  attempt = 0,
  style,
}: ApiDegradationBannerProps) {
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  const banner = evaluateApiDegradation(statuses, { attempt });
  // Re-show when the headline/severity changes so a dismissed warning does not
  // hide a later, more severe outage.
  const signature = `${banner.severity}:${banner.headline}`;
  if (!banner.visible || dismissedAt === signature) return null;

  const styles = severityStyles(banner.severity);

  return (
    <div
      role={banner.severity === 'critical' ? 'alert' : 'status'}
      aria-live={banner.severity === 'critical' ? 'assertive' : 'polite'}
      data-testid="api-degradation-banner"
      data-severity={banner.severity}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'var(--bg-elevated, #1e2327)',
        border: styles.border,
        color: 'var(--text-primary, #fff)',
        ...style,
      }}
    >
      <span style={{ color: styles.accent, display: 'flex', flexShrink: 0, marginTop: 2 }}>
        {styles.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 14 }}>{banner.headline}</strong>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary, #9ca3af)' }}>
          {banner.detail}
        </p>

        {banner.retry.steps.length > 0 && (
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
            {banner.retry.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        )}
      </div>

      {banner.retry.retryable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: `1px solid ${styles.accent}`,
            color: styles.accent,
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 12,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <RefreshCw size={13} aria-hidden="true" /> Retry
        </button>
      )}

      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss degradation banner"
          onClick={() => setDismissedAt(signature)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #6b7280)',
            cursor: 'pointer',
            padding: 2,
            flexShrink: 0,
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
