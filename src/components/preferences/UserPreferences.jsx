import React, { useState } from 'react'
import { usePreferences } from '../../hooks/usePreferences'
import AddressBook from './AddressBook'
import ThemeSettings from './ThemeSettings'
import AccessibilitySettings from '../accessibility/AccessibilitySettings'
import { showTestNotification } from '../../utils/offline'
import { Bell } from 'lucide-react'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'theme', label: 'Theme & Display' },
  { id: 'addresses', label: 'Address Book' },
  { id: 'accessibility', label: 'Accessibility' },
]

export default function UserPreferences({ onClose }) {
  const { preferences, update, reset, loading } = usePreferences()
  const [activeTab, setActiveTab] = useState('general')
  const [saved, setSaved] = useState(false)

  const handleChange = async (key, value) => {
    await update(key, value)
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
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      maxWidth: '600px',
      width: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px' }}>
          User Preferences
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saved && (
            <span style={{ fontSize: '11px', color: 'var(--green)' }}>✓ Saved</span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '6px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '5px 12px',
              background: activeTab === tab.id ? 'var(--cyan-glow)' : 'transparent',
              border: `1px solid ${activeTab === tab.id ? 'var(--cyan-dim)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: activeTab === tab.id ? 'var(--cyan)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '18px' }}>
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <PreferenceRow label="Default Network">
              <select
                value={preferences.defaultNetwork}
                onChange={(e) => handleChange('defaultNetwork', e.target.value)}
                style={selectStyle}
              >
                {['mainnet', 'testnet', 'futurenet', 'local'].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </PreferenceRow>

            <PreferenceRow label="Currency">
              <select
                value={preferences.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                style={selectStyle}
              >
                {['USD', 'EUR', 'XLM'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </PreferenceRow>

            <PreferenceRow label="Language">
              <select
                value={preferences.language}
                onChange={(e) => handleChange('language', e.target.value)}
                style={selectStyle}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="zh">中文</option>
              </select>
            </PreferenceRow>

            <PreferenceRow label="Compact Mode">
              <Toggle
                checked={preferences.compactMode}
                onChange={(v) => handleChange('compactMode', v)}
              />
            </PreferenceRow>

            <PreferenceRow label="Show Advanced Panels">
              <Toggle
                checked={preferences.showAdvancedPanels}
                onChange={(v) => handleChange('showAdvancedPanels', v)}
              />
            </PreferenceRow>

            <PreferenceRow label="Auto Refresh">
              <Toggle
                checked={preferences.autoRefresh}
                onChange={(v) => handleChange('autoRefresh', v)}
              />
            </PreferenceRow>

            <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
              <button
                onClick={showTestNotification}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'background 180ms ease',
                }}
              >
                <Bell size={14} className="text-cyan" />
                Test Push Notification
              </button>
            </div>

            <button
              onClick={reset}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: '1px solid var(--red)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--red)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Reset to Defaults
            </button>
          </div>
        )}

        {activeTab === 'theme' && (
          <ThemeSettings preferences={preferences} onChange={handleChange} />
        )}
        {activeTab === 'accessibility' && (
          <AccessibilitySettings />
        )}

        {activeTab === 'addresses' && (
          <AddressBook />
        )}
      </div>
    </div>
  )
}

function PreferenceRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
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
      <span style={{
        position: 'absolute',
        top: '2px',
        left: checked ? '18px' : '2px',
        width: '16px',
        height: '16px',
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
}
