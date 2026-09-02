import React from 'react'

export default function NetworkError({ message, onRetry, retrying = false }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '24px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '32px' }}>🌐</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
        Connection Problem
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '320px', lineHeight: 1.5 }}>
        {message || 'Unable to connect to the Stellar network. Check your internet connection.'}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          style={{
            padding: '8px 20px',
            background: retrying ? 'var(--bg-elevated)' : 'var(--cyan)',
            color: retrying ? 'var(--text-muted)' : 'var(--bg-base)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: retrying ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {retrying && <div className="spinner" style={{ width: '12px', height: '12px' }} />}
          {retrying ? 'Retrying...' : '🔄 Retry'}
        </button>
      )}
    </div>
  )
}
