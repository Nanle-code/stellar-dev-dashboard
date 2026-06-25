import React, { useMemo, useState } from 'react'
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Zap,
  Activity,
  Users,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert,
  Clock,
} from 'lucide-react'
import { useStore } from '../../lib/store'
import {
  analyzeTransactionPatterns,
  trainMLModel,
  scoreTransaction,
  IsolationForest,
  extractFeatures,
} from '../../lib/transactionPatternAnalysis'
import type {
  DetectedPattern,
  PatternSeverity,
  HourlyBucket,
  PatternAnalysisResult,
  ScoreResult,
} from '../../lib/transactionPatternAnalysis'

// ---------------------------------------------------------------------------
// Helpers / sub-components
// ---------------------------------------------------------------------------

function severityColor(s: PatternSeverity): string {
  if (s === 'critical') return 'var(--red)'
  if (s === 'warning') return 'var(--amber)'
  return 'var(--cyan)'
}

function severityBg(s: PatternSeverity): string {
  if (s === 'critical') return 'rgba(239,68,68,0.08)'
  if (s === 'warning') return 'rgba(251,191,36,0.08)'
  return 'rgba(6,182,212,0.08)'
}

function severityIcon(s: PatternSeverity) {
  if (s === 'critical') return <ShieldAlert size={15} />
  if (s === 'warning') return <AlertTriangle size={15} />
  return <Info size={15} />
}

function confidenceBar(confidence: number, color: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          flex: 1,
          height: '3px',
          borderRadius: '2px',
          background: 'var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(confidence * 100)}%`,
            height: '100%',
            background: color,
            borderRadius: '2px',
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
        {Math.round(confidence * 100)}% conf.
      </span>
    </div>
  )
}

// ---- Pattern card ----
function PatternCard({ pattern }: { pattern: DetectedPattern }) {
  const [expanded, setExpanded] = useState(false)
  const color = severityColor(pattern.severity)

  return (
    <div
      style={{
        background: severityBg(pattern.severity),
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        transition: 'var(--transition)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <span style={{ color, flexShrink: 0 }}>{severityIcon(pattern.severity)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
              {pattern.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {pattern.affectedTxCount} transaction{pattern.affectedTxCount !== 1 ? 's' : ''} · {pattern.category}
            </div>
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {confidenceBar(pattern.confidence, color)}

      {expanded && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            {pattern.description}
          </p>
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>💡 Recommendation: </span>
            {pattern.recommendation}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Hourly heatmap bar ----
function HourlyChart({ data }: { data: HourlyBucket[] }) {
  const max = Math.max(...data.map((b) => b.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(24, 1fr)',
          gap: '2px',
          alignItems: 'flex-end',
          height: '60px',
        }}
      >
        {data.map((bucket) => {
          const h = Math.max(4, Math.round((bucket.count / max) * 60))
          const intense = bucket.count / max
          const hue = 190 + intense * 40
          return (
            <div
              key={bucket.hour}
              title={`${bucket.label}: ${bucket.count} tx`}
              style={{
                height: `${h}px`,
                borderRadius: '2px 2px 0 0',
                background: `hsl(${hue}, 80%, ${20 + intense * 40}%)`,
                transition: 'height 0.4s ease',
                cursor: 'default',
              }}
            />
          )
        })}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(24, 1fr)',
          gap: '2px',
        }}
      >
        {data.map((b) => (
          <div
            key={b.hour}
            style={{
              fontSize: '8px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              display: b.hour % 6 === 0 ? 'block' : 'none',
            }}
          >
            {b.hour === 0 ? '12AM' : b.hour === 12 ? '12PM' : `${b.hour % 12}`}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Anomaly gauge ----
function AnomalyGauge({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const arc = circumference * 0.75
  const offset = arc - (score / 100) * arc

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <svg width="100" height="80" viewBox="0 0 100 80">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--green)" />
            <stop offset="50%" stopColor="var(--amber)" />
            <stop offset="100%" stopColor="var(--red)" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx="50" cy="56" r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="7"
          strokeDasharray={`${arc} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135, 50, 56)"
        />
        {/* Value arc */}
        <circle
          cx="50" cy="56" r={radius}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="7"
          strokeDasharray={`${arc - offset} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135, 50, 56)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>
          {score}
        </text>
        <text x="50" y="68" textAnchor="middle" fontSize="8" fill="var(--text-muted)">
          / 100
        </text>
      </svg>
      <span style={{ fontSize: '12px', color, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

// ---- Stat pill ----
function StatPill({ label, value, accent = 'var(--cyan)' }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        {label}
      </span>
      <span style={{ fontSize: '18px', fontWeight: 700, color: accent, fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ color: 'var(--cyan)' }}>{icon}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: '16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--cyan-glow)',
          border: '1px solid var(--cyan-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Brain size={28} color="var(--cyan)" />
      </div>
      <div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
          No transaction data to analyse
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: 1.6 }}>
          Connect a Stellar account with transaction history to unlock AI-powered pattern detection, anomaly scoring, and actionable insights.
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading pulse skeleton
// ---------------------------------------------------------------------------
function Skeleton({ height = 80 }: { height?: number }) {
  return (
    <div
      className="skeleton-pulse"
      style={{
        height: `${height}px`,
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)',
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function TransactionPatternAnalysis() {
  const { transactions, operations, connectedAddress, txLoading, opsLoading } = useStore()

  const isLoading = txLoading || opsLoading

  // --- ML State ---
  const [mlStatus, setMlStatus] = useState<'idle' | 'loading' | 'training' | 'ready' | 'error'>('idle')
  const [trainMetrics, setTrainMetrics] = useState<{ accuracy: number; loss: number } | null>(null)
  const [scoredTxs, setScoredTxs] = useState<Record<string, ScoreResult>>({})
  const [feedback, setFeedback] = useState<Record<string, 'confirm' | 'deny'>>(() => {
    try {
      const saved = localStorage.getItem('stellar:ai-tx-feedback')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const result: PatternAnalysisResult | null = useMemo(() => {
    if (!transactions.length && !operations.length) return null
    return analyzeTransactionPatterns(
      transactions as Parameters<typeof analyzeTransactionPatterns>[0],
      operations as Parameters<typeof analyzeTransactionPatterns>[1],
      connectedAddress || ''
    )
  }, [transactions, operations, connectedAddress])

  // --- ML scoring and training trigger ---
  const runScoringAndTraining = React.useCallback(async (currentFeedback = feedback) => {
    if (!transactions.length) return
    setMlStatus(mlStatus === 'idle' ? 'loading' : 'training')
    try {
      // 1. Train the TF.js Model
      const metrics = await trainMLModel(transactions as any, operations as any, currentFeedback)
      setTrainMetrics(metrics)

      // 2. Fit Isolation Forest
      const forest = new IsolationForest()
      const { features } = extractFeatures(transactions as any, operations as any)
      if (features.length > 0) {
        forest.fit(features)
      }

      // 3. Score all transactions in parallel
      const scored: Record<string, ScoreResult> = {}
      for (const tx of transactions) {
        const txOps = operations.filter((o) => o.transaction_hash === tx.hash)
        const scoreRes = await scoreTransaction(
          tx as any,
          txOps as any,
          transactions as any,
          operations as any,
          forest
        )
        scored[tx.id] = scoreRes
      }

      setScoredTxs(scored)
      setMlStatus('ready')
    } catch (err) {
      console.error('Error running AI scoring pipeline:', err)
      setMlStatus('error')
    }
  }, [transactions, operations, feedback, mlStatus])

  // Initial trigger
  React.useEffect(() => {
    if (transactions.length > 0 && mlStatus === 'idle') {
      runScoringAndTraining()
    }
  }, [transactions, mlStatus, runScoringAndTraining])

  // --- Feedback loop handler ---
  const handleFeedback = async (txId: string, type: 'confirm' | 'deny') => {
    const updatedFeedback = { ...feedback, [txId]: type }
    setFeedback(updatedFeedback)
    try {
      localStorage.setItem('stellar:ai-tx-feedback', JSON.stringify(updatedFeedback))
    } catch (e) {
      console.warn(e)
    }
    // Retrain and score
    await runScoringAndTraining(updatedFeedback)
  }

  const clearFeedback = async (txId: string) => {
    const updatedFeedback = { ...feedback }
    delete updatedFeedback[txId]
    setFeedback(updatedFeedback)
    try {
      localStorage.setItem('stellar:ai-tx-feedback', JSON.stringify(updatedFeedback))
    } catch (e) {
      console.warn(e)
    }
    await runScoringAndTraining(updatedFeedback)
  }

  const criticalCount = result?.patterns.filter((p) => p.severity === 'critical').length ?? 0
  const warningCount = result?.patterns.filter((p) => p.severity === 'warning').length ?? 0

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain size={22} color="var(--cyan)" />
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              AI Transaction Pattern Analysis
            </h1>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 32px' }}>
            AI-powered pattern recognition, anomaly scoring, and model retraining running in-browser
          </p>
        </div>

        {result && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {criticalCount > 0 && (
              <span
                style={{
                  padding: '4px 10px',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '999px',
                  fontSize: '11px',
                  color: 'var(--red)',
                  fontWeight: 600,
                }}
              >
                {criticalCount} Critical
              </span>
            )}
            {warningCount > 0 && (
              <span
                style={{
                  padding: '4px 10px',
                  background: 'rgba(251,191,36,0.12)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  borderRadius: '999px',
                  fontSize: '11px',
                  color: 'var(--amber)',
                  fontWeight: 600,
                }}
              >
                {warningCount} Warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>
              {result.analyzedAt.slice(0, 10)}
            </span>
          </div>
        )}
      </div>

      {/* ML Infrastructure Panel */}
      <Section title="AI / ML Infrastructure Status" icon={<Zap size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Model Status
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background:
                    mlStatus === 'ready' ? 'var(--green)' :
                    mlStatus === 'training' || mlStatus === 'loading' ? 'var(--amber)' :
                    mlStatus === 'error' ? 'var(--red)' : 'var(--text-muted)',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                TensorFlow.js {mlStatus === 'ready' ? 'Active' : mlStatus}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Weights Cached: Browser IndexedDB
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Bootstrap Accuracy / Loss
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {trainMetrics ? `${Math.round(trainMetrics.accuracy * 100)}% / ${trainMetrics.loss.toFixed(4)}` : 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Input features: 6 dimensions scaled
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button
              onClick={() => runScoringAndTraining()}
              disabled={mlStatus === 'training' || mlStatus === 'loading' || !transactions.length}
              style={{
                padding: '8px 16px',
                background: 'var(--cyan-glow)',
                border: '1px solid var(--cyan-dim)',
                color: 'var(--cyan)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: transactions.length ? 'pointer' : 'not-allowed',
                opacity: transactions.length ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
            >
              {mlStatus === 'training' ? 'Retraining...' : 'Retrain AI Model'}
            </button>
          </div>
        </div>
      </Section>

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Skeleton height={100} />
          <Skeleton height={200} />
          <Skeleton height={160} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !result && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <EmptyState />
        </div>
      )}

      {/* Results */}
      {!isLoading && result && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            <StatPill label="Transactions" value={result.txCount} />
            <StatPill label="Operations" value={result.opCount} accent="var(--amber)" />
            <StatPill label="Patterns Found" value={result.patterns.length} accent={criticalCount > 0 ? 'var(--red)' : 'var(--cyan)'} />
            <StatPill label="Median Fee" value={`${result.feeIntelligence.medianFee} str`} accent="var(--green)" />
            <StatPill label="Anomaly Score" value={`${result.anomalyScore.score}/100`} accent={result.anomalyScore.color} />
          </div>

          {/* AI Insights */}
          <Section title="AI Insights" icon={<Brain size={16} />}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.insights.map((insight, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    padding: '8px 10px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: '1px' }}>◈</span>
                  {insight}
                </li>
              ))}
            </ul>
          </Section>

          {/* Anomaly + Activity split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
            {/* Anomaly gauge */}
            <Section title="Anomaly Score" icon={<ShieldAlert size={16} />}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <AnomalyGauge
                  score={result.anomalyScore.score}
                  label={result.anomalyScore.label}
                  color={result.anomalyScore.color}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                  Composite score from failure rate, fee spikes, timing bursts, counterparty diversity, and operation variety.
                </p>
              </div>
            </Section>

            {/* Hourly heatmap */}
            <Section title="Hourly Activity Heatmap (UTC)" icon={<Clock size={16} />}>
              <HourlyChart data={result.hourlyActivity} />
              {result.peakActivity && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Peak: <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{result.peakActivity.label}</span> UTC with{' '}
                  <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{result.peakActivity.count}</span> transactions
                  ({result.peakActivity.percentage}% of total)
                </div>
              )}
            </Section>
          </div>

          {/* Real-time Scoring Alerts & Feedback Loop Table */}
          <Section title="Real-Time ML Anomaly Scoring & Feedback Loop" icon={<ShieldAlert size={16} />}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px' }}>Transaction ID</th>
                    <th style={{ padding: '8px 10px' }}>Time</th>
                    <th style={{ padding: '8px 10px' }}>ML Pattern</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Anomaly Score</th>
                    <th style={{ padding: '8px 10px' }}>Confidence</th>
                    <th style={{ padding: '8px 10px' }}>Latency</th>
                    <th style={{ padding: '8px 10px', width: '220px' }}>User Feedback Loop</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 10).map((tx) => {
                    const score = scoredTxs[tx.id]
                    const hasFeedback = feedback[tx.id]
                    const date = new Date(tx.created_at)
                    const timeString = isNaN(date.getTime()) ? '—' : date.toLocaleTimeString()

                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', ':hover': { background: 'var(--bg-elevated)' } } as any}>
                        <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
                          <span title={tx.hash}>{tx.hash.slice(0, 10)}…{tx.hash.slice(-8)}</span>
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{timeString}</td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span
                              style={{
                                color: score && score.predictedClass !== 'Normal' ? 'var(--amber)' : 'var(--text-primary)',
                                fontWeight: score && score.predictedClass !== 'Normal' ? 600 : 400,
                              }}
                            >
                              {score ? score.predictedClass : 'Analyzing...'}
                            </span>
                            {score && score.explanations && (
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                {score.explanations.join('; ')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {score ? (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: score.anomalyScore > 60 ? 'rgba(239,68,68,0.12)' : score.anomalyScore > 30 ? 'rgba(251,191,36,0.12)' : 'rgba(16,185,129,0.12)',
                                color: score.anomalyScore > 60 ? 'var(--red)' : score.anomalyScore > 30 ? 'var(--amber)' : 'var(--green)',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {score.anomalyScore}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'var(--font-mono)' }}>
                          {score ? `${Math.round(score.confidence * 100)}%` : '—'}
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {score ? `${score.latencyMs.toFixed(1)}ms` : '—'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {!hasFeedback ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => handleFeedback(tx.id, 'confirm')}
                                style={{
                                  padding: '4px 8px',
                                  background: 'rgba(239,68,68,0.1)',
                                  border: '1px solid rgba(239,68,68,0.2)',
                                  color: 'var(--red)',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Confirm Alert
                              </button>
                              <button
                                onClick={() => handleFeedback(tx.id, 'deny')}
                                style={{
                                  padding: '4px 8px',
                                  background: 'rgba(16,185,129,0.1)',
                                  border: '1px solid rgba(16,185,129,0.2)',
                                  color: 'var(--green)',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Deny Alert
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: hasFeedback === 'confirm' ? 'var(--red)' : 'var(--green)',
                                }}
                              >
                                {hasFeedback === 'confirm' ? 'Confirmed anomaly' : 'Flagged normal'}
                              </span>
                              <button
                                onClick={() => clearFeedback(tx.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  fontSize: '10px',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                Reset
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No transactions found to score.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Detected Patterns */}
          <Section
            title={`Detected Patterns (${result.patterns.length})`}
            icon={<TrendingUp size={16} />}
          >
            {result.patterns.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                ✓ No notable patterns detected — activity looks healthy.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {result.patterns.map((p) => (
                  <PatternCard key={p.id} pattern={p} />
                ))}
              </div>
            )}
          </Section>

          {/* Cluster + Op Mix split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Transaction clusters */}
            <Section title="Transaction Clusters" icon={<BarChart2 size={16} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {result.clusters.map((cluster) => (
                  <div key={cluster.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{cluster.label}</span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {cluster.count} · {cluster.percentage}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        borderRadius: '3px',
                        background: 'var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${cluster.percentage}%`,
                          height: '100%',
                          background: cluster.label === 'Failed' ? 'var(--red)' : 'var(--cyan)',
                          borderRadius: '3px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      avg fee {cluster.avgFee} str · success rate {cluster.successRate}%
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Operation mix */}
            <Section title="Operation Type Mix" icon={<Activity size={16} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {result.operationMix.slice(0, 8).map((op) => (
                  <div key={op.type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span
                        style={{
                          color: 'var(--cyan)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          background: 'var(--bg-elevated)',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {op.type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {op.count} · {op.percentage}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: '4px',
                        borderRadius: '2px',
                        background: 'var(--border)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${op.percentage}%`,
                          height: '100%',
                          background: 'var(--amber)',
                          borderRadius: '2px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
                {result.operationMix.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No operations available.</div>
                )}
              </div>
            </Section>
          </div>

          {/* Fee Intelligence */}
          <Section title="Fee Intelligence" icon={<Zap size={16} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                  {result.feeIntelligence.medianFee}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Median (stroops)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
                  {result.feeIntelligence.avgFee}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average (stroops)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                  {result.feeIntelligence.p90Fee}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>P90 (stroops)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: result.feeIntelligence.overpayingPct > 30 ? 'var(--red)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {result.feeIntelligence.overpayingPct}%
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overpaying</div>
              </div>
            </div>
            <div
              style={{
                padding: '10px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>💡 </span>
              {result.feeIntelligence.recommendation}
              {result.feeIntelligence.savingsEstimate > 0 && (
                <span style={{ color: 'var(--green)' }}>
                  {' '}Estimated savings: ~{result.feeIntelligence.savingsEstimate.toLocaleString()} stroops.
                </span>
              )}
            </div>
          </Section>

          {/* Top Counterparties */}
          {result.topCounterparties.length > 0 && (
            <Section title="Top Counterparties" icon={<Users size={16} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {result.topCounterparties.map((cp) => (
                  <div
                    key={cp.address}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--cyan)',
                          fontFamily: 'var(--font-mono)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cp.address.slice(0, 12)}…{cp.address.slice(-8)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {cp.txCount} tx · since {cp.firstSeen}
                        {cp.assetCodes.length > 0 && ` · ${cp.assetCodes.join(', ')}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Score
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: cp.relationshipScore > 50 ? 'var(--green)' : 'var(--amber)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {cp.relationshipScore}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.25; }
        }
        .skeleton-pulse { animation: skeleton-pulse 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
