import React, { useEffect, useState } from 'react'

const LEVEL_STYLES = {
  info: { color: 'var(--cyan, #06b6d4)', accent: 'rgba(6, 182, 212, 0.5)', bg: 'rgba(6, 182, 212, 0.08)' },
  success: { color: 'var(--success, #22c55e)', accent: 'rgba(34, 197, 94, 0.5)', bg: 'rgba(34, 197, 94, 0.08)' },
  warning: { color: 'var(--warning, #f59e0b)', accent: 'rgba(245, 158, 11, 0.5)', bg: 'rgba(245, 158, 11, 0.08)' },
  error: { color: 'var(--error, #ef4444)', accent: 'rgba(239, 68, 68, 0.5)', bg: 'rgba(239, 68, 68, 0.08)' },
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  return `${Math.round(diff / 3_600_000)}h ago`
}

/**
 * Single toast-style notification used by the floating overlay or inline lists.
 * Auto-dismisses after `autoDismissMs` if provided, otherwise stays until the
 * user clicks ✕.
 */
export default function RealTimeNotification({
  notification,
  onDismiss,
  autoDismissMs,
  compact = false,
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!autoDismissMs) return undefined
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss?.(notification.id)
    }, autoDismissMs)
    return () => clearTimeout(timer)
  }, [autoDismissMs, notification.id, onDismiss])

  if (!visible) return null
  const style = LEVEL_STYLES[notification.level] ?? LEVEL_STYLES.info

  return (
    <div
      role="status"
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
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: compact ? '12px' : '13px',
              color: 'var(--text-primary)',
            }}
          >
            {notification.title}
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
            setVisible(false)
            onDismiss(notification.id)
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
  )
}
