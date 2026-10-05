import React from 'react'
import { usePreferenceUndo } from '../../hooks/usePreferenceUndo'
import { RotateCcw, X } from 'lucide-react'

export interface PreferenceUndoBannerProps {
  style?: React.CSSProperties
  className?: string
  compact?: boolean
}

export default function PreferenceUndoBanner({ style, className, compact = false }: PreferenceUndoBannerProps) {
  const { canUndo, latestAction, timeRemainingMs, undo, clear } = usePreferenceUndo()

  if (!canUndo || !latestAction) {
    return null
  }

  const seconds = Math.ceil(timeRemainingMs / 1000)

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        padding: compact ? '8px 12px' : '10px 16px',
        background: 'var(--bg-card, rgba(15, 23, 42, 0.95))',
        border: '1px solid var(--cyan-dim, rgba(6, 182, 212, 0.3))',
        borderRadius: 'var(--radius-md, 8px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
        color: 'var(--text-primary, #f8fafc)',
        fontSize: compact ? '12px' : '13px',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        gap: '12px',
        transition: 'all 0.2s ease-in-out',
        backdropFilter: 'blur(8px)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--cyan-glow, rgba(6, 182, 212, 0.15))',
            color: 'var(--cyan, #06b6d4)',
            flexShrink: 0,
          }}
        >
          <RotateCcw size={14} />
        </span>
        <span style={{ fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {latestAction.label}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted, #94a3b8)',
            fontFamily: 'var(--font-mono, monospace)',
            background: 'var(--bg-dark, rgba(0,0,0,0.2))',
            padding: '2px 6px',
            borderRadius: '10px',
            flexShrink: 0,
          }}
        >
          {seconds}s
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => undo()}
          style={{
            padding: '4px 10px',
            background: 'var(--cyan, #06b6d4)',
            color: '#000',
            border: 'none',
            borderRadius: 'var(--radius-sm, 4px)',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Undo
        </button>
        <button
          onClick={() => clear()}
          aria-label="Dismiss undo notification"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
