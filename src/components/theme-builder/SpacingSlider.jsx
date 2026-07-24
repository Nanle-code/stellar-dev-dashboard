import React from 'react'

export default function SpacingSlider({ baseUnit, onChange }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Spacing
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Base Unit</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {baseUnit}px
          </span>
        </div>
        <input
          type="range"
          min="4"
          max="16"
          step="1"
          value={baseUnit}
          onChange={(e) => onChange('spacing', { baseUnit: parseInt(e.target.value, 10) })}
          style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--cyan)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>4px</span>
          <span>16px</span>
        </div>
      </div>
    </div>
  )
}
