import React, { useState, useEffect } from 'react'
import { TrendingUp, Target, BarChart3, Clock, CheckCircle, XCircle, Activity } from 'lucide-react'
import { getGasPredictionService } from '../../lib/gasPredictionService'
import { useGasPredictionStore } from '../../lib/gasPredictionStore'

const palette = {
  bgCard: 'var(--bg-card)',
  border: 'var(--border)',
  elevated: 'var(--bg-elevated)',
  primary: 'var(--text-primary)',
  muted: 'var(--text-muted)',
  cyan: 'var(--cyan)',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
}

interface MetricCardProps {
  icon: React.FC<any>
  label: string
  value: string
  color?: string
  subtitle?: string
}

function MetricCard({ icon: Icon, label, value, color, subtitle }: MetricCardProps) {
  return (
    <div style={{
      background: palette.elevated,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        <Icon size={13} color={color ?? palette.cyan} />
        {label}
      </div>
      <div style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: color ?? palette.primary }}>
        {value}
      </div>
      {subtitle && <div style={{ fontSize: '10px', color: palette.muted }}>{subtitle}</div>}
    </div>
  )
}

export function GasPredictionAccuracy() {
  const [metrics, setMetrics] = useState<any>(null)
  const accuracyHistory = useGasPredictionStore(s => s.accuracyHistory)

  useEffect(() => {
    const service = getGasPredictionService()
    setMetrics(service.getMetrics())

    const unsub = service.subscribe(() => {
      setMetrics(service.getMetrics())
    })

    const interval = setInterval(() => {
      setMetrics(service.getMetrics())
    }, 5000)

    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [])

  const accuracyPct = metrics ? Math.round(metrics.accuracy * 100) : 0
  const accuracyColor = accuracyPct >= 90 ? palette.green : accuracyPct >= 70 ? palette.amber : palette.red

  const within5pct = metrics?.historySize
    ? `${((metrics.historySize * accuracyPct) / 100 / Math.max(1, metrics.historySize) * 100).toFixed(1)}%`
    : '—'

  return (
    <div style={{
      background: palette.bgCard,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Target size={16} color={palette.cyan} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', color: palette.primary }}>
          Prediction Accuracy
        </span>
        {metrics && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: palette.muted,
            fontFamily: 'var(--font-mono)',
          }}>
            v{metrics.modelVersion}
          </span>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {!metrics ? (
          <div style={{ fontSize: '12px', color: palette.muted, textAlign: 'center', padding: '12px' }}>
            Loading accuracy metrics...
          </div>
        ) : (
          <>
            <div style={{
              textAlign: 'center',
              padding: '16px 0',
              marginBottom: '14px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                Overall Prediction Accuracy
              </div>
              <div style={{ fontSize: '36px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: accuracyColor }}>
                {accuracyPct}%
              </div>
              <div style={{ fontSize: '11px', color: palette.muted, marginTop: '4px' }}>
                {accuracyPct >= 90 ? '✓ Meets 90% target' : accuracyPct >= 70 ? 'Needs improvement' : 'Low accuracy — more training data needed'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              <MetricCard icon={BarChart3} label="Training Samples" value={metrics.trainingCount.toLocaleString()} color={palette.cyan} subtitle="Historical calls analyzed" />
              <MetricCard icon={CheckCircle} label="Within 5% Target" value={within5pct} color={palette.green} subtitle="Rolling accuracy" />
              <MetricCard icon={Activity} label="Thresholds Set" value={String(metrics.thresholdsConfigured)} color={palette.amber} subtitle="Active cost alerts" />
              <MetricCard icon={Clock} label="History Size" value={metrics.historySize.toLocaleString()} color={palette.muted} subtitle="Recorded predictions" />
            </div>

            {accuracyHistory.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Recent Accuracy Trend
                </div>
                <div style={{
                  background: palette.elevated,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '2px',
                  height: '60px',
                }}>
                  {accuracyHistory.slice(-30).map((entry, i) => {
                    const height = Math.max(4, entry.accuracy * 50)
                    const barColor = entry.accuracy >= 0.9 ? palette.green : entry.accuracy >= 0.7 ? palette.amber : palette.red
                    return (
                      <div
                        key={i}
                        title={`${(entry.accuracy * 100).toFixed(0)}%`}
                        style={{
                          flex: 1,
                          height: `${height}px`,
                          background: barColor,
                          borderRadius: '2px 2px 0 0',
                          opacity: 0.8 + (i / accuracyHistory.length) * 0.2,
                          transition: 'height 0.3s ease',
                          minWidth: '3px',
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default GasPredictionAccuracy
