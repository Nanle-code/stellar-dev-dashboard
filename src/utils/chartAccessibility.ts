// src/utils/chartAccessibility.ts
//
// Pure helpers that turn Recharts-style datasets into screen-reader text and
// keyboard-navigable table data. No React/DOM dependency so they work in any
// environment (SSR, tests, workers) and never throw on malformed input.

export interface ChartSeriesConfig {
  /** Object key read from each data row */
  key: string;
  /** Human-readable label used in the summary and table header */
  label?: string;
  /** Unit suffix appended to values in the summary, e.g. "ms", "XLM" */
  unit?: string;
}

export interface ChartTable {
  headers: string[];
  rows: Array<Array<string>>;
}

export interface ChartSeriesSummary {
  key: string;
  label: string;
  unit: string;
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
  first: number | null;
  last: number | null;
  trend: "up" | "down" | "flat" | "unknown";
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toFiniteNumber = (value: unknown): number | null => {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) ? num : null;
};

/**
 * Validates that a dataset is usable for accessible rendering.
 * Returns false (rather than throwing) for null/undefined/non-array/empty input
 * so callers can render a "no data" fallback instead of crashing.
 */
export function isRenderableChartData(data: unknown): data is Array<Record<string, unknown>> {
  return Array.isArray(data) && data.length > 0 && data.some(isPlainObject);
}

const round = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

/**
 * Computes summary statistics (min/max/average/trend) for one series in a dataset.
 * Non-finite / missing values are skipped rather than treated as zero, so a
 * partially-malformed row can't silently distort the average.
 */
export function summarizeSeries(
  data: unknown,
  series: ChartSeriesConfig
): ChartSeriesSummary {
  const base: ChartSeriesSummary = {
    key: series.key,
    label: series.label || series.key,
    unit: series.unit || "",
    count: 0,
    min: null,
    max: null,
    average: null,
    first: null,
    last: null,
    trend: "unknown",
  };

  if (!isRenderableChartData(data)) return base;

  const values = data
    .map((row) => (isPlainObject(row) ? toFiniteNumber(row[series.key]) : null))
    .filter((v): v is number => v !== null);

  if (values.length === 0) return base;

  const sum = values.reduce((acc, v) => acc + v, 0);
  const first = values[0];
  const last = values[values.length - 1];

  let trend: ChartSeriesSummary["trend"] = "flat";
  if (values.length > 1) {
    const delta = last - first;
    const threshold = Math.abs(first) * 0.01 || 0.01;
    trend = delta > threshold ? "up" : delta < -threshold ? "down" : "flat";
  }

  return {
    ...base,
    count: values.length,
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
    average: round(sum / values.length),
    first: round(first),
    last: round(last),
    trend,
  };
}

/**
 * Builds a short, human-readable sentence describing a chart for screen
 * readers (used as the accessible summary / aria-describedby text).
 */
export function describeChart(options: {
  title: string;
  data: unknown;
  series: ChartSeriesConfig[];
}): string {
  const { title, data, series } = options;

  if (!isRenderableChartData(data)) {
    return `${title}: no data is currently available.`;
  }

  if (!Array.isArray(series) || series.length === 0) {
    return `${title}: chart with ${data.length} data points.`;
  }

  const parts = series.map((s) => {
    const summary = summarizeSeries(data, s);
    if (summary.count === 0) {
      return `${summary.label} has no numeric data`;
    }
    const unit = summary.unit ? ` ${summary.unit}` : "";
    const trendWord =
      summary.trend === "up"
        ? "trending up"
        : summary.trend === "down"
          ? "trending down"
          : "roughly flat";
    return `${summary.label} ranges from ${summary.min}${unit} to ${summary.max}${unit}, averaging ${summary.average}${unit} and ${trendWord}`;
  });

  return `${title}: ${data.length} data points. ${parts.join("; ")}.`;
}

/**
 * Converts a dataset into a plain headers/rows table structure suitable for
 * rendering as an accessible HTML <table>. Falls back to an empty table for
 * unusable input instead of throwing.
 */
export function buildChartTable(
  data: unknown,
  columns: Array<{ key: string; label?: string }>
): ChartTable {
  if (!isRenderableChartData(data) || !Array.isArray(columns) || columns.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = columns.map((c) => c.label || c.key);
  const rows = data
    .filter(isPlainObject)
    .map((row) =>
      columns.map((c) => {
        const value = row[c.key];
        if (value === null || value === undefined) return "—";
        return typeof value === "number" ? String(round(value)) : String(value);
      })
    );

  return { headers, rows };
}
