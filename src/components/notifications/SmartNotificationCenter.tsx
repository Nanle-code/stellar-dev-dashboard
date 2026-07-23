import React, { useEffect, useMemo, useState } from 'react'
import {
  NotificationDeduplicator,
  type SmartNotification,
} from '../../lib/notificationDeduplicator'
import {
  NOTIFICATION_CATEGORIES,
  PRIORITY_ORDER,
  type NotificationCategory,
  type NotificationPriority,
} from '../../lib/notificationCategories'
import {
  filterNotifications,
  type NotificationFilterConfig,
  type NotificationSortMode,
} from '../../lib/notificationFilter'
import {
  loadNotificationPreferences,
  preferencesToFilterConfig,
} from '../../lib/notificationPreferences'
import {
  ArrowLeftRight,
  Wallet,
  Shield,
  Activity,
  Settings,
  TrendingUp,
  FileCode,
  CheckCheck,
  Trash2,
  Filter,
  ArrowUpDown,
  Bell,
  BellOff,
  AlertTriangle,
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  transaction: <ArrowLeftRight size={14} />,
  balance: <Wallet size={14} />,
  security: <Shield size={14} />,
  network: <Activity size={14} />,
  system: <Settings size={14} />,
  price: <TrendingUp size={14} />,
  contract: <FileCode size={14} />,
}

const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  critical: 'var(--red)',
  high: 'var(--amber)',
  medium: 'var(--cyan)',
  low: 'var(--text-muted)',
}

const SORT_MODES: { value: NotificationSortMode; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'recent', label: 'Recent' },
  { value: 'category', label: 'Category' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SmartNotificationCenterProps {
  open: boolean
  onClose: () => void
  notifications: SmartNotification[]
  /** Called when the user dismisses/marks-read a notification group. */
  onDismiss?: (id: string) => void
  /** Called when user marks all as read. */
  onMarkAllRead?: () => void
  /** Called when user clears all. */
  onClearAll?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SmartNotificationCenter({
  open,
  onClose,
  notifications,
  onDismiss,
  onMarkAllRead,
  onClearAll,
}: SmartNotificationCenterProps) {
  const [filterConfig, setFilterConfig] = useState<NotificationFilterConfig | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all')
  const [sortMode, setSortMode] = useState<NotificationSortMode>('priority')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadNotificationPreferences().then((prefs) => {
      setFilterConfig(preferencesToFilterConfig(prefs))
    })
  }, [])

  const categories = useMemo(() => {
    const cats = new Set(notifications.map((n) => n.category))
    return Array.from(cats).sort()
  }, [notifications])

  const processed = useMemo(() => {
    if (!filterConfig) return []

    let filtered = filterNotifications(notifications, filterConfig, sortMode)

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((n) => n.category === selectedCategory)
    }

    return filtered
  }, [notifications, filterConfig, selectedCategory, sortMode])

  const unreadCount = useMemo(
    () => notifications.reduce((n, it) => (it.read ? n : n + 1), 0),
    [notifications],
  )

  if (!open) return null

  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={overlayStyle} />
      <aside role="dialog" aria-label="Smart notifications" style={panelStyle}>
        {/* Header */}
        <header style={headerStyle}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
              Notifications
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {unreadCount === 0
                ? `${notifications.length} total`
                : `${unreadCount} unread / ${notifications.length} total`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Toggle filters"
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '4px 6px',
                cursor: 'pointer',
                color: showFilters ? 'var(--cyan)' : 'var(--text-muted)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Filter size={12} />
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

        {/* Action bar */}
        <div style={actionBarStyle}>
          <button
            type="button"
            className="btn"
            disabled={unreadCount === 0}
            onClick={onMarkAllRead}
            style={actionBtnStyle}
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
          <button
            type="button"
            className="btn"
            disabled={notifications.length === 0}
            onClick={onClearAll}
            style={actionBtnStyle}
          >
            <Trash2 size={12} />
            Clear all
          </button>

          {/* Sort */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
            {SORT_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setSortMode(m.value)}
                style={{
                  padding: '3px 6px',
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  background: sortMode === m.value ? 'var(--cyan-glow-sm)' : 'transparent',
                  border: `1px solid ${sortMode === m.value ? 'var(--cyan-dim)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm, 3px)',
                  color: sortMode === m.value ? 'var(--cyan)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div style={filtersPanelStyle}>
            {/* Category filter chips */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <FilterChip
                active={selectedCategory === 'all'}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </FilterChip>
              {categories.map((cat) => (
                <FilterChip
                  key={cat}
                  active={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {CATEGORY_ICONS[cat]}
                  {NOTIFICATION_CATEGORIES[cat]?.label ?? cat}
                </FilterChip>
              ))}
            </div>
          </div>
        )}

        {/* Notification list */}
        <div style={listStyle}>
          {processed.length === 0 ? (
            <div style={emptyStyle}>
              {notifications.length === 0
                ? 'No notifications yet. Subscribe to an account or contract stream to start receiving real-time updates.'
                : 'No notifications match the current filter.'}
            </div>
          ) : (
            processed.map((notification) => (
              <SmartNotificationCard
                key={notification.id}
                notification={notification}
                onDismiss={onDismiss}
              />
            ))
          )}
        </div>
      </aside>
    </>
  )
}

// ─── Internal card component ─────────────────────────────────────────────────

function SmartNotificationCard({
  notification,
  onDismiss,
}: {
  notification: SmartNotification
  onDismiss?: (id: string) => void
}) {
  const info = NOTIFICATION_CATEGORIES[notification.category]
  const priorityColor = PRIORITY_COLORS[notification.priority]

  return (
    <div
      role="status"
      style={{
        background: notification.read ? 'var(--bg-card)' : 'var(--cyan-glow-sm)',
        border: `1px solid ${notification.read ? 'var(--border)' : 'var(--cyan-dim)'}`,
        borderLeft: `3px solid ${priorityColor}`,
        borderRadius: 'var(--radius-md, 8px)',
        padding: '10px 12px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        transition: 'var(--transition)',
        minWidth: 0,
      }}
    >
      {/* Category icon */}
      <span style={{
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        background: `${priorityColor}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: priorityColor,
        flexShrink: 0,
        fontSize: '12px',
      }}>
        {CATEGORY_ICONS[notification.category] || <Bell size={12} />}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '8px',
          alignItems: 'baseline',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '12px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            {notification.title}
            {notification.count > 1 && (
              <span style={{
                padding: '1px 5px',
                borderRadius: '8px',
                background: priorityColor,
                color: 'white',
                fontSize: '9px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                lineHeight: '14px',
              }}>
                {notification.count}
              </span>
            )}
          </div>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
          }}>
            {timeAgo(notification.lastOccurrence)}
          </div>
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          marginTop: '3px',
          wordBreak: 'break-word',
        }}>
          {notification.count > 1
            ? `${notification.message} (×${notification.count})`
            : notification.message}
        </div>
        {/* Category + priority badges */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          {info && (
            <Badge color={priorityColor}>
              {info.label}
            </Badge>
          )}
          <Badge color={priorityColor}>
            {notification.priority}
          </Badge>
        </div>
      </div>

      {/* Dismiss */}
      {onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0 4px',
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0.6,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        background: active ? 'var(--cyan-glow-sm)' : 'transparent',
        border: `1px solid ${active ? 'var(--cyan-dim)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm, 4px)',
        color: active ? 'var(--cyan)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'var(--transition)',
      }}
    >
      {children}
    </button>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ color, children }) {
  return (
    <span style={{
      padding: '1px 5px',
      borderRadius: '3px',
      background: `${color}18`,
      color,
      fontSize: '9px',
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
      lineHeight: '14px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    }}>
      {children}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  return `${Math.round(diff / 3_600_000)}h ago`
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.32)',
  zIndex: 1100,
}

const panelStyle: React.CSSProperties = {
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
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 18px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const actionBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  padding: '8px 14px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '10px',
  fontFamily: 'var(--font-mono)',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm, 4px)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
}

const filtersPanelStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
  background: 'var(--bg-elevated)',
}

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const emptyStyle: React.CSSProperties = {
  padding: '40px 20px',
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: '12px',
}
