import React, { useState } from 'react'

export default function RetryButton({ onRetry, label = 'Retry', maxRetries = 3, className }) {
  const [retryCount, setRetryCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleRetry = async () => {
    if (loading || retryCount >= maxRetries) return
    setLoading(true)
    try {
      await onRetry()
      setRetryCount(0)
    } catch {
      setRetryCount((c) => c + 1)
    } finally {
      setLoading(false)
    }
  }

  const exhausted = retryCount >= maxRetries

  return (
    <button
      onClick={handleRetry}
      disabled={loading || exhausted}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        background: exhausted ? 'var(--bg-elevated)' : 'var(--cyan)',
        color: exhausted ? 'var(--text-muted)' : 'var(--bg-base)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        fontSize: '12px',
        cursor: loading || exhausted ? 'not-allowed' : 'pointer',
        transition: 'var(--transition)',
      }}
    >
      {loading && <div className="spinner" style={{ width: '12px', height: '12px' }} />}
      {exhausted ? 'Max retries reached' : loading ? 'Retrying...' : `🔄 ${label}`}
      {!exhausted && !loading && retryCount > 0 && (
        <span style={{ fontSize: '10px', opacity: 0.7 }}>({maxRetries - retryCount} left)</span>
      )}
    </button>
  )
}
