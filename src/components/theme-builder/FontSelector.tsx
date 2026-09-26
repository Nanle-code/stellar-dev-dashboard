import React from 'react'

const FONTS = [
  { value: "'Syne', sans-serif", label: 'Syne' },
  { value: "'Space Mono', monospace", label: 'Space Mono' },
]

export default function FontSelector({ fontFamily, fontScale, onChange }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Typography
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Font Family
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {FONTS.map((f) => (
              <button
                key={f.value}
                onClick={() => onChange('typography', { fontFamily: f.value, fontScale })}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: fontFamily === f.value ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                  border: `1px solid ${fontFamily === f.value ? 'var(--cyan-dim)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: fontFamily === f.value ? 'var(--cyan)' : 'var(--text-secondary)',
                  fontSize: fontFamily === f.value ? '14px' : '12px',
                  fontFamily: f.value,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'var(--transition)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Font Scale</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {fontScale.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0.75"
            max="1.5"
            step="0.05"
            value={fontScale}
            onChange={(e) => onChange('typography', { fontFamily, fontScale: parseFloat(e.target.value) })}
            style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--cyan)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>0.75×</span>
            <span>1.5×</span>
          </div>
        </div>
      </div>
    </div>
  )
}
