import React from 'react'
import RealTimeNotification from './RealTimeNotification'
import { useStore } from '../../lib/store'

/**
 * Slide-over panel listing every notification accumulated
 * this session. Distinct from the existing toast `NotificationCenter` —
 * this one is durable history, opened from a header bell button.
 */
export default function RealTimeNotificationCenter({ open, onClose }) {
  const notifications = useStore((state) => state.notificationHistory)
  const unreadCount = useStore((state) => state.unreadNotificationCount)
  const markAllRead = useStore((state) => state.markAllNotificationsRead)
  const markRead = useStore((state) => state.markNotificationRead)
  const clear = useStore((state) => state.clearNotificationHistory)

  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.32)',
          zIndex: 1100,
        }}
      />
      <aside
        role="dialog"
        aria-label="Real-time notifications"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '360px',
          maxWidth: '92vw',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 1101,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--text-primary)',
              }}
            >
              Notifications
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {unreadCount === 0
                ? `${notifications.length} total`
                : `${unreadCount} unread / ${notifications.length} total`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm, 4px)',
              padding: '4px 8px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        </header>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            className="btn"
            disabled={unreadCount === 0}
            onClick={markAllRead}
            style={{ fontSize: '11px' }}
          >
            Mark all read
          </button>
          <button
            type="button"
            className="btn"
            disabled={notifications.length === 0}
            onClick={clear}
            style={{ fontSize: '11px' }}
          >
            Clear all
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12px',
              }}
            >
              No notifications yet. Subscribe to an account or contract stream
              to start receiving real-time updates.
            </div>
          ) : (
            notifications.map((n) => (
              <RealTimeNotification
                key={n.id}
                notification={n}
                onDismiss={markRead}
              />
            ))
          )}
        </div>
      </aside>
    </>
  )
}
