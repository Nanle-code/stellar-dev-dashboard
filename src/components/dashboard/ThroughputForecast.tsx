import React, { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { useThroughputForecast } from '../../hooks/useThroughputForecast'
import { useStore } from '../../lib/store'

const HORIZON_OPTIONS = [
  { label: '1h', periods: 20 },
  { label: '6h', periods: 60 },
  { label: '24h', periods: 120 },
]

const STYLE: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: '4px 0 0 0',
  },
  controls: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  controlBtn: (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
    background: active ? 'var(--cyan)' : 'transparent',
    color: active ? '#fff' : 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  }),
  cardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  card: {
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
  },
  cardLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  cardValue: (color?: string): React.CSSProperties => ({
    fontSize: '28px',
    fontWeight: 700,
    color: color || 'var(--text-primary)',
  }),
  cardSubtext: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  chartContainer: {
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '16px',
  },
  loadingBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '300px',
    color: 'var(--text-secondary)',
  },
  errorBox: {
    padding: '16px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    textAlign: 'center' as const,
  },
  statusDot: (color: string): React.CSSProperties => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
    marginRight: '6px',
  }),
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getStatusColor(direction: string): string {
  switch (direction) {
    case 'increasing': return 'var(--amber)'
    case 'decreasing': return 'var(--cyan)'
    default: return 'var(--green)'
  }
}

function getUtilizationColor(utilization: number): string {
  if (utilization > 0.8) return '#ef4444'
  if (utilization > 0.5) return 'var(--amber)'
  return 'var(--green)'
}

export default function ThroughputForecast() {
  const { network } = useStore()
  const [horizon, setHorizon] = useState(20)

  const { forecast, capacityForecast, loading, error, dataPointsCount, lastUpdated } = useThroughputForecast(
    network,
    100,
    horizon,
    30000
  )

  const chartData = forecast?.predictions.map(p => ({
    time: formatTimestamp(p.timestamp),
    tps: parseFloat(p.predictedTps.toFixed(2)),
    upper: parseFloat(p.upperBound.toFixed(2)),
    lower: parseFloat(p.lowerBound.toFixed(2)),
    ops: parseFloat(p.predictedOps.toFixed(2)),
    utilization: parseFloat((p.congestionUtilization * 100).toFixed(1)),
  })) || []

  const currentTps = forecast?.currentLevel ?? 0
  const trendDirection = forecast?.trendDirection ?? 'unknown'
  const trendColor = getStatusColor(trendDirection)
  const utilizationColor = getUtilizationColor(capacityForecast?.currentUtilization ?? 0)

  return (
    <div style={STYLE.container}>
      <div style={STYLE.header}>
        <div>
          <h2 style={STYLE.title}>Throughput Forecast</h2>
          <p style={STYLE.subtitle}>
            AI-powered prediction of Stellar network transaction throughput
          </p>
        </div>
        <div style={STYLE.controls}>
          {HORIZON_OPTIONS.map(opt => (
            <button
              key={opt.label}
              style={STYLE.controlBtn(horizon === opt.periods)}
              onClick={() => setHorizon(opt.periods)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={STYLE.errorBox}>{error}</div>
      )}

      <div style={STYLE.cardsRow}>
        <div style={STYLE.card}>
          <div style={STYLE.cardLabel}>Current TPS</div>
          <div style={STYLE.cardValue()}>{currentTps.toFixed(1)}</div>
          <div style={STYLE.cardSubtext}>Transactions per second</div>
        </div>
        <div style={STYLE.card}>
          <div style={STYLE.cardLabel}>Trend</div>
          <div style={STYLE.cardValue(trendColor)}>
            <span style={STYLE.statusDot(trendColor)} />
            {trendDirection === 'increasing' ? '↑' : trendDirection === 'decreasing' ? '↓' : '→'}
          </div>
          <div style={STYLE.cardSubtext}>
            {forecast ? `${(forecast.currentTrend * 5).toFixed(2)} ops/ledgers` : '—'}
          </div>
        </div>
        <div style={STYLE.card}>
          <div style={STYLE.cardLabel}>Capacity Utilization</div>
          <div style={STYLE.cardValue(utilizationColor)}>
            {capacityForecast ? `${(capacityForecast.currentUtilization * 100).toFixed(1)}%` : '—'}
          </div>
          <div style={STYLE.cardSubtext}>
            {capacityForecast?.scalingScenario ?? '—'}
          </div>
        </div>
        <div style={STYLE.card}>
          <div style={STYLE.cardLabel}>Data Points</div>
          <div style={STYLE.cardValue()}>{dataPointsCount}</div>
          <div style={STYLE.cardSubtext}>
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : '—'}
          </div>
        </div>
      </div>

      {loading && (
        <div style={STYLE.loadingBox}>Loading forecast data...</div>
      )}

      {!loading && chartData.length > 0 && (
        <>
          <div style={STYLE.chartContainer}>
            <div style={STYLE.chartTitle}>TPS Forecast (Transactions/Second)</div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="transparent"
                  fill="url(#confidenceGradient)"
                  name="Upper Bound"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="transparent"
                  fill="var(--bg-card)"
                  name="Lower Bound"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="tps"
                  stroke="var(--cyan)"
                  fill="url(#tpsGradient)"
                  strokeWidth={2}
                  name="Predicted TPS"
                  dot={false}
                />
                <ReferenceLine
                  y={currentTps}
                  stroke="var(--amber)"
                  strokeDasharray="5 5"
                  label={{ value: 'Current', position: 'right', fill: 'var(--amber)', fontSize: 11 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={STYLE.chartContainer}>
            <div style={STYLE.chartTitle}>Capacity Utilization (%)</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="utilGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--amber)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--amber)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Utilization']}
                />
                <Area
                  type="monotone"
                  dataKey="utilization"
                  stroke="var(--amber)"
                  fill="url(#utilGradient)"
                  strokeWidth={2}
                  name="Utilization %"
                  dot={false}
                />
                <ReferenceLine
                  y={80}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{ value: '80% Cap', position: 'right', fill: '#ef4444', fontSize: 11 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {!loading && chartData.length === 0 && !error && (
        <div style={STYLE.loadingBox}>
          Insufficient data for forecast. Awaiting ledger history...
        </div>
      )}
    </div>
  )
}
