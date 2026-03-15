import React from 'react'

export default function Card({ children, title, subtitle, action, glow, style = {}, className = '' }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${glow ? 'var(--cyan-dim)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: glow ? '0 0 24px var(--cyan-glow-sm)' : 'none',
        ...style,
      }}
    >
      {(title || action) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '13px',
              color: 'var(--text-primary)',
              letterSpacing: '0.3px',
            }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, accent, loading }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: accent || 'var(--cyan)',
        opacity: 0.7,
      }} />
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>
        {label}
      </div>
      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            fontWeight: 700,
            color: accent || 'var(--text-primary)',
            lineHeight: 1,
            marginBottom: '4px',
          }}>{value ?? '—'}</div>
          {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>}
        </>
      )}
    </div>
  )
}
