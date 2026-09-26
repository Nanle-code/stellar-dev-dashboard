import React, { useState } from 'react'

export default function ShareButton() {
  const [hint, setHint] = useState(null)

  const handleClick = () => {
    setHint('Share coming soon')
    setTimeout(() => setHint(null), 2000)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleClick}
        style={{
          padding: '8px 14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          transition: 'var(--transition)',
          opacity: 0.6,
        }}
        title="Share theme — coming soon"
      >
        Share
      </button>
      {hint && (
        <span
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '4px',
            padding: '3px 8px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {hint}
        </span>
      )}
    </div>
  )
}
