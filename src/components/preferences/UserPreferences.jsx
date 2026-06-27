import React, { useState } from 'react'
import { usePreferences } from '../../hooks/usePreferences'
import AddressBook from './AddressBook'
import ThemeSettings from './ThemeSettings'
import AccessibilitySettings from '../accessibility/AccessibilitySettings'
import { showTestNotification } from '../../utils/offline'
import { Bell, Globe2 } from 'lucide-react'
import { useI18nContext } from '../I18nProvider.jsx'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'theme', label: 'Theme & Display' },
  { id: 'presets', label: 'Presets & Sync' },
  { id: 'addresses', label: 'Address Book' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'notifications', label: 'Notifications' },
]

export default function UserPreferences({ onClose }) {
  const { preferences, update, reset, loading } = usePreferences()
  const {
    changeLanguage,
    currentLanguage,
    currentLocale,
    supportedLanguages,
    localeProfile,
    regionalContent,
    formatDateTime,
    formatNumber,
    formatCurrency,
    isRTL,
  } = useI18nContext()
  const [activeTab, setActiveTab] = useState('general')
  const [saved, setSaved] = useState(false)
  const [shareToken, setShareToken] = useState('')
  const validation = validatePreferences(preferences)
  const syncStatus = getPreferenceSyncStatus(preferences)

  const handleChange = async (key, value) => {
    await update(key, value)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleLanguageChange = async (languageCode) => {
    await changeLanguage(languageCode)
    await handleChange('language', languageCode)
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
      <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                value={currentLanguage || preferences.language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                style={selectStyle}
              >
                {supportedLanguages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.nativeLabel} ({language.locale})
                  </option>
                ))}
              </select>
            </PreferenceRow>

            <div style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              padding: '12px',
              display: 'grid',
              gap: '8px',
              fontSize: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                <Globe2 size={14} />
                {localeProfile.label}
              </div>
              <LocalePreview label="Region" value={`${localeProfile.region} / ${currentLocale} / ${isRTL ? 'RTL' : 'LTR'}`} />
              <LocalePreview label="Date" value={formatDateTime('2026-06-25T15:30:00Z')} />
              <LocalePreview label="Number" value={formatNumber(1234567.89)} />
              <LocalePreview label="Currency" value={formatCurrency(1234.56)} />
              <LocalePreview label="Local note" value={regionalContent.defaultNetworkNotice} />
            </div>

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

        {activeTab === 'presets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
              {PREFERENCE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePreset(preset.id)}
                  style={{
                    ...presetButtonStyle,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <SlidersHorizontal size={14} />
                    {preset.name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.35 }}>
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
              <StatusChip label="Schema" value={`v${preferences.schemaVersion}`} />
              <StatusChip label="Options" value={validation.preferenceCount} />
              <StatusChip label="Validation" value={validation.valid ? 'Valid' : `${validation.errors.length} errors`} />
              <StatusChip label="Sync" value={syncStatus.state} />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={handleExport} style={actionButtonStyle}>
                <Download size={14} />
                Export JSON
              </button>
              <button onClick={handleImport} style={actionButtonStyle}>
                <Upload size={14} />
                Import JSON
              </button>
              <button onClick={handleSharePreset} style={actionButtonStyle}>
                <Share2 size={14} />
                Share Preset
              </button>
              <button
                onClick={() => handleChange('sync', { ...preferences.sync, pendingChanges: 0, lastSyncedAt: new Date().toISOString() })}
                style={actionButtonStyle}
              >
                <RefreshCw size={14} />
                Mark Synced
              </button>
            </div>

            {shareToken && (
              <div style={{
                padding: '10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-muted)',
                fontSize: '11px',
                overflowWrap: 'anywhere',
              }}>
                {shareToken}
              </div>
            )}
          </div>
        )}

        {activeTab === 'accessibility' && (
          <AccessibilitySettings />
        )}

        {activeTab === 'notifications' && (
          <NotificationPreferences />
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

function LocalePreview({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr)', gap: '8px', alignItems: 'center' }}>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{value}</span>
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

const presetButtonStyle = {
  padding: '10px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
}

const actionButtonStyle = {
  padding: '8px 10px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  cursor: 'pointer',
}

function StatusChip({ label, value }) {
  return (
    <div style={{
      padding: '8px 10px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-elevated)',
      fontSize: '11px',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{value}</div>
    </div>
  )
}
