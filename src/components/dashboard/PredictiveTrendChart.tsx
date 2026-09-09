import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Sliders,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'
import {
  generatePredictions,
  generateDemoData,
  type DataPoint,
  type ModelType,
  type PredictionResult,
  type ChartPoint,
  type PredictionPoint,
  type HistoricalPoint,
} from '../../lib/predictionEngine'
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  AXIS_TICK_STYLE,
  formatDateAxis,
  formatCompactNumber,
  TIMEFRAME_OPTIONS,
  filterSeriesByTimeframe,
  exportChartDataAsCsv,
} from '../../lib/chartUtils'
import { useStore } from '../../lib/store'
import Card from './Card'

// ── Types ──────────────────────────────────────────────────────────────────

interface DatasetConfig {
  id: string
  label: string
  color: string
  data: DataPoint[]
}

// ── Constants ─────────────────────────────────────────────────────────────

const MODELS: { id: ModelType; label: string; description: string }[] = [
  {
    id: 'linear',
    label: 'Linear Regression',
    description: 'Best for data with a steady linear trend',
  },
  {
    id: 'holtwinters',
    label: 'Holt-Winters',
    description: 'Best for trending data with smoothing',
  },
  {
    id: 'exponential',
    label: 'Exponential',
    description: 'Best for accelerating growth/decay trends',
  },
]

const CONFIDENCE_LEVELS: { value: number; label: string }[] = [
  { value: 0.80, label: '80%' },
  { value: 0.90, label: '90%' },
  { value: 0.95, label: '95%' },
  { value: 0.99, label: '99%' },
]

const HORIZON_OPTIONS = [7, 14, 30, 60, 90]

// ── Sub-components ────────────────────────────────────────────────────────

function TrendBadge({ direction, slope }: { direction: string; slope: number }) {
  const cfg =
    direction === 'up'
      ? { color: CHART_COLORS.green, Icon: TrendingUp, label: 'Uptrend' }
      : direction === 'down'
      ? { color: CHART_COLORS.red, Icon: TrendingDown, label: 'Downtrend' }
      : { color: CHART_COLORS.amber, Icon: Minus, label: 'Sideways' }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        background: `${cfg.color}18`,
        border: `1px solid ${cfg.color}44`,
        color: cfg.color,
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
      }}
    >
      <cfg.Icon size={12} />
      {cfg.label} ({slope >= 0 ? '+' : ''}{slope.toFixed(2)}/step)
    </span>
  )
}

function MetricCard({
  label,
  value,
  unit = '',
  tooltip,
}: {
  label: string
  value: string | number
  unit?: string
  tooltip?: string
}) {
  return (
    <div
      title={tooltip}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
  dataKey: string
}

function PredictionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: number
}) {
  if (!active || !payload?.length) return null

  const date = new Date(label ?? 0).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const isPrediction = payload.some((p) => p.dataKey === 'predicted')

  return (
    <div
      style={{
        ...TOOLTIP_STYLE,
        padding: '12px 16px',
        minWidth: 200,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
          {date}
        </span>
        {isPrediction && (
          <span
            style={{
              fontSize: 9,
              padding: '2px 7px',
              borderRadius: 999,
              background: `${CHART_COLORS.amber}22`,
              border: `1px solid ${CHART_COLORS.amber}55`,
              color: CHART_COLORS.amber,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Predicted
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {payload.map((entry) => {
          if (['lower', 'upper', 'confidence'].includes(entry.dataKey)) return null
          return (
            <div
              key={entry.dataKey}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{entry.name}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: entry.color || 'var(--text-primary)',
                }}
              >
                {formatCompactNumber(entry.value)}
              </span>
            </div>
          )
        })}
        {/* Confidence interval bounds */}
        {isPrediction && (() => {
          const lower = payload.find((p) => p.dataKey === 'lower')
          const upper = payload.find((p) => p.dataKey === 'upper')
          if (!lower || !upper) return null
          return (
            <div
              style={{
                marginTop: 4,
                paddingTop: 6,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Confidence Interval</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: `${CHART_COLORS.cyan}bb`,
                  }}
                >
                  ↓ {formatCompactNumber(lower.value)}
                </span>
                <span style={{ color: 'var(--border)' }}>–</span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: `${CHART_COLORS.cyan}bb`,
                  }}
                >
                  ↑ {formatCompactNumber(upper.value)}
                </span>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Chart data transformation ──────────────────────────────────────────────

function buildChartData(result: PredictionResult) {
  const hist = result.historical.map((p: HistoricalPoint) => ({
    timestamp: p.timestamp,
    actual: p.value,
    trend: p.trend,
    predicted: undefined,
    lower: undefined,
    upper: undefined,
  }))

  // Bridge: last historical value repeated as first predicted value for smooth
  // line continuity.
  const lastHist = result.historical[result.historical.length - 1]
  const bridge = lastHist
    ? [
        {
          timestamp: lastHist.timestamp,
          actual: lastHist.value,
          trend: lastHist.trend,
          predicted: lastHist.value,
          lower: lastHist.value,
          upper: lastHist.value,
        },
      ]
    : []

  const pred = result.predictions.map((p: PredictionPoint) => ({
    timestamp: p.timestamp,
    actual: undefined,
    trend: undefined,
    predicted: p.predicted,
    lower: p.lower,
    upper: p.upper,
  }))

  return [...hist, ...bridge, ...pred]
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PredictiveTrendChart() {
  const { accountData } = useStore()

  // ── Control state ────────────────────────────────────────────────────────
  const [selectedModel, setSelectedModel] = useState<ModelType>('holtwinters')
  const [horizon, setHorizon] = useState(30)
  const [confidenceLevel, setConfidenceLevel] = useState(0.90)
  const [timeframe, setTimeframe] = useState('90d')
  const [showControls, setShowControls] = useState(false)
  const [smoothingAlpha, setSmoothingAlpha] = useState(0.3)
  const [smoothingBeta, setSmoothingBeta] = useState(0.1)
  const [showTrendLine, setShowTrendLine] = useState(true)
  const [selectedDataset, setSelectedDataset] = useState('xlm_balance')

  // ── Build demo datasets ──────────────────────────────────────────────────
  const datasets = useMemo<DatasetConfig[]>(() => {
    const balances = accountData?.balances ?? []

    if (balances.length > 0) {
      // Use actual balances as base with simulated history for demo
      return balances.slice(0, 3).map((b: { asset_type: string; asset_code?: string; balance: string }, i: number) => {
        const code =
          b.asset_type === 'native'
            ? 'XLM'
            : b.asset_code ?? b.asset_type
        const baseValue = parseFloat(b.balance) || 100
        const colors = [CHART_COLORS.cyan, CHART_COLORS.amber, CHART_COLORS.green]
        return {
          id: code,
          label: `${code} Balance`,
          color: colors[i % colors.length],
          data: generateDemoData(90, baseValue, baseValue * 0.05, baseValue * 0.002),
        }
      })
    }

    // Fully synthetic demo datasets
    return [
      {
        id: 'xlm_balance',
        label: 'XLM Balance',
        color: CHART_COLORS.cyan,
        data: generateDemoData(90, 5000, 120, 4),
      },
      {
        id: 'transaction_volume',
        label: 'Tx Volume (daily)',
        color: CHART_COLORS.amber,
        data: generateDemoData(90, 200, 40, 1.5),
      },
      {
        id: 'network_tps',
        label: 'Network TPS',
        color: CHART_COLORS.green,
        data: generateDemoData(90, 150, 25, 0.8),
      },
    ]
  }, [accountData])

  const currentDataset = datasets.find((d) => d.id === selectedDataset) ?? datasets[0]

  // ── Filtered data by timeframe ────────────────────────────────────────────
  const filteredData = useMemo<DataPoint[]>(() => {
    if (!currentDataset) return []
    return filterSeriesByTimeframe(
      currentDataset.data.map((d) => ({ ...d, timestamp: d.timestamp })),
      timeframe,
      'timestamp',
    ) as DataPoint[]
  }, [currentDataset, timeframe])

  // ── Run prediction ────────────────────────────────────────────────────────
  const predResult = useMemo<PredictionResult | null>(() => {
    if (filteredData.length < 5) return null
    return generatePredictions(filteredData, {
      model: selectedModel,
      horizon,
      confidenceLevel,
      smoothingAlpha,
      smoothingBeta,
    })
  }, [filteredData, selectedModel, horizon, confidenceLevel, smoothingAlpha, smoothingBeta])

  const chartData = useMemo(
    () => (predResult ? buildChartData(predResult) : []),
    [predResult],
  )

  // ── The dividing timestamp between history and future ─────────────────────
  const lastHistTs = predResult
    ? predResult.historical[predResult.historical.length - 1]?.timestamp
    : undefined

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!chartData.length) return
    exportChartDataAsCsv(
      chartData.map((d) => ({
        ...d,
        date: new Date(d.timestamp).toISOString(),
      })),
      `prediction_${selectedDataset}_${selectedModel}.csv`,
    )
  }, [chartData, selectedDataset, selectedModel])

  // ── Styles ────────────────────────────────────────────────────────────────
  const activeColor = currentDataset?.color ?? CHART_COLORS.cyan

  return (
    <Card
      title="Predictive Trend Visualization"
      subtitle={`AI-powered forecasting · ${MODELS.find((m) => m.id === selectedModel)?.label}`}
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Timeframe selector */}
          <div style={{ display: 'flex', gap: 2 }}>
            {TIMEFRAME_OPTIONS.slice(1).map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id)}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  background: timeframe === tf.id ? activeColor : 'var(--bg-elevated)',
                  color: timeframe === tf.id ? '#000' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: timeframe === tf.id ? 700 : 400,
                  transition: 'var(--transition)',
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            title="Export as CSV"
            style={iconBtnStyle}
          >
            <Download size={13} />
          </button>

          <button
            onClick={() => setShowControls((v) => !v)}
            title="Model Settings"
            style={{
              ...iconBtnStyle,
              background: showControls ? `${activeColor}22` : 'var(--bg-elevated)',
              borderColor: showControls ? activeColor : 'var(--border)',
              color: showControls ? activeColor : 'var(--text-secondary)',
            }}
          >
            <Sliders size={13} />
          </button>
        </div>
      }
    >
      <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── Collapsible controls panel ─────────────────────────────────── */}
        {showControls && (
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 20,
            }}
          >
            {/* Dataset selector */}
            <div style={controlGroupStyle}>
              <label style={labelStyle}>Dataset</label>
              <select
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
                style={selectStyle}
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Model selector */}
            <div style={controlGroupStyle}>
              <label style={labelStyle}>Forecast Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as ModelType)}
                style={selectStyle}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {MODELS.find((m) => m.id === selectedModel)?.description}
              </span>
            </div>

            {/* Horizon */}
            <div style={controlGroupStyle}>
              <label style={labelStyle}>Prediction Horizon</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {HORIZON_OPTIONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHorizon(h)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      background: horizon === h ? activeColor : 'var(--bg-card)',
                      color: horizon === h ? '#000' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontWeight: horizon === h ? 700 : 400,
                    }}
                  >
                    {h}d
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence level */}
            <div style={controlGroupStyle}>
              <label style={labelStyle}>Confidence Interval</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CONFIDENCE_LEVELS.map((cl) => (
                  <button
                    key={cl.value}
                    onClick={() => setConfidenceLevel(cl.value)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      background: confidenceLevel === cl.value ? activeColor : 'var(--bg-card)',
                      color: confidenceLevel === cl.value ? '#000' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontWeight: confidenceLevel === cl.value ? 700 : 400,
                    }}
                  >
                    {cl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Holt-Winters sliders */}
            {selectedModel === 'holtwinters' && (
              <>
                <div style={controlGroupStyle}>
                  <label style={labelStyle}>
                    Level Smoothing (α = {smoothingAlpha.toFixed(2)})
                  </label>
                  <input
                    type="range"
                    min={0.05}
                    max={0.95}
                    step={0.05}
                    value={smoothingAlpha}
                    onChange={(e) => setSmoothingAlpha(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: activeColor }}
                  />
                </div>
                <div style={controlGroupStyle}>
                  <label style={labelStyle}>
                    Trend Smoothing (β = {smoothingBeta.toFixed(2)})
                  </label>
                  <input
                    type="range"
                    min={0.05}
                    max={0.95}
                    step={0.05}
                    value={smoothingBeta}
                    onChange={(e) => setSmoothingBeta(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: activeColor }}
                  />
                </div>
              </>
            )}

            {/* Toggle trend line */}
            <div style={controlGroupStyle}>
              <label style={labelStyle}>Display Options</label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={showTrendLine}
                  onChange={(e) => setShowTrendLine(e.target.checked)}
                  style={{ accentColor: activeColor }}
                />
                Show trend line
              </label>
            </div>
          </div>
        )}

        {/* ── KPI metrics row ────────────────────────────────────────────── */}
        {predResult && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: 12,
            }}
          >
            <MetricCard
              label="Trend Direction"
              value={
                predResult.trendDirection === 'up' ? '↑' :
                predResult.trendDirection === 'down' ? '↓' : '→'
              }
              tooltip="Overall trend direction over the historical period"
            />
            <MetricCard
              label="R² Score"
              value={(predResult.rSquared * 100).toFixed(1)}
              unit="%"
              tooltip="Goodness of fit — how well the model describes the data"
            />
            <MetricCard
              label="RMSE"
              value={formatCompactNumber(predResult.rmse)}
              tooltip="Root Mean Square Error — lower is better"
            />
            <MetricCard
              label="Horizon"
              value={horizon}
              unit="days"
              tooltip="Number of days predicted into the future"
            />
            <MetricCard
              label="Confidence"
              value={`${(confidenceLevel * 100).toFixed(0)}`}
              unit="%"
              tooltip={`${(confidenceLevel * 100).toFixed(0)}% confidence interval shown as shaded band`}
            />
          </div>
        )}

        {/* ── Trend badge ────────────────────────────────────────────────── */}
        {predResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Brain size={15} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Model assessment:
            </span>
            <TrendBadge
              direction={predResult.trendDirection}
              slope={predResult.trendSlope}
            />
          </div>
        )}

        {/* ── Main chart ─────────────────────────────────────────────────── */}
        <div style={{ height: 380, position: 'relative' }}>
          {/* Prediction zone label */}
          {lastHistTs && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                right: 70,
                fontSize: 10,
                color: CHART_COLORS.amber,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                background: `${CHART_COLORS.amber}18`,
                border: `1px solid ${CHART_COLORS.amber}44`,
                borderRadius: 'var(--radius-sm)',
                padding: '2px 8px',
                zIndex: 10,
              }}
            >
              ⟶ Predicted zone
            </div>
          )}

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
            >
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={activeColor} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="confidenceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.amber} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                opacity={0.5}
              />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v) => formatDateAxis(v)}
                tick={AXIS_TICK_STYLE}
                scale="time"
              />
              <YAxis
                tick={AXIS_TICK_STYLE}
                tickFormatter={(v) => formatCompactNumber(v)}
                width={60}
              />
              <Tooltip content={<PredictionTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
              />

              {/* Vertical reference line separating history from future */}
              {lastHistTs && (
                <ReferenceLine
                  x={lastHistTs}
                  stroke={CHART_COLORS.amber}
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: 'NOW',
                    position: 'top',
                    fontSize: 9,
                    fill: CHART_COLORS.amber,
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              )}

              {/* Confidence interval band (filled area between lower & upper) */}
              <Area
                type="monotone"
                dataKey="upper"
                fill="url(#confidenceGrad)"
                stroke="none"
                name="Upper bound"
                legendType="none"
                connectNulls={false}
                activeDot={false}
              />
              <Area
                type="monotone"
                dataKey="lower"
                fill="var(--bg-base)"
                stroke="none"
                name="Lower bound"
                legendType="none"
                connectNulls={false}
                activeDot={false}
              />

              {/* Actual historical values — filled area */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke={activeColor}
                strokeWidth={2}
                fill="url(#actualGrad)"
                name={currentDataset?.label ?? 'Actual'}
                dot={false}
                activeDot={{ r: 4, fill: activeColor, strokeWidth: 0 }}
                connectNulls={false}
              />

              {/* Trend line overlay */}
              {showTrendLine && (
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke={`${activeColor}88`}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  name="Trend"
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  legendType="plainline"
                />
              )}

              {/* Predicted values */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke={CHART_COLORS.amber}
                strokeWidth={2.5}
                strokeDasharray="8 4"
                name="Forecast"
                dot={false}
                activeDot={{ r: 5, fill: CHART_COLORS.amber, strokeWidth: 0 }}
                connectNulls={false}
                legendType="plainline"
              />

              {/* Brush for zooming into historical range */}
              <Brush
                dataKey="timestamp"
                height={24}
                stroke="var(--border)"
                fill="var(--bg-elevated)"
                travellerWidth={6}
                tickFormatter={(v) => formatDateAxis(v)}
                startIndex={Math.max(0, chartData.length - Math.floor(chartData.length * 0.7))}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── Prediction summary table ───────────────────────────────────── */}
        {predResult && predResult.predictions.length > 0 && (
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}
            >
              <Brain size={13} />
              Prediction Summary — Next {horizon} Days
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                padding: '8px 16px',
                fontSize: 10,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span>Date</span>
              <span style={{ textAlign: 'right' }}>Predicted</span>
              <span style={{ textAlign: 'right' }}>Lower</span>
              <span style={{ textAlign: 'right' }}>Upper</span>
            </div>

            {predResult.predictions
              .filter((_, i) => i % Math.max(1, Math.floor(horizon / 7)) === 0)
              .slice(0, 7)
              .map((p) => {
                const date = new Date(p.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
                return (
                  <div
                    key={p.timestamp}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr 1fr',
                      padding: '9px 16px',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background var(--transition)',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--bg-hover)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <span style={{ color: CHART_COLORS.amber }}>{date}</span>
                    <span style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatCompactNumber(p.predicted)}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatCompactNumber(p.lower)}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatCompactNumber(p.upper)}
                    </span>
                  </div>
                )
              })}
          </div>
        )}

        {/* ── Model legend ────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-block',
                width: 20,
                height: 2,
                background: activeColor,
              }}
            />
            Historical data
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-block',
                width: 20,
                height: 2,
                background: CHART_COLORS.amber,
                borderBottom: `2px dashed ${CHART_COLORS.amber}`,
              }}
            />
            Forecast ({horizon}d)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-block',
                width: 20,
                height: 10,
                background: `${CHART_COLORS.amber}33`,
                borderRadius: 2,
              }}
            />
            {(confidenceLevel * 100).toFixed(0)}% confidence band
          </span>
          {showTrendLine && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 20,
                  height: 0,
                  borderBottom: `1.5px dashed ${activeColor}88`,
                }}
              />
              Trend line
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

// ── Style constants ────────────────────────────────────────────────────────

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'var(--transition)',
}

const controlGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  fontWeight: 600,
}

const selectStyle: React.CSSProperties = {
  height: 30,
  padding: '0 8px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  cursor: 'pointer',
}
