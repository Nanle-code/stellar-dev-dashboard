/**
 * NetworkFeeForecast.tsx
 * Issue #568: Network Fee Trend Analysis and Forecasting dashboard.
 */

import React, { useMemo, useState, useCallback } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  Activity,
  Clock,
  Target,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Zap,
} from 'lucide-react'
import { TOOLTIP_STYLE, AXIS_TICK_STYLE } from '../../lib/chartUtils'
import {
  analyzeNetworkFees,
  generateSyntheticFeeHistory,
  type FeeOptimizationRecommendation,
  type NetworkFeeAnalysisResult,
} from '../../lib/networkFeeForecasting'

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string
  value: string
  sub?: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function RecommendationCard({ rec }: { rec: FeeOptimizationRecommendation }) {
  const color =
    rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#eab308' : 'var(--cyan, #06b6d4)'
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${color}44`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
        <strong style={{ fontSize: '13px' }}>{rec.title}</strong>
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            padding: '2px 6px',
            borderRadius: '4px',
            background: `${color}22`,
            color,
            fontWeight: 700,
          }}
        >
          {rec.priority}
        </span>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {rec.detail}
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: '#22c55e' }}>{rec.suggestedFeeStroops} stroops ({rec.suggestedFeeXlm} XLM)</span>
        <span style={{ color: 'var(--text-muted)' }}>{rec.timingHint}</span>
      </div>
    </div>
  )
}

function HeatCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0
  const bg = `rgba(6, 182, 212, ${0.08 + intensity * 0.75})`
  return (
    <div
      title={`${value}`}
      style={{
        height: '18px',
        borderRadius: '3px',
        background: bg,
        border: '1px solid var(--border)',
      }}
    />
  )
}

function runAnalysis(): NetworkFeeAnalysisResult {
  // Demo uses synthetic multi-day history; live ledgers can be passed when available.
  const history = generateSyntheticFeeHistory({ hours: 72, baseFee: 100 })
  const last = history[history.length - 1]
  return analyzeNetworkFees({
    history,
    feeStats: {
      last_ledger_base_fee: last.baseFee,
      median_accepted_fee: last.medianFee ?? last.baseFee,
      p90_accepted_fee: Math.round((last.medianFee ?? last.baseFee) * 1.4),
      min_accepted_fee: 100,
      ledger_capacity_usage: last.loadRatio,
    },
    horizonHours: 24,
  })
}

export default function NetworkFeeForecast() {
  const [result, setResult] = useState<NetworkFeeAnalysisResult>(() => runAnalysis())
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'forecast' | 'seasonality' | 'recommendations'>('forecast')

  const refresh = useCallback(() => {
    setBusy(true)
    window.setTimeout(() => {
      setResult(runAnalysis())
      setBusy(false)
    }, 600)
  }, [])

  const chartData = useMemo(() => {
    const histTail = result.history.slice(-48).map((p) => ({
      ts: p.timestamp,
      label: new Date(p.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' }),
      actual: p.baseFee,
      forecast: null as number | null,
      low: null as number | null,
      high: null as number | null,
      load: Math.round(p.loadRatio * 100),
    }))
    const lastActual = histTail[histTail.length - 1]
    const forecastRows = result.forecast.points.map((p, idx) => ({
      ts: p.timestamp,
      label: new Date(p.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' }),
      actual: idx === 0 ? lastActual?.actual ?? null : null,
      forecast: p.predictedFee,
      low: p.low,
      high: p.high,
      load: Math.round(p.predictedLoad * 100),
    }))
    return [...histTail.slice(0, -1), ...(lastActual ? [{ ...lastActual, forecast: lastActual.actual }] : []), ...forecastRows]
  }, [result])

  const maxHourly = Math.max(...result.seasonality.hourly.map((h) => h.avgFee), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Sparkles size={22} color="var(--cyan, #06b6d4)" />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, margin: 0 }}>
              Network Fee Forecast
            </h1>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              #568
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', maxWidth: '640px', lineHeight: 1.5 }}>
            Time-series fee trends, seasonal patterns, 24-hour forecasts, and actionable timing strategies for Stellar
            transactions.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--cyan, #06b6d4)',
            background: 'rgba(6,182,212,0.12)',
            color: 'var(--cyan, #06b6d4)',
            fontWeight: 700,
            fontSize: '12px',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          <RefreshCw size={14} />
          {busy ? 'Forecasting…' : 'Refresh Forecast'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <StatCard
          label="Current Base Fee"
          value={`${result.currentBaseFee}`}
          sub="stroops"
          color="var(--cyan, #06b6d4)"
          icon={<Zap size={16} />}
        />
        <StatCard
          label="24h Median Forecast"
          value={`${result.forecast.next24hMedian}`}
          sub={`${result.forecast.trend} · next hour ${result.forecast.nextHourFee}`}
          color="#22c55e"
          icon={<TrendingUp size={16} />}
        />
        <StatCard
          label="Network Load"
          value={result.load.level}
          sub={`${Math.round(result.load.currentLoad * 100)}% capacity`}
          color={result.load.color}
          icon={<Activity size={16} />}
        />
        <StatCard
          label="24h Accuracy"
          value={`${(result.accuracy.accuracy24h * 100).toFixed(1)}%`}
          sub={result.accuracy.meetsTarget ? 'Meets ≥85% target' : 'Below 85% target'}
          color={result.accuracy.meetsTarget ? '#22c55e' : '#eab308'}
          icon={result.accuracy.meetsTarget ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        />
        <StatCard
          label="Seasonality"
          value={result.seasonality.detected ? 'Detected' : 'Weak'}
          sub={`${(result.seasonality.confidence * 100).toFixed(0)}% confidence`}
          color="var(--amber, #eab308)"
          icon={<Clock size={16} />}
        />
      </div>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Target size={14} color="var(--cyan, #06b6d4)" />
          <strong style={{ fontSize: '13px' }}>AI Insights</strong>
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '6px' }}>
          {result.insights.map((insight) => (
            <li key={insight} style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {insight}
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          display: 'flex',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        {(
          [
            ['forecast', 'Forecast Chart'],
            ['seasonality', 'Seasonal Patterns'],
            ['recommendations', 'Optimizations'],
          ] as const
        ).map(([id, label], idx, arr) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              cursor: 'pointer',
              background: tab === id ? 'rgba(6,182,212,0.12)' : 'transparent',
              borderRight: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
              borderBottom: tab === id ? '2px solid var(--cyan, #06b6d4)' : '2px solid transparent',
              color: tab === id ? 'var(--cyan, #06b6d4)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'forecast' && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Historical fees (48h) + 24h forecast band
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="feeActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="feeForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={AXIS_TICK_STYLE} minTickGap={28} />
                <YAxis tick={AXIS_TICK_STYLE} width={48} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: 'var(--text-primary)' }}
                />
                <Legend />
                <ReferenceLine
                  x={chartData.find((d) => d.forecast != null && d.actual != null)?.label}
                  stroke="var(--amber, #eab308)"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="high"
                  stroke="transparent"
                  fill="#22c55e33"
                  name="Forecast high"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="low"
                  stroke="transparent"
                  fill="var(--bg-elevated)"
                  name="Forecast low"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#06b6d4"
                  fill="url(#feeActual)"
                  name="Actual fee"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="forecast"
                  stroke="#22c55e"
                  fill="url(#feeForecast)"
                  name="Forecast"
                  strokeDasharray="4 2"
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'seasonality' && (
        <div style={{ display: 'grid', gap: '14px' }}>
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Hour-of-day fee intensity (UTC)</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(24, 1fr)',
                gap: '3px',
              }}
            >
              {result.seasonality.hourly.map((h) => (
                <div key={h.hour} style={{ textAlign: 'center' }}>
                  <HeatCell value={h.avgFee} max={maxHourly} />
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '2px' }}>{h.hour}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Peak: {result.seasonality.peakHours.join(', ')}h · Trough: {result.seasonality.troughHours.join(', ')}h
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>Day-of-week averages</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
              {result.seasonality.daily.map((d) => (
                <div
                  key={d.day}
                  style={{
                    textAlign: 'center',
                    padding: '10px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: result.seasonality.peakDays.includes(d.day) ? 'rgba(249,115,22,0.1)' : 'var(--bg-canvas)',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px' }}>{d.avgFee}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>×{d.multiplier.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'recommendations' && (
        <div style={{ display: 'grid', gap: '10px' }}>
          {result.recommendations.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        Analyzed {new Date(result.analyzedAt).toLocaleString()} · {result.pointCount} hourly points · MAPE{' '}
        {(result.accuracy.mape * 100).toFixed(1)}% · tolerance hit-rate{' '}
        {(result.accuracy.withinToleranceRate * 100).toFixed(1)}%
      </div>
    </div>
  )
}
