/**
 * NotificationPreferences.tsx
 * Editor for notification delivery preferences: per-category toggles, minimum
 * priority threshold, grouping, quiet hours, and push/sound overrides.
 *
 * Backed by lib/notificationPreferences.ts (IndexedDB, key 'notification-preferences-v1').
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Bell, RotateCcw } from 'lucide-react'
import {
  defaultNotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferences,
  resetNotificationPreferences,
  type NotificationPreferences as NotificationPrefs,
} from '../../lib/notificationPreferences'
import {
  NOTIFICATION_CATEGORIES,
  PRIORITY_ORDER,
  type NotificationCategory,
  type NotificationPriority,
} from '../../lib/notificationCategories'
import { addBreadcrumb } from '../../lib/errorReporting'

type CategoryOverrides = 'enabledCategories' | 'soundsEnabled' | 'pushEnabled'

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginBottom: '6px',
  fontFamily: 'var(--font-mono)',
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  cursor: 'pointer',
  outline: 'none',
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}      style={{
        width: '36px',
        height: '20px',
        borderRadius: '10px',
        background: checked ? 'var(--cyan)' : 'var(--border-bright)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 180ms ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '18px' : '2px',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: 'white',
          transition: 'left 180ms ease',
        }}
      />
    </button>
  )
}

function PreferenceRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{label}</div>
        {hint && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</div>}
      </div>
      {children}
    </div>
  )
}

export default function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultNotificationPreferences())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    loadNotificationPreferences().then((loaded) => {
      if (cancelled) return
      setPrefs(loaded)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const patch = useCallback(async (partial: Partial<NotificationPrefs>) => {
    const next = await saveNotificationPreferences(partial)
    setPrefs(next)
    return next
  }, [])

  const toggleCategoryOverride = useCallback(async (
    field: CategoryOverrides,
    category: NotificationCategory,
  ) => {
    const current = prefs[field][category] !== false
    await patch({ [field]: { [category]: !current } } as Partial<NotificationPrefs>)
    addBreadcrumb('Notification category preference changed', 'user_action', { field, category, enabled: !current })
  }, [prefs, patch])

  const handleReset = useCallback(async () => {
    const next = await resetNotificationPreferences()
    setPrefs(next)
    addBreadcrumb('Notification preferences reset', 'user_action')
  }, [])

  if (loading) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading notification preferences...</div>
  }

  const categories = Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={panelStyle}>
        <PreferenceRow label="Minimum priority" hint="Hide anything below this level">
          <select
            aria-label="Minimum priority"
            value={prefs.minimumPriority}
            onChange={(e) => patch({ minimumPriority: e.target.value as NotificationPriority })}
            style={selectStyle}
          >
            {PRIORITY_ORDER.map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
        </PreferenceRow>

        <PreferenceRow label="Collapse groups" hint="Group similar notifications into one entry">
          <Toggle
            label="Collapse groups"
            checked={prefs.collapseGroups}
            onChange={(next) => patch({ collapseGroups: next })}
          />
        </PreferenceRow>
      </div>

      <div style={panelStyle}>
        <p style={labelStyle}>CATEGORIES</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categories.map((category) => {
            const meta = NOTIFICATION_CATEGORIES[category]
            const enabled = prefs.enabledCategories[category] !== false
            return (
              <div
                key={category}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: enabled ? 'transparent' : 'var(--bg-card)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.35 }}>{meta.description}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <Toggle
                    label={`Enable ${meta.label}`}
                    checked={enabled}
                    onChange={() => toggleCategoryOverride('enabledCategories', category)}
                  />
                  <Toggle
                    label={`Sound for ${meta.label}`}
                    checked={prefs.soundsEnabled[category] === true}
                    onChange={() => toggleCategoryOverride('soundsEnabled', category)}
                  />
                  <Toggle
                    label={`Push for ${meta.label}`}
                    checked={prefs.pushEnabled[category] === true}
                    onChange={() => toggleCategoryOverride('pushEnabled', category)}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
          Each category has three toggles: enabled, sound, and browser push.
        </p>
      </div>

      <div style={panelStyle}>
        <p style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Bell size={11} /> QUIET HOURS
        </p>
        <PreferenceRow label="Enabled" hint="Suppress notifications during this window">
          <Toggle
            label="Quiet hours enabled"
            checked={prefs.quietHours.enabled}
            onChange={(next) => patch({ quietHours: { ...prefs.quietHours, enabled: next } })}
          />
        </PreferenceRow>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Starts
            <input
              type="number"
              min={0}
              max={23}
              aria-label="Quiet hours start hour"
              value={prefs.quietHours.startHour}
              onChange={(e) => patch({ quietHours: { ...prefs.quietHours, startHour: clampHour(e.target.value) } })}
              style={{ ...selectStyle, width: '80px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Ends
            <input
              type="number"
              min={0}
              max={23}
              aria-label="Quiet hours end hour"
              value={prefs.quietHours.endHour}
              onChange={(e) => patch({ quietHours: { ...prefs.quietHours, endHour: clampHour(e.target.value) } })}
              style={{ ...selectStyle, width: '80px' }}
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={handleReset}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '8px 10px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-bright)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        <RotateCcw size={13} />
        Reset notification preferences
      </button>
    </div>
  )
}

function clampHour(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return 0
  return Math.max(0, Math.min(23, parsed))
}
