import React from 'react'

const FONT_SIZES = [
  { value: 'small', label: 'Small', px: '12px' },
  { value: 'medium', label: 'Medium', px: '14px' },
  { value: 'large', label: 'Large', px: '16px' },
]

export default function ThemeSettings({ preferences, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Theme */}
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
          Color Theme
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['dark', 'light', 'auto'].map((t) => (
            <button
              key={t}
              onClick={() => onChange('theme', t)}
              style={{
                padding: '8px 16px',
                background: preferences.theme === t ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                border: `1px solid ${preferences.theme === t ? 'var(--cyan-dim)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: preferences.theme === t ? 'var(--cyan)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t === 'dark' ? '☾ Dark' : t === 'light' ? '☀ Light' : '⚙ Auto'}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
          Font Size
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {FONT_SIZES.map((f) => (
            <button
              key={f.value}
              onClick={() => onChange('fontSize', f.value)}
              style={{
                padding: '8px 16px',
                background: preferences.fontSize === f.value ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                border: `1px solid ${preferences.fontSize === f.value ? 'var(--cyan-dim)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: preferences.fontSize === f.value ? 'var(--cyan)' : 'var(--text-secondary)',
                fontSize: f.px,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div style={{
        padding: '14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Preview</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Stellar Dev Dashboard
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--cyan)' }}>
          GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Balance: 1,000.0000000 XLM
        </div>
      </div>
    </div>
  )
}
