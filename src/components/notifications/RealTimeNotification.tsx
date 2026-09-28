import React, { useEffect, useState } from 'react';
import {
  normalizeSeverity,
  resolveAccessibilityConfig,
  resolveDismissDuration,
  SEVERITY_TAXONOMY,
} from '../../lib/notificationTaxonomy';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

/**
 * Single toast-style notification used by the floating overlay or inline lists.
 * Auto-dismisses according to centralized severity rules or custom override.
 */
export default function RealTimeNotification({
  notification,
  onDismiss,
  autoDismissMs,
  compact = false,
}) {
  const [visible, setVisible] = useState(true);
  const severity = normalizeSeverity(notification.level || notification.severity);
  const style = SEVERITY_TAXONOMY[severity] || SEVERITY_TAXONOMY.info;
  const a11y = resolveAccessibilityConfig(severity);
  const effectiveDismissDuration = resolveDismissDuration(
    severity,
    autoDismissMs ?? notification.autoDismissMs ?? notification.timeout
  );

  useEffect(() => {
    if (effectiveDismissDuration <= 0) return undefined;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.(notification.id);
    }, effectiveDismissDuration);
    return () => clearTimeout(timer);
  }, [effectiveDismissDuration, notification.id, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role={a11y.role}
      aria-live={a11y['aria-live']}
      aria-atomic={a11y['aria-atomic']}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${style.accent}`,
        borderLeft: `3px solid ${style.color}`,
        borderRadius: 'var(--radius-md, 8px)',
        padding: compact ? '8px 12px' : '12px 14px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: style.color,
          marginTop: '6px',
          flexShrink: 0,
          boxShadow: `0 0 8px ${style.accent}`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            alignItems: 'baseline',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: compact ? '12px' : '13px',
                color: 'var(--text-primary)',
              }}
            >
              {notification.title}
            </span>
            {severity === 'critical' && (
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: 'rgba(168, 85, 247, 0.2)',
                  color: 'var(--purple, #a855f7)',
                }}
              >
                Critical
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              flexShrink: 0,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {timeAgo(notification.timestamp)}
          </div>
        </div>
        <div
          style={{
            fontSize: compact ? '11px' : '12px',
            color: 'var(--text-secondary, var(--text-muted))',
            marginTop: '4px',
            wordBreak: 'break-word',
          }}
        >
          {notification.message}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onDismiss(notification.id);
          }}
          aria-label="Dismiss notification"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
