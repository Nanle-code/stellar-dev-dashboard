/**
 * Metrics Collector (#461)
 *
 * Provides:
 *  - Custom metric registration and recording
 *  - Business metrics (tx throughput, asset volume, active accounts)
 *  - Technical metrics (API latency p50/p95/p99, error rates, cache hit ratios)
 *  - Trend analysis and anomaly detection via simple z-score
 *  - Subscriber pattern for real-time dashboard updates
 */

export type MetricKind = 'counter' | 'gauge' | 'histogram'

export interface MetricPoint {
  value: number
  timestamp: string
  labels?: Record<string, string>
}

export interface MetricSeries {
  name: string
  kind: MetricKind
  unit: string
  description: string
  points: MetricPoint[]
}

export interface AnomalyResult {
  metric: string
  value: number
  zScore: number
  mean: number
  stdDev: number
  timestamp: string
}

const MAX_SERIES_POINTS = 200
const registry = new Map<string, MetricSeries>()
const subscribers = new Set<(series: Map<string, MetricSeries>) => void>()

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerMetric(
  name: string,
  kind: MetricKind,
  unit = '',
  description = '',
): void {
  if (!registry.has(name)) {
    registry.set(name, { name, kind, unit, description, points: [] })
  }
}

// ─── Recording ────────────────────────────────────────────────────────────────

export function recordMetric(
  name: string,
  value: number,
  labels?: Record<string, string>,
): void {
  if (!registry.has(name)) {
    registerMetric(name, 'gauge')
  }
  const series = registry.get(name)!
  series.points.push({ value, timestamp: new Date().toISOString(), labels })
  if (series.points.length > MAX_SERIES_POINTS) {
    series.points.shift()
  }
  notifySubscribers()
}

export function incrementCounter(name: string, by = 1, labels?: Record<string, string>): void {
  if (!registry.has(name)) {
    registerMetric(name, 'counter')
  }
  const series = registry.get(name)!
  const last = series.points[series.points.length - 1]?.value ?? 0
  recordMetric(name, last + by, labels)
}

// ─── Business metrics helpers ─────────────────────────────────────────────────

export function recordTransactionSubmitted(success: boolean, durationMs: number): void {
  incrementCounter('business.tx.total')
  if (success) {
    incrementCounter('business.tx.success')
  } else {
    incrementCounter('business.tx.failure')
  }
  recordMetric('business.tx.duration_ms', durationMs)
}

export function recordApiCall(endpoint: string, durationMs: number, statusCode: number): void {
  recordMetric('technical.api.latency_ms', durationMs, { endpoint })
  if (statusCode >= 400) {
    incrementCounter('technical.api.errors', 1, { endpoint, status: String(statusCode) })
  }
  incrementCounter('technical.api.calls', 1, { endpoint })
}

export function recordCacheOperation(hit: boolean): void {
  incrementCounter(hit ? 'technical.cache.hits' : 'technical.cache.misses')
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

export function getPercentile(values: number[], pct: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil((pct / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export function getMetricStats(name: string): {
  count: number; mean: number; min: number; max: number; p50: number; p95: number; p99: number
} | null {
  const series = registry.get(name)
  if (!series || !series.points.length) return null
  const values = series.points.map(p => p.value)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return {
    count: values.length,
    mean,
    min: Math.min(...values),
    max: Math.max(...values),
    p50: getPercentile(values, 50),
    p95: getPercentile(values, 95),
    p99: getPercentile(values, 99),
  }
}

// ─── Anomaly detection (z-score) ─────────────────────────────────────────────

export function detectAnomalies(windowSize = 20, threshold = 2.5): AnomalyResult[] {
  const anomalies: AnomalyResult[] = []

  for (const [, series] of registry) {
    if (series.points.length < windowSize) continue
    const window = series.points.slice(-windowSize)
    const values = window.map(p => p.value)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
    const stdDev = Math.sqrt(variance)
    if (stdDev === 0) continue
    const latest = series.points[series.points.length - 1]
    const zScore = Math.abs((latest.value - mean) / stdDev)
    if (zScore >= threshold) {
      anomalies.push({
        metric: series.name,
        value: latest.value,
        zScore,
        mean,
        stdDev,
        timestamp: latest.timestamp,
      })
    }
  }
  return anomalies
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function subscribeMetrics(
  handler: (series: Map<string, MetricSeries>) => void,
): () => void {
  subscribers.add(handler)
  handler(registry)
  return () => subscribers.delete(handler)
}

function notifySubscribers(): void {
  subscribers.forEach(fn => {
    try { fn(registry) } catch { /* swallow */ }
  })
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getAllMetrics(): MetricSeries[] {
  return Array.from(registry.values())
}

export function getMetric(name: string): MetricSeries | undefined {
  return registry.get(name)
}

export function clearMetric(name: string): void {
  const series = registry.get(name)
  if (series) {
    series.points = []
    notifySubscribers()
  }
}

// ─── Pre-register known metrics ───────────────────────────────────────────────

;[
  ['business.tx.total', 'counter', 'ops', 'Total transaction submissions'],
  ['business.tx.success', 'counter', 'ops', 'Successful transaction submissions'],
  ['business.tx.failure', 'counter', 'ops', 'Failed transaction submissions'],
  ['business.tx.duration_ms', 'histogram', 'ms', 'Transaction submission duration'],
  ['technical.api.latency_ms', 'histogram', 'ms', 'API call latency'],
  ['technical.api.calls', 'counter', 'ops', 'Total API calls'],
  ['technical.api.errors', 'counter', 'ops', 'API error count'],
  ['technical.cache.hits', 'counter', 'ops', 'Cache hit count'],
  ['technical.cache.misses', 'counter', 'ops', 'Cache miss count'],
].forEach(([n, k, u, d]) => registerMetric(n as string, k as MetricKind, u as string, d as string))
