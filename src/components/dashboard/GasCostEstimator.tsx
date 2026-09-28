import React, { useMemo } from 'react'
import { Zap, TrendingUp, AlertTriangle, Clock, Layers, Activity, Fuel } from 'lucide-react'
import type { GasPrediction } from '../../lib/gasPredictionModel'

const palette = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: 'var(--cyan)',
  muted: 'var(--text-muted)',
  primary: 'var(--text-primary)',
  bgCard: 'var(--bg-card)',
  border: 'var(--border)',
  elevated: 'var(--bg-elevated)',
}

function StatRow({ icon: Icon, label, value, color }: { icon: React.FC<any>; label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
      <Icon size={14} color={color ?? palette.muted} />
      <span style={{ fontSize: '11px', color: palette.muted, flex: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: color ?? palette.primary }}>{value}</span>
    </div>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? palette.green : pct >= 50 ? palette.amber : palette.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: palette.elevated, borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>{pct}%</span>
    </div>
  )
}

export function GasCostEstimator({ prediction }: { prediction: GasPrediction | null }) {
  const isHighCost = prediction ? prediction.predictedMinResourceFee > 500 : false
  const isVeryHighCost = prediction ? prediction.predictedMinResourceFee > 1000 : false

  const alertColor = isVeryHighCost ? palette.red : isHighCost ? palette.amber : palette.green

  return (
    <div style={{
      background: palette.bgCard,
      border: `1px solid ${alertColor}33`,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Fuel size={16} color={alertColor} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', color: palette.primary }}>
            Gas Cost Estimate
          </span>
        </div>
        {prediction && (
          <span style={{
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '10px',
            background: `${palette.cyan}22`,
            color: palette.cyan,
            fontFamily: 'var(--font-mono)',
          }}>
            v{prediction.modelVersion}
          </span>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {!prediction ? (
          <div style={{ fontSize: '12px', color: palette.muted, textAlign: 'center', padding: '12px' }}>
            Fill in contract details to see gas cost estimate
          </div>
        ) : (
          <>
            <div style={{
              textAlign: 'center',
              padding: '16px 0',
              borderBottom: '1px solid var(--border)',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                Estimated Resource Fee
              </div>
              <div style={{
                fontSize: '28px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: alertColor,
              }}>
                {prediction.predictedMinResourceFee.toLocaleString()}
                <span style={{ fontSize: '14px', color: palette.muted, fontWeight: 400 }}> stroops</span>
              </div>
              <div style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>
                CI: [{Math.round(prediction.confidenceInterval[0]).toLocaleString()} – {Math.round(prediction.confidenceInterval[1]).toLocaleString()}]
              </div>
            </div>

            <StatRow
              icon={Activity}
              label="Instructions"
              value={prediction.predictedInstructionCount.toLocaleString()}
            />
            <StatRow
              icon={TrendingUp}
              label="Total Fee (est.)"
              value={`${prediction.predictedTotalFee.toLocaleString()} stroops`}
            />

            <div style={{ margin: '8px 0', padding: '8px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Confidence
              </div>
              <ConfidenceBar value={prediction.confidence} />
            </div>

            <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', marginTop: '8px' }}>
              Accuracy: {Math.round(prediction.accuracy * 100)}%
            </div>

            {prediction.warning && (
              <div style={{
                marginTop: '10px',
                padding: '8px 10px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                fontSize: '11px',
                color: palette.amber,
              }}>
                <AlertTriangle size={12} style={{ marginTop: '1px', flexShrink: 0 }} />
                <span>{prediction.warning}</span>
              </div>
            )}

            <div style={{
              marginTop: '10px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
            }}>
              {Object.entries(prediction.featureBreakdown).map(([key, value]) => (
                <div key={key} style={{
                  padding: '6px 8px',
                  background: palette.elevated,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ color: palette.muted, textTransform: 'capitalize' }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.primary }}>
                    {Math.round(value).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default GasCostEstimator
