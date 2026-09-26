/**
 * CapacityPredictionPanel.tsx
 * AI-powered capacity prediction dashboard panel.
 *
 * Sections:
 *   1. Header + summary banner
 *   2. Time-series forecast chart (AreaChart)
 *   3. Scenario analysis (multi-line chart + table)
 *   4. Feature adoption (bar chart + table)
 *   5. Infrastructure recommendations list
 *   6. Capacity planning report (insights + metadata)
 */

import React, { useState } from 'react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  ShieldAlert,
  RefreshCw,
  Cpu,
  BarChart2,
  Zap,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useCapacityPrediction, type ForecastWindow } from '../../hooks/useCapacityPrediction'
import { CAPACITY_LIMIT_OPS, FORECAST_WINDOWS } from '../../lib/capacityPrediction'
import type {
  ScenarioProjection,
  InfraRecommendation,
  FeatureAdoptionMetric,
} from '../../lib/capacityPrediction'
import { formatCompactNumber, formatDateAxis, CHART_COLORS } from '../../lib/chartUtils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityColor(p: InfraRecommendation['priority']): string {
  if (p === 'critical') return 'var(--red)'
  if (p === 'high') return 'var(--amber)'
  if (p === 'medium') return 'var(--cyan)'
  return 'var(--text-muted)'
}

function priorityBg(p: InfraRecommendation['priority']): string {
  if (p === 'critical') return 'rgba(239,68,68,0.08)'
  if (p === 'high') return 'rgba(251,191,36,0.08)'
  if (p === 'medium') return 'rgba(6,182,212,0.08)'
  return 'rgba(255,255,255,0.03)'
}

function priorityIcon(p: InfraRecommendation['priority']) {
  if (p === 'critical') return <ShieldAlert size={14} />
  if (p === 'high') return <AlertTriangle size={14} />
  if (p === 'medium') return <Info size={14} />
  return <CheckCircle size={14} />
}

function utilisationColor(u: number): string {
  if (u >= 0.8) return 'var(--red)'
  if (u >= 0.6) return 'var(--amber)'
  return 'var(--green)'
}

function trendIcon(trend: 'increasing' | 'stable' | 'decreasing') {
  if (trend === 'increasing') return <TrendingUp size={14} style={{ color: 'var(--amber)' }} />
  if (trend === 'decreasing') return <TrendingDown size={14} style={{ color: 'var(--cyan)' }} />
  return <Activity size={14} style={{ color: 'var(--green)' }} />
}

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px',
}

const SECTION_TITLE_STYLE: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-display)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '16px',
}

const tooltipStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '11px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  padding: '8px 12px',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UsageBar({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div
      style={{
        height: '6px',
        borderRadius: '3px',
        background: 'var(--border)',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: '3px',
          transition: 'width 0.5s ease',
        }}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color = 'var(--cyan)',
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon: React.ReactNode
  color?: string
}) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: '1 1 160px',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color, marginBottom: '2px' }}>
        {icon}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Forecast chart section
// ---------------------------------------------------------------------------

function ForecastChart({
  predictions,
  capacityLimit,
}: {
  predictions: Array<{ timestamp: string; predictedOps: number; lowerBound: number; upperBound: number }>
  capacityLimit: number
}) {
  const data = predictions.map((p) => ({
    date: formatDateAxis(p.timestamp),
    predicted: p.predictedOps,
    lower: p.lowerBound,
    upper: p.upperBound,
  }))

  if (!data.length) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
        No forecast data — accumulate more ledger history
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="capPredGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.cyan} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.cyan} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="capCIGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.cyanDim} stopOpacity={0.12} />
            <stop offset="95%" stopColor={CHART_COLORS.cyanDim} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          tickFormatter={formatCompactNumber}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [formatCompactNumber(v), '']}
        />
        <ReferenceLine
          y={capacityLimit}
          stroke="var(--red)"
          strokeDasharray="4 3"
          label={{ value: 'Limit', fill: 'var(--red)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
        />
        <Area
          dataKey="upper"
          stroke="transparent"
          fill="url(#capCIGrad)"
          name="Upper bound"
          legendType="none"
        />
        <Area
          dataKey="lower"
          stroke="transparent"
          fill="var(--bg-card)"
          name="Lower bound"
          legendType="none"
        />
        <Area
          dataKey="predicted"
          stroke={CHART_COLORS.cyan}
          strokeWidth={2}
          fill="url(#capPredGrad)"
          name="Predicted ops"
          dot={false}
          activeDot={{ r: 4, fill: CHART_COLORS.cyan }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Scenario chart section
// ---------------------------------------------------------------------------

function ScenarioChart({
  scenarios,
  capacityLimit,
}: {
  scenarios: ScenarioProjection[]
  capacityLimit: number
}) {
  // Build one unified data array keyed by day index so all scenarios align
  const maxLen = Math.max(...scenarios.map((s) => s.points.length), 0)
  const data: Array<Record<string, number | string>> = []

  for (let i = 0; i < maxLen; i++) {
    const row: Record<string, number | string> = {
      date: formatDateAxis(scenarios[0]?.points[i]?.timestamp ?? ''),
    }
    for (const s of scenarios) {
      row[s.scenario] = s.points[i]?.predictedOps ?? 0
    }
    data.push(row)
  }

  if (!data.length) {
    return (
      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
        No scenario data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          tickFormatter={formatCompactNumber}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [formatCompactNumber(v), '']}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
        />
        <ReferenceLine
          y={capacityLimit}
          stroke="var(--red)"
          strokeDasharray="4 3"
          label={{ value: 'Limit', fill: 'var(--red)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
        />
        {scenarios.map((s) => (
          <Line
            key={s.scenario}
            dataKey={s.scenario}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            name={s.label}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Feature adoption chart
// ---------------------------------------------------------------------------

function FeatureAdoptionChart({ metrics }: { metrics: FeatureAdoptionMetric[] }) {
  const data = metrics.map((m) => ({
    name: m.feature.split(' ')[0], // truncate for axis
    current: Math.round(m.usageRate * 100),
    projected: Math.round(m.projectedUsageIn30Days * 100),
  }))

  if (!data.length) return null

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
          tickFormatter={(v) => `${v}%`}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [`${v}%`, '']}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
        />
        <Bar dataKey="current" name="Current %" fill={CHART_COLORS.cyan} radius={[3, 3, 0, 0]} />
        <Bar dataKey="projected" name="Projected 30d %" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Recommendation card
// ---------------------------------------------------------------------------

function RecommendationCard({ rec }: { rec: InfraRecommendation }) {
  const [expanded, setExpanded] = useState(false)
  const color = priorityColor(rec.priority)
  const bg = priorityBg(rec.priority)

  return (
    <div
      style={{
        border: `1px solid ${color}44`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        background: bg,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          textAlign: 'left',
        }}
        aria-expanded={expanded}
      >
        <span style={{ color, marginTop: '1px', flexShrink: 0 }}>{priorityIcon(rec.priority)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {rec.title}
            </span>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color,
                background: `${color}22`,
                border: `1px solid ${color}55`,
                borderRadius: '3px',
                padding: '1px 5px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                flexShrink: 0,
              }}
            >
              {rec.priority}
            </span>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '1px 5px',
                flexShrink: 0,
              }}
            >
              {rec.category}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
            {rec.description}
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '10px', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Timeframe</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{rec.timeframe}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Estimated Impact</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{rec.estimatedImpact}</div>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Action Items</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {rec.actionItems.map((item, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color, marginTop: '2px', flexShrink: 0 }}>›</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CapacityPredictionPanel() {
  const { result, loading, error, horizonDays, setHorizonDays, refresh, dataPoints } =
    useCapacityPrediction()

  const report = result?.report ?? null

  const utilisationPct = report ? Math.round(report.currentUtilisation * 100) : 0
  const utilisationCol = report ? utilisationColor(report.currentUtilisation) : 'var(--text-muted)'

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Capacity Planning
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            AI-powered resource prediction · {dataPoints} data point{dataPoints !== 1 ? 's' : ''} analysed
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Horizon selector */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {(FORECAST_WINDOWS as readonly ForecastWindow[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setHorizonDays(d)}
                aria-pressed={horizonDays === d}
                style={{
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  background: horizonDays === d ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                  border: `1px solid ${horizonDays === d ? 'var(--cyan-dim)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: horizonDays === d ? 'var(--cyan)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh capacity prediction"
            title="Refresh prediction"
            style={{
              padding: '6px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              transition: 'var(--transition)',
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
            {loading ? 'Running…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--red)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* ── Summary banner ── */}
      {report && (
        <div
          style={{
            ...CARD_STYLE,
            borderLeft: `3px solid ${utilisationCol}`,
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {trendIcon(report.utilizationTrend)}
                {report.summary}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Data quality: <span style={{ color: report.dataQuality === 'good' ? 'var(--green)' : report.dataQuality === 'fair' ? 'var(--amber)' : 'var(--red)' }}>{report.dataQuality}</span>
                {' · '}
                Model accuracy: <span style={{ color: 'var(--cyan)' }}>{Math.round(report.modelAccuracy * 100)}%</span>
                {' · '}
                Generated: <span style={{ fontFamily: 'var(--font-mono)' }}>{new Date(report.generatedAt).toLocaleTimeString()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: utilisationCol, fontFamily: 'var(--font-display)' }}>
                {utilisationPct}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>utilisation</div>
            </div>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UsageBar value={report.currentUtilisation} color={utilisationCol} />
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              / {CAPACITY_LIMIT_OPS} ops
            </span>
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      {result && report && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <StatCard
            label="Baseline Ops"
            value={formatCompactNumber(result.baselineOps)}
            sub="10-ledger rolling avg"
            icon={<Activity size={13} />}
          />
          <StatCard
            label="Trend Slope"
            value={`${result.trendSlope > 0 ? '+' : ''}${result.trendSlope.toFixed(1)}`}
            sub="ops / day"
            icon={<TrendingUp size={13} />}
            color={result.trendSlope > 0 ? 'var(--amber)' : 'var(--cyan)'}
          />
          <StatCard
            label="Anomalies"
            value={result.anomaliesDetected}
            sub="in observed data"
            icon={<Zap size={13} />}
            color={result.anomaliesDetected >= 3 ? 'var(--amber)' : 'var(--green)'}
          />
          <StatCard
            label="Seasonality"
            value={result.seasonalityDetected ? 'Yes' : 'No'}
            sub="weekly pattern"
            icon={<BarChart2 size={13} />}
            color={result.seasonalityDetected ? 'var(--cyan)' : 'var(--text-muted)'}
          />
        </div>
      )}

      {/* ── Forecast chart ── */}
      {report && (
        <div style={CARD_STYLE}>
          <div style={SECTION_TITLE_STYLE}>
            <Activity size={15} style={{ color: 'var(--cyan)' }} />
            {horizonDays}-Day Operations Forecast
            {result && (
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
                {report.predictions.length} predicted points
              </span>
            )}
          </div>
          <ForecastChart predictions={report.predictions} capacityLimit={CAPACITY_LIMIT_OPS} />
          <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
            Shaded area = 80% confidence interval. Red dashed line = ledger operation limit ({CAPACITY_LIMIT_OPS} ops).
          </div>
        </div>
      )}

      {/* ── Scenario analysis ── */}
      {report && report.scenarios.length > 0 && (
        <div style={CARD_STYLE}>
          <div style={SECTION_TITLE_STYLE}>
            <TrendingUp size={15} style={{ color: 'var(--amber)' }} />
            Growth Scenario Analysis
          </div>
          <ScenarioChart scenarios={report.scenarios} capacityLimit={CAPACITY_LIMIT_OPS} />

          {/* Scenario summary table */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.scenarios.map((s) => (
              <div
                key={s.scenario}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${s.color}`,
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: s.color, minWidth: '110px' }}>
                  {s.label}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, minWidth: '140px' }}>
                  Peak: <strong style={{ color: 'var(--text-primary)' }}>{formatCompactNumber(s.projectedPeakOps)}</strong> ops
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '160px' }}>
                  {s.daysToCapacityLimit !== null
                    ? <span style={{ color: s.color }}>⚠ Hits limit in <strong>{s.daysToCapacityLimit}d</strong></span>
                    : <span style={{ color: 'var(--green)' }}>✓ Within limit for {horizonDays}d</span>
                  }
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(s.annualGrowthRate * 100)}%/yr
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Feature adoption ── */}
      {report && report.featureAdoption.length > 0 && (
        <div style={CARD_STYLE}>
          <div style={SECTION_TITLE_STYLE}>
            <Cpu size={15} style={{ color: 'var(--cyan)' }} />
            Feature Adoption Trends
          </div>
          <FeatureAdoptionChart metrics={report.featureAdoption} />
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.featureAdoption.map((m) => (
              <div key={m.feature} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '180px' }}>{m.feature}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '120px' }}>
                  <UsageBar value={m.usageRate} color="var(--cyan)" />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                    {Math.round(m.usageRate * 100)}%
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: m.growthRate > 0.05 ? 'var(--green)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {m.growthRate > 0 ? '+' : ''}{Math.round(m.growthRate * 100)}% growth
                </span>
                <span style={{ fontSize: '10px', color: 'var(--amber)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  → {Math.round(m.projectedUsageIn30Days * 100)}% in 30d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Infrastructure recommendations ── */}
      {report && report.recommendations.length > 0 && (
        <div style={CARD_STYLE}>
          <div style={SECTION_TITLE_STYLE}>
            <ShieldAlert size={15} style={{ color: 'var(--amber)' }} />
            Infrastructure Recommendations
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                fontWeight: 400,
              }}
            >
              {report.recommendations.filter((r) => r.priority === 'critical').length} critical
              {' · '}
              {report.recommendations.filter((r) => r.priority === 'high').length} high
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.recommendations.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* ── Planning report / insights ── */}
      {report && report.insights.length > 0 && (
        <div style={CARD_STYLE}>
          <div style={SECTION_TITLE_STYLE}>
            <FileText size={15} style={{ color: 'var(--cyan)' }} />
            Capacity Planning Report
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.insights.map((insight, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                <Info size={13} style={{ color: 'var(--cyan)', marginTop: '2px', flexShrink: 0 }} />
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !result && !error && (
        <div
          style={{
            ...CARD_STYLE,
            textAlign: 'center',
            padding: '48px 24px',
            color: 'var(--text-muted)',
          }}
        >
          <Activity size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>No data yet</div>
          <div style={{ fontSize: '12px', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
            Connect a Stellar account and enable real-time ledger streaming. The capacity
            engine needs at least 5 ledger data points to generate predictions.
          </div>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[200, 240, 180].map((h, i) => (
            <div
              key={i}
              style={{
                height: h,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
              }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}
    </div>
  )
}
