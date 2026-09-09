import React from 'react'

const CATEGORY_COLORS = {
  token: 'var(--cyan)',
  escrow: 'var(--amber)',
  governance: 'var(--green)',
  nft: '#a78bfa',
  utility: 'var(--text-secondary)',
}

const CATEGORY_ICONS = {
  token: '🪙',
  escrow: '🔒',
  governance: '🗳️',
  nft: '🖼️',
  utility: '⚙️',
}

export default function TemplateCard({ template, selected, onSelect }) {
  const color = CATEGORY_COLORS[template.category] || 'var(--cyan)'
  const icon = CATEGORY_ICONS[template.category] || '📄'

  return (
    <button
      onClick={() => onSelect(template)}
      style={{
        textAlign: 'left',
        padding: '14px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${selected ? color : 'var(--border)'}`,
        background: selected ? `color-mix(in srgb, ${color} 10%, var(--bg-elevated))` : 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        transition: 'var(--transition)',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border-bright)'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: selected ? color : 'var(--text-primary)' }}>
          {template.name}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '9px',
          padding: '2px 6px',
          borderRadius: '999px',
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 600,
        }}>
          {template.category}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '8px' }}>
        {template.description}
      </div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {template.methods.slice(0, 4).map((m) => (
          <span key={m} style={{
            fontSize: '9px',
            padding: '2px 6px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>
            {m}
          </span>
        ))}
        {template.methods.length > 4 && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', padding: '2px 4px' }}>
            +{template.methods.length - 4} more
          </span>
        )}
      </div>
    </button>
  )
}
