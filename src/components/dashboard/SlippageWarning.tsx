import React from 'react'

interface SlippageWarningProps {
  predictedSlippage: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendedTolerance: number
  confidence: number
  breakdown: {
    hopContribution: number
    liquidityContribution: number
    amountContribution: number
    volatilityContribution: number
    timeContribution: number
  }
  showDetails?: boolean
}

const riskColors: Record<string, { bg: string; border: string; text: string }> = {
  low: { bg: 'var(--green-glow-sm)', border: 'var(--green)', text: 'var(--green)' },
  medium: { bg: 'var(--amber-glow-sm)', border: 'var(--amber)', text: 'var(--amber)' },
  high: { bg: 'var(--red-glow-sm)', border: 'var(--red)', text: 'var(--red)' },
  critical: { bg: 'var(--red-glow-sm)', border: 'var(--red)', text: 'var(--red)' },
}

const riskLabels: Record<string, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
}

export default function SlippageWarning({
  predictedSlippage,
  riskLevel,
  recommendedTolerance,
  confidence,
  breakdown,
  showDetails = false,
}: SlippageWarningProps) {
  const colors = riskColors[riskLevel] || riskColors.medium

  return (
    <div style={{
      padding: '12px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 'var(--radius-md)',
      marginTop: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>
            {riskLevel === 'low' ? '✅' : riskLevel === 'medium' ? '⚠️' : '🚨'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>
            {riskLabels[riskLevel]}
          </span>
        </div>
        <span style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: colors.text,
          fontWeight: 500,
        }}>
          {(predictedSlippage * 100).toFixed(2)}% predicted
        </span>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Recommended tolerance: <span style={{ color: colors.text, fontWeight: 500 }}>
            {(recommendedTolerance * 100).toFixed(2)}%
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Confidence: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>

      {showDetails && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${colors.border}` }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
            BREAKDOWN
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
            {Object.entries(breakdown).map(([key, value]) => (
              <div key={key} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{formatBreakdownKey(key)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {(value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {riskLevel === 'critical' && (
        <div style={{
          marginTop: '10px',
          padding: '8px 10px',
          background: 'var(--bg-canvas)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}>
          💡 Consider splitting your transaction or waiting for better market conditions.
        </div>
      )}
    </div>
  )
}

function formatBreakdownKey(key: string): string {
  return key
    .replace(/Contribution$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase())
}
