import React, { useState, useEffect, useRef } from 'react'
import SmartNotificationCenter from './SmartNotificationCenter'
import RealTimeNotification from './RealTimeNotification'
import { useStore } from '../../lib/store'
import { useSmartNotifications } from '../../hooks/useSmartNotifications'
import { Sparkles } from 'lucide-react'
import FocusManager from '../accessibility/FocusManager'

/**
 * Slide-over panel listing every notification accumulated this session.
 *
 * Upgraded with smart deduplication, category-based filtering, and
 * priority sorting. A toggle button lets the user switch between the
 * original flat list and the smart grouped view.
 *
 * Maintains full backward compatibility — the original `notificationHistory`
 * rendering is preserved via a "Classic" toggle.
 */
export default function RealTimeNotificationCenter({ open, onClose }) {
  const [smartMode, setSmartMode] = useState(true)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement
    } else if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

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
      <FocusManager trapFocus restoreFocusOnUnmount returnFocusElement={triggerRef.current}>
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Real-time notifications"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '380px',
          maxWidth: '92vw',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 1101,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Smart mode toggle */}
            <button
              type="button"
              onClick={() => setSmartMode(!smartMode)}
              aria-label={smartMode ? 'Switch to classic notification view' : 'Switch to smart notification view'}
              aria-pressed={smartMode}
              title={smartMode ? 'Switch to classic view' : 'Switch to smart view'}
              style={{
                background: smartMode ? 'var(--cyan-glow-sm)' : 'transparent',
                border: `1px solid ${smartMode ? 'var(--cyan-dim)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '4px 8px',
                cursor: 'pointer',
                color: smartMode ? 'var(--cyan)' : 'var(--text-muted)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Sparkles size={12} />
              Smart
            </button>
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
          </div>
        </header>

        {smartMode ? <SmartView /> : <ClassicView />}
        </aside>
      </FocusManager>
    </>
  )
}

/**
 * Smart deduplicated + filterable notification view.
 */
function SmartView() {
  const { notifications, unreadCount, markRead, markAllRead, clear } = useSmartNotifications()

  const dedupedCount = notifications.length
  const totalCount = useStore((state) => state.notificationHistory.length)

  return (
    <SmartNotificationCenter
      open={true}
      onClose={() => {}}
      notifications={notifications}
      onDismiss={(id) => markRead(id)}
      onMarkAllRead={markAllRead}
      onClearAll={clear}
    />
  )
}

/**
 * Original flat-list view for backward compatibility.
 */
function ClassicView() {
  const notifications = useStore((state) => state.notificationHistory)
  const unreadCount = useStore((state) => state.unreadNotificationCount)
  const markAllRead = useStore((state) => state.markAllNotificationsRead)
  const markRead = useStore((state) => state.markNotificationRead)
  const clear = useStore((state) => state.clearNotificationHistory)

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 18px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
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
        <div style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          alignSelf: 'center',
          marginLeft: 'auto',
        }}>
          {unreadCount === 0
            ? `${notifications.length} total`
            : `${unreadCount} unread / ${notifications.length} total`}
        </div>
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
    </>
  )
}
