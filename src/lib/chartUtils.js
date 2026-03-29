/**
 * Chart utility functions and formatters for Recharts components.
 */

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
 * Generate mock data points for chart demonstrations when real data is unavailable.
 */
export function generatePlaceholderData(count, minValue = 100, maxValue = 1000) {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) => ({
    timestamp: now - (count - i) * 3600_000,
    value: minValue + Math.random() * (maxValue - minValue),
  }))
}
