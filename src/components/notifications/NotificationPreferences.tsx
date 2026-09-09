import React, { useEffect, useState } from 'react'
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
  resetNotificationPreferences,
  defaultNotificationPreferences,
  type NotificationPreferences as NotificationPreferencesType,
} from '../../lib/notificationPreferences'
import { NOTIFICATION_CATEGORIES, PRIORITY_ORDER, type NotificationCategory, type NotificationPriority } from '../../lib/notificationCategories'
import {
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Monitor,
  Clock,
  FoldHorizontal,
  Trash2,
} from 'lucide-react'

const CATEGORY_LABELS: Record<NotificationCategory, { label: string; color: string }> = {
  transaction: { label: 'Transactions', color: 'var(--cyan)' },
  balance: { label: 'Balance', color: 'var(--success)' },
  security: { label: 'Security', color: 'var(--red)' },
  network: { label: 'Network', color: 'var(--amber)' },
  system: { label: 'System', color: 'var(--text-muted)' },
  price: { label: 'Price', color: 'var(--amber)' },
  contract: { label: 'Contract', color: 'var(--purple, #a855f7)' },
}

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreferencesType>(defaultNotificationPreferences())
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadNotificationPreferences().then((p) => {
      setPrefs(p)
      setLoading(false)
    })
  }, [])

  const update = async (partial: Partial<NotificationPreferencesType>) => {
    const next = await saveNotificationPreferences(partial)
    setPrefs(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const toggleCategory = (cat: NotificationCategory) => {
    update({
      enabledCategories: { ...prefs.enabledCategories, [cat]: !prefs.enabledCategories[cat] },
    })
  }

  const toggleSound = (cat: NotificationCategory) => {
    update({
      soundsEnabled: { ...prefs.soundsEnabled, [cat]: !prefs.soundsEnabled[cat] },
    })
  }

  const togglePush = (cat: NotificationCategory) => {
    update({
      pushEnabled: { ...prefs.pushEnabled, [cat]: !prefs.pushEnabled[cat] },
    })
  }

  const handleReset = async () => {
    const defaults = await resetNotificationPreferences()
    setPrefs(defaults)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', display: 'flex', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {saved && (
        <div style={{
          fontSize: '11px', color: 'var(--green)', textAlign: 'right',
          marginBottom: '-12px',
        }}>
          ✓ Saved
        </div>
      )}

      {/* Category toggles */}
      <div>
        <SectionTitle>Notification Categories</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]).map((cat) => {
            const info = CATEGORY_LABELS[cat]
            const enabled = prefs.enabledCategories[cat] !== false
            return (
              <div
                key={cat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  opacity: enabled ? 1 : 0.5,
                  transition: 'var(--transition)',
                }}
              >
                <CategoryDot color={info.color} />
                <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {info.label}
                </span>

                {enabled && (
                  <>
                    <IconToggle
                      icon={prefs.soundsEnabled[cat] ? <Volume2 size={14} /> : <VolumeX size={14} />}
                      active={prefs.soundsEnabled[cat] !== false}
                      title="Sound"
                      onClick={() => toggleSound(cat)}
                    />
                    <IconToggle
                      icon={prefs.pushEnabled[cat] ? <Bell size={14} /> : <BellOff size={14} />}
                      active={prefs.pushEnabled[cat] !== false}
                      title="Push notification"
                      onClick={() => togglePush(cat)}
                    />
                  </>
                )}

                <button
                  onClick={() => toggleCategory(cat)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    background: enabled ? 'var(--cyan-glow-sm)' : 'transparent',
                    border: `1px solid ${enabled ? 'var(--cyan-dim)' : 'var(--border-bright)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: enabled ? 'var(--cyan)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Priority threshold */}
      <div>
        <SectionTitle>Minimum Priority</SectionTitle>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
          Notifications below this priority level will be hidden.
        </p>
        <select
          value={prefs.minimumPriority}
          onChange={(e) => update({ minimumPriority: e.target.value as NotificationPriority })}
          style={selectStyle}
        >
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Quiet hours */}
      <div>
        <SectionTitle>Quiet Hours</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <Toggle
              checked={prefs.quietHours.enabled}
              onChange={() => update({
                quietHours: { ...prefs.quietHours, enabled: !prefs.quietHours.enabled },
              })}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {prefs.quietHours.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          {prefs.quietHours.enabled && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={prefs.quietHours.startHour}
                onChange={(e) => update({
                  quietHours: { ...prefs.quietHours, startHour: Number(e.target.value) },
                })}
                style={{ ...selectStyle, width: 'auto' }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
              <select
                value={prefs.quietHours.endHour}
                onChange={(e) => update({
                  quietHours: { ...prefs.quietHours, endHour: Number(e.target.value) },
                })}
                style={{ ...selectStyle, width: 'auto' }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Deduplication */}
      <div>
        <SectionTitle>Grouping & Deduplication</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <PreferenceRow>
            <FoldHorizontal size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', flex: 1, color: 'var(--text-secondary)' }}>
              Collapse identical notifications
            </span>
            <Toggle
              checked={prefs.collapseGroups}
              onChange={() => update({ collapseGroups: !prefs.collapseGroups })}
            />
          </PreferenceRow>
          <PreferenceRow>
            <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', flex: 1, color: 'var(--text-secondary)' }}>
              Group window (seconds)
            </span>
            <input
              type="number"
              min={5}
              max={3600}
              value={Math.round(prefs.dedupWindowMs / 1000)}
              onChange={(e) => update({ dedupWindowMs: Number(e.target.value) * 1000 })}
              style={{
                width: '60px',
                padding: '4px 6px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-bright)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                textAlign: 'center',
              }}
            />
          </PreferenceRow>
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={handleReset}
        style={{
          padding: '8px 14px',
          background: 'transparent',
          border: '1px solid var(--red)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--red)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          alignSelf: 'flex-start',
        }}
      >
        <Trash2 size={12} />
        Reset Notification Preferences
      </button>
    </div>
  )
}

// ─── Internal sub-components ──────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: '11px',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
      marginBottom: '8px',
      fontFamily: 'var(--font-mono)',
    }}>
      {children}
    </div>
  )
}

function PreferenceRow({ children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 0',
    }}>
      {children}
    </div>
  )
}

function CategoryDot({ color }) {
  return (
    <span style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }} />
  )
}

function IconToggle({ icon, active, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        opacity: active ? 1 : 0.5,
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {icon}
    </button>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: '32px',
        height: '18px',
        borderRadius: '9px',
        background: checked ? 'var(--cyan)' : 'var(--border-bright)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 180ms ease',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '2px',
        left: checked ? '16px' : '2px',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: 'white',
        transition: 'left 180ms ease',
      }} />
    </button>
  )
}

const selectStyle = {
  padding: '6px 10px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  cursor: 'pointer',
  outline: 'none',
  width: '100%',
}
