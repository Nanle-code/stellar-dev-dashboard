/**
 * Type declarations for src/lib/chartUtils.js
 */

export declare const TIMEFRAME_OPTIONS: Array<{ id: string; label: string }>

export declare const CHART_COLORS: {
  cyan: string
  cyanDim: string
  amber: string
  green: string
  red: string
  textMuted: string
  textSecondary: string
  border: string
  bgCard: string
}

export declare const TOOLTIP_STYLE: React.CSSProperties
export declare const AXIS_TICK_STYLE: { fontSize: number; fill: string }

export declare function formatCompactNumber(value: number | null | undefined): string
export declare function formatTimeAxis(timestamp: string | number | null | undefined): string
export declare function formatDateAxis(timestamp: string | number | null | undefined): string
export declare function formatXLMValue(value: number | null | undefined, decimals?: number): string
export declare function filterSeriesByTimeframe<T extends Record<string, unknown>>(
  data: T[],
  timeframe?: string,
  key?: string,
): T[]
export declare function calculateSMA<T extends Record<string, unknown>>(
  data: T[],
  period?: number,
  valueKey?: string,
  outKey?: string,
): T[]
export declare function calculateEMA<T extends Record<string, unknown>>(
  data: T[],
  period?: number,
  valueKey?: string,
  outKey?: string,
): T[]
export declare function calculateRSI<T extends Record<string, unknown>>(
  data: T[],
  period?: number,
  valueKey?: string,
  outKey?: string,
): T[]
export declare function normalizeSeriesForComparison(
  series: Array<{ id: string; data: Array<{ timestamp: string; value: number }> }>,
): Array<Record<string, unknown>>
export declare function buildCsv(rows: Record<string, unknown>[]): string
export declare function exportChartDataAsCsv(
  rows: Record<string, unknown>[],
  filename?: string,
): boolean
export declare function generatePlaceholderData(
  count: number,
  minValue?: number,
  maxValue?: number,
): Array<{ timestamp: number; value: number }>
