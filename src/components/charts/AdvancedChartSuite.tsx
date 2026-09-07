import React, { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import { useResponsive } from '../../hooks/useResponsive'
import Card from '../dashboard/Card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  AXIS_TICK_STYLE,
  CHART_COLORS,
  TOOLTIP_STYLE,
  TIMEFRAME_OPTIONS,
  calculateEMA,
  calculateRSI,
  calculateSMA,
  exportChartDataAsCsv,
  filterSeriesByTimeframe,
  formatCompactNumber,
  formatDateAxis,
  formatTimeAxis,
  normalizeSeriesForComparison,
} from '../../lib/chartUtils'

const METRICS = [
  { id: 'balance', label: 'Account Balance', unit: 'XLM' },
  { id: 'volume', label: 'Transaction Volume', unit: 'tx' },
  { id: 'network', label: 'Network Operations', unit: 'ops' },
]

function buildBaseSeries({ accountData, transactions, operations }) {
  const points = 90
  const now = Date.now()
  const xlmBalance = parseFloat(
    (accountData?.balances || []).find((b) => b.asset_type === 'native')?.balance || '0'
  )

  const txByDay = new Map()
  for (const tx of transactions || []) {
    const day = new Date(tx.created_at)
    const key = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString()
    txByDay.set(key, (txByDay.get(key) || 0) + 1)
  }

  const opsByDay = new Map()
  for (const op of operations || []) {
    const day = new Date(op.created_at)
    const key = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString()
    opsByDay.set(key, (opsByDay.get(key) || 0) + 1)
  }

  return Array.from({ length: points }, (_, index) => {
    const ts = new Date(now - (points - index) * 24 * 60 * 60 * 1000)
    const dayKey = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()).toISOString()

    const seed = Math.sin(index / 7) * 6 + Math.cos(index / 11) * 4
    const balance = Math.max(0, xlmBalance + seed * 1.75 + index * 0.35)
    const volume = txByDay.get(dayKey) || Math.max(1, Math.round(Math.abs(seed) + 2 + (index % 5)))
    const network = opsByDay.get(dayKey) || Math.max(2, Math.round(Math.abs(seed) * 2 + 8 + (index % 7)))

    return {
      timestamp: ts.toISOString(),
      balance,
      volume,
      network,
      alphaCompare: balance * (0.9 + (Math.sin(index / 9) + 1) * 0.05),
      betaCompare: balance * (1.03 - (Math.cos(index / 13) + 1) * 0.03),
    }
  })
}

function ControlChip({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 10px',
        fontSize: '11px',
        borderRadius: '999px',
        border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
        background: active ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
        color: active ? 'var(--cyan)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export default function AdvancedChartSuite() {
  const { accountData, transactions, operations } = useStore()
  const { isMobile } = useResponsive()

  const [timeframe, setTimeframe] = useState('30d')
  const [metric, setMetric] = useState('balance')
  const [showSMA, setShowSMA] = useState(true)
  const [showEMA, setShowEMA] = useState(false)
  const [showRSI, setShowRSI] = useState(false)
  const [comparisonMode, setComparisonMode] = useState(false)

  const metricConfig = METRICS.find((item) => item.id === metric) || METRICS[0]

  const baseSeries = useMemo(
    () => buildBaseSeries({ accountData, transactions, operations }),
    [accountData, operations, transactions]
  )

  const filtered = useMemo(
    () => filterSeriesByTimeframe(baseSeries, timeframe),
    [baseSeries, timeframe]
  )

  const withIndicators = useMemo(() => {
    const primary = filtered.map((row) => ({ timestamp: row.timestamp, value: row[metric] }))
    const withSMA = calculateSMA(primary, 10, 'value', 'sma')
    const withEMA = calculateEMA(withSMA, 10, 'value', 'ema')
    return calculateRSI(withEMA, 14, 'value', 'rsi').map((row) => {
      const source = filtered.find((item) => item.timestamp === row.timestamp)
      return {
        ...source,
        ...row,
      }
    })
  }, [filtered, metric])

  const comparisonSeries = useMemo(() => {
    if (!comparisonMode) return []

    return normalizeSeriesForComparison([
      {
        id: 'Primary',
        data: filtered.map((row) => ({ timestamp: row.timestamp, value: row[metric] })),
      },
      {
        id: 'Alpha',
        data: filtered.map((row) => ({ timestamp: row.timestamp, value: row.alphaCompare })),
      },
      {
        id: 'Beta',
        data: filtered.map((row) => ({ timestamp: row.timestamp, value: row.betaCompare })),
      },
    ])
  }, [comparisonMode, filtered, metric])

  function exportPrimary() {
    exportChartDataAsCsv(
      withIndicators.map((row) => ({
        timestamp: row.timestamp,
        metric: row.value,
        sma: row.sma,
        ema: row.ema,
        rsi: row.rsi,
      })),
      `${metric}-time-series.csv`
    )
  }

  function exportComparison() {
    exportChartDataAsCsv(comparisonSeries, `${metric}-comparison.csv`)
  }

  return (
    <Card
      title="Advanced Charting Suite"
      subtitle="Multi-timeframe analytics with indicators, comparisons, and CSV export"
    >
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TIMEFRAME_OPTIONS.map((item) => (
            <ControlChip
              key={item.id}
              label={item.label}
              active={item.id === timeframe}
              onClick={() => setTimeframe(item.id)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {METRICS.map((item) => (
            <ControlChip
              key={item.id}
              label={item.label}
              active={item.id === metric}
              onClick={() => setMetric(item.id)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <ControlChip label="SMA (10)" active={showSMA} onClick={() => setShowSMA(!showSMA)} />
          <ControlChip label="EMA (10)" active={showEMA} onClick={() => setShowEMA(!showEMA)} />
          <ControlChip label="RSI (14)" active={showRSI} onClick={() => setShowRSI(!showRSI)} />
          <ControlChip
            label="Comparison Mode"
            active={comparisonMode}
            onClick={() => setComparisonMode(!comparisonMode)}
          />
          <ControlChip label="Export Metric CSV" active={false} onClick={exportPrimary} />
          {comparisonMode && (
            <ControlChip label="Export Compare CSV" active={false} onClick={exportComparison} />
          )}
        </div>

        <div style={{ height: isMobile ? '260px' : '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={withIndicators} margin={{ left: 0, right: isMobile ? 12 : 0, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="timestamp"
                tick={AXIS_TICK_STYLE}
                tickFormatter={timeframe === '24h' ? formatTimeAxis : formatDateAxis}
                minTickGap={isMobile ? 8 : 16}
              />
              <YAxis tick={AXIS_TICK_STYLE} tickFormatter={formatCompactNumber} width={isMobile ? 42 : 56} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(value) => new Date(value).toLocaleString()}
                formatter={(value) => [Number(value).toLocaleString(), metricConfig.unit]}
              />
              <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 11, paddingTop: isMobile ? 4 : 0 }} layout={isMobile ? 'horizontal' : 'horizontal'} verticalAlign="bottom" align="center" />
              <Line type="monotone" dataKey="value" name={metricConfig.label} stroke={CHART_COLORS.cyan} dot={false} strokeWidth={2} />
              {showSMA && <Line type="monotone" dataKey="sma" name="SMA (10)" stroke={CHART_COLORS.amber} dot={false} strokeWidth={1.5} />}
              {showEMA && <Line type="monotone" dataKey="ema" name="EMA (10)" stroke={CHART_COLORS.green} dot={false} strokeWidth={1.5} />}
              {showRSI && <Line type="monotone" dataKey="rsi" name="RSI (14)" stroke={CHART_COLORS.red} dot={false} strokeWidth={1.2} />}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {comparisonMode && (
          <div style={{ height: isMobile ? '200px' : '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonSeries} margin={{ left: 0, right: isMobile ? 12 : 0, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="timestamp"
                  tick={AXIS_TICK_STYLE}
                  tickFormatter={timeframe === '24h' ? formatTimeAxis : formatDateAxis}
                  minTickGap={isMobile ? 8 : 16}
                />
                <YAxis tick={AXIS_TICK_STYLE} domain={[85, 130]} width={isMobile ? 42 : 56} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${Number(value).toFixed(2)}`, 'Indexed']} />
                <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 11, paddingTop: isMobile ? 4 : 0 }} verticalAlign="bottom" align="center" layout="horizontal" />
                <Line type="monotone" dataKey="Primary" stroke={CHART_COLORS.cyan} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="Alpha" stroke={CHART_COLORS.amber} dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="Beta" stroke={CHART_COLORS.green} dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  )
}
