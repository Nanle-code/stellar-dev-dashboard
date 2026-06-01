import React from 'react'

export const ChunkLoadingFallback: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        width: '100%',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '3px solid var(--border)',
            borderTop: '3px solid var(--cyan, #06b6d4)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '16px',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          Loading module...
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

export default ChunkLoadingFallback
