import React from 'react'

const COLOR_LABELS = {
  background: 'Background',
  surface: 'Surface',
  primary: 'Primary',
  secondary: 'Secondary',
  text: 'Text',
}

export default function ColorPicker({ colors, onChange }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Colors
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(COLOR_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', minWidth: '80px' }}>
              {label}
            </span>
            <input
              type="color"
              value={colors[key]}
              onChange={(e) => onChange('colors', { ...colors, [key]: e.target.value })}
              style={{
                width: '32px',
                height: '32px',
                padding: '2px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: 'none',
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={colors[key]}
              onChange={(e) => onChange('colors', { ...colors, [key]: e.target.value })}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-bright)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
