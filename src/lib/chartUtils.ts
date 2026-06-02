/**
 * Chart utility functions and formatters for Recharts components.
 */

const TIMEFRAME_TO_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
}

export const TIMEFRAME_OPTIONS = [
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: '1y', label: '1Y' },
  { id: 'all', label: 'ALL' },
]

/**
 * Format a number with compact notation (e.g. 1.2K, 3.4M).
 */
export function formatCompactNumber(value) {
  if (value === null || value === undefined) return '—'
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(1) + 'B'
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M'
  if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K'
  return value.toLocaleString()
}

/**
 * Format a timestamp for chart axes (HH:MM).
 */
export function formatTimeAxis(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Format a date for chart axes (MMM D).
 */
export function formatDateAxis(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * Format a number as XLM with the given decimal places.
 */
export function formatXLMValue(value, decimals = 2) {
  if (value === null || value === undefined) return '—'
  return `${parseFloat(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} XLM`
}

/**
 * Shared chart theme colors that match the CSS variables.
 */
export const CHART_COLORS = {
  cyan: '#00e5ff',
  cyanDim: '#00b8cc',
  amber: '#ffb300',
  green: '#00e676',
  red: '#ff1744',
  textMuted: '#4a6578',
  textSecondary: '#7a9bb0',
  border: '#1e2d3d',
  bgCard: '#0f1820',
}

/**
 * Shared Recharts tooltip style.
 */
export const TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
}

/**
 * Shared Recharts axis tick style.
 */
export const AXIS_TICK_STYLE = {
  fontSize: 11,
  fill: 'var(--text-muted)',
}

/**
 * Keep only data points that match a selected timeframe.
 */
export function filterSeriesByTimeframe(data, timeframe = '30d', key = 'timestamp') {
  if (!Array.isArray(data) || data.length === 0) return []
  if (timeframe === 'all') return data

  const windowSize = TIMEFRAME_TO_MS[timeframe]
  if (!windowSize) return data

  const now = Date.now()
  const min = now - windowSize

  return data.filter((point) => {
    const value = point?.[key]
    if (!value) return false
    const ts = new Date(value).getTime()
    return Number.isFinite(ts) && ts >= min
  })
}

/**
 * Calculate a simple moving average.
 */
export function calculateSMA(data, period = 14, valueKey = 'value', outKey = 'sma') {
  if (!Array.isArray(data) || period <= 1) return data || []
  const result = []
  let runningTotal = 0

  for (let i = 0; i < data.length; i += 1) {
    const point = data[i]
    const value = Number(point?.[valueKey])

    if (!Number.isFinite(value)) {
      result.push({ ...point, [outKey]: null })
      continue
    }

    runningTotal += value

    if (i >= period) {
      const removeValue = Number(data[i - period]?.[valueKey])
      if (Number.isFinite(removeValue)) runningTotal -= removeValue
    }

    if (i + 1 >= period) {
      result.push({ ...point, [outKey]: runningTotal / period })
    } else {
      result.push({ ...point, [outKey]: null })
    }
  }

  return result
}

/**
 * Calculate an exponential moving average.
 */
export function calculateEMA(data, period = 14, valueKey = 'value', outKey = 'ema') {
  if (!Array.isArray(data) || period <= 1) return data || []
  const multiplier = 2 / (period + 1)
  let ema = null

  return data.map((point, index) => {
    const value = Number(point?.[valueKey])
    if (!Number.isFinite(value)) return { ...point, [outKey]: null }

    if (ema === null) {
      ema = value
    } else {
      ema = (value - ema) * multiplier + ema
    }

    return {
      ...point,
      [outKey]: index + 1 >= period ? ema : null,
    }
  })
}

/**
 * Calculate relative strength index (RSI).
 */
export function calculateRSI(data, period = 14, valueKey = 'value', outKey = 'rsi') {
  if (!Array.isArray(data) || period <= 1) return data || []

  const result = data.map((point) => ({ ...point, [outKey]: null }))
  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i < data.length; i += 1) {
    const prev = Number(data[i - 1]?.[valueKey])
    const current = Number(data[i]?.[valueKey])
    if (!Number.isFinite(prev) || !Number.isFinite(current)) continue

    const delta = current - prev
    const gain = delta > 0 ? delta : 0
    const loss = delta < 0 ? Math.abs(delta) : 0

    if (i <= period) {
      avgGain += gain
      avgLoss += loss
      if (i === period) {
        avgGain /= period
        avgLoss /= period
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
        result[i][outKey] = 100 - (100 / (1 + rs))
      }
    } else {
      avgGain = ((avgGain * (period - 1)) + gain) / period
      avgLoss = ((avgLoss * (period - 1)) + loss) / period
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result[i][outKey] = 100 - (100 / (1 + rs))
    }
  }

  return result
}

/**
 * Convert multiple series into a normalized performance index (starts at 100).
 */
export function normalizeSeriesForComparison(series = []) {
  if (!Array.isArray(series) || series.length === 0) return []

  const merged = new Map()

  for (const item of series) {
    const id = item?.id
    const data = item?.data || []
    if (!id || !Array.isArray(data) || data.length === 0) continue

    const firstValue = Number(data[0].value)
    if (!Number.isFinite(firstValue) || firstValue === 0) continue

    for (const row of data) {
      const ts = row.timestamp
      const value = Number(row.value)
      if (!ts || !Number.isFinite(value)) continue

      const existing = merged.get(ts) || { timestamp: ts }
      existing[id] = (value / firstValue) * 100
      merged.set(ts, existing)
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}

function toCsvValue(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert rows into CSV.
 */
export function buildCsv(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]

  for (const row of rows) {
    lines.push(headers.map((key) => toCsvValue(row[key])).join(','))
  }

  return lines.join('\n')
}

/**
 * Trigger client-side CSV download.
 */
export function exportChartDataAsCsv(rows, filename = 'chart-export.csv') {
  const csv = buildCsv(rows)
  if (!csv || typeof document === 'undefined') return false

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return true
}

/**
 * Generate mock data points for chart demonstrations when real data is unavailable.
 */
export function generatePlaceholderData(count, minValue = 100, maxValue = 1000) {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => ({
    timestamp: now - (count - i) * 3600_000,
    value: minValue + Math.random() * (maxValue - minValue),
  }))
}
