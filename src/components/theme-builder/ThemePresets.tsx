import React from 'react'
import { PRESET_THEMES, getActivePresetId } from '../../styles/themeTypes'

const PRESET_META = [
  { id: 'dark', label: 'Dark', getColor: () => PRESET_THEMES[0].colors.primary },
  { id: 'light', label: 'Light', getColor: () => PRESET_THEMES[1].colors.primary },
  { id: 'highContrast', label: 'High Contrast', getColor: () => PRESET_THEMES[2].colors.primary },
  { id: 'custom', label: 'Custom', getColor: (colors) => colors?.primary || '#888' },
]

export default function ThemePresets({ draft, onSelect }) {
  const activeId = getActivePresetId(draft.colors)

  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Presets
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {PRESET_META.map((preset) => {
          const isActive = activeId === preset.id
          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset.id)}
              style={{
                padding: '8px 14px',
                background: isActive ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                border: `1px solid ${isActive ? 'var(--cyan-dim)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: isActive ? 'var(--cyan)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'var(--transition)',
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: preset.getColor(draft.colors),
                display: 'inline-block',
                flexShrink: 0,
              }} />
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
