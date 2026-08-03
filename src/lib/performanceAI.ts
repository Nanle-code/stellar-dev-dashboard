// Lightweight ML-style performance analyzer and recommendation engine
// Provides: bottleneck identification, optimization suggestions, trend analysis, and report generation

import { getMetricsSummary } from './performanceMonitoring.js'

type MetricPoint = { timestamp: number; value: number }

export type Bottleneck = {
  name: string
  score: number // 0..1 confidence
  reason: string
  recommendation: string
}

export type Trend = {
  name: string
  slope: number
  direction: 'increasing' | 'decreasing' | 'stable'
}

// Default weights for the simple linear model — interpretable and tunable
const DEFAULT_WEIGHTS = {
  avg: 0.45,
  p95: 0.35,
  count: 0.15,
  max: 0.05,
  bias: -0.2,
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x))
}

function scoreFeatures(features: { avg: number; p95: number; count: number; max: number }, weights = DEFAULT_WEIGHTS) {
  // features should be normalized to roughly 0..1 range before calling
  const linear = features.avg * weights.avg + features.p95 * weights.p95 + features.count * weights.count + features.max * weights.max + weights.bias
  return sigmoid(linear)
}

function computeStatistics(values: number[]) {
  if (!values || values.length === 0) return { avg: 0, p95: 0, max: 0, count: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const count = values.length
  const sum = values.reduce((s, v) => s + v, 0)
  const avg = sum / count
  const p95 = sorted[Math.floor((count - 1) * 0.95)] || sorted[sorted.length - 1]
  const max = sorted[sorted.length - 1]
  return { avg, p95, max, count }
}

function normalize(value: number, scale = 10000) {
  // Normalize metric values to 0..1 using a generous scale. This keeps the "ML" model simple.
  return Math.max(0, Math.min(1, value / scale))
}

export function identifyBottlenecks(rawSummary?: any, threshold = 0.6) {
  const summary = rawSummary || getMetricsSummary()
  const candidates: Bottleneck[] = []

  // Evaluate custom metrics
  Object.entries(summary.customMetrics || {}).forEach(([name, data]: any) => {
    const values = [] as number[]
    if (data && typeof data === 'object') {
      // If we have count/average, synthesize a small distribution
      for (let i = 0; i < Math.max(1, Math.min(20, data.count || 1)); i++) {
        // spread around the average
        values.push((data.average || data) * (1 + (Math.random() - 0.5) * 0.4))
      }
    }

    const { avg, p95, max, count } = computeStatistics(values)
    const features = { avg: normalize(avg), p95: normalize(p95), count: normalize(count, 200), max: normalize(max) }
    const score = scoreFeatures(features)
    if (score >= threshold) {
      candidates.push({ name, score, reason: `High latency or frequency detected for ${name}`, recommendation: recommendForMetric(name) })
    }
  })

  // Evaluate web vitals
  Object.entries(summary.webVitals || {}).forEach(([name, metric]: any) => {
    const value = metric?.value ?? 0
    const features = { avg: normalize(value), p95: normalize(value), count: normalize(1, 200), max: normalize(value) }
    const score = scoreFeatures(features)
    if (score >= threshold) {
      candidates.push({ name, score, reason: `Web Vital ${name} shows elevated value`, recommendation: recommendForMetric(name) })
    }
  })

  // Evaluate resources (bundle sizes) if present
  if (summary.resources) {
    const bundles = summary.resources
    ;['javascript', 'css', 'images'].forEach((k) => {
      if (bundles[k] && bundles[k].totalSize) {
        const size = bundles[k].totalSize
        const features = { avg: normalize(size, 1024 * 1024 * 10), p95: normalize(size, 1024 * 1024 * 10), count: normalize(bundles[k].count, 200), max: normalize(size, 1024 * 1024 * 10) }
        const score = scoreFeatures(features)
        if (score >= threshold) {
          candidates.push({ name: `bundle:${k}`, score, reason: `Large ${k} bundle size detected`, recommendation: recommendForMetric(`bundle:${k}`) })
        }
      }
    })
  }

  // Sort by score descending
  return candidates.sort((a, b) => b.score - a.score)
}

export function recommendForMetric(metricName: string) {
  const lower = metricName.toLowerCase()
  if (lower.includes('bundle') || lower.includes('javascript') || lower.includes('css')) {
    return 'Split bundles, enable code-splitting, lazy-load non-critical assets, and compress/minify bundles.'
  }
  if (lower.includes('api') || lower.includes('response') || lower.includes('ttfb')) {
    return 'Add caching, optimize queries, add pagination, and consider introducing rate limiting or background jobs for heavy operations.'
  }
  if (lower.includes('transaction') || lower.includes('contract')) {
    return 'Profile contract simulation and invocation paths, cache results where possible, and reduce payload size or parallelize steps.'
  }
  if (lower.includes('lcp') || lower.includes('fcp') || lower.includes('fid') || lower.includes('cls')) {
    return 'Defer non-critical JS, optimize render-critical CSS, compress images, and prioritize LCP-critical resources.'
  }
  if (lower.includes('longtask')) {
    return 'Break up long tasks, use web workers, and reduce main-thread JavaScript.'
  }

  return 'Investigate the metric, gather traces for affected requests, and apply targeted optimizations (caching, splitting, or algorithmic improvements).'
}

export function analyzeTrends(metricSeries: { [name: string]: MetricPoint[] } = {}) {
  const trends: Trend[] = []
  Object.entries(metricSeries).forEach(([name, points]) => {
    if (!points || points.length < 2) return
    // Simple linear regression slope
    const n = points.length
    const xs = points.map((p, i) => i)
    const ys = points.map((p) => p.value)
    const xAvg = xs.reduce((s, v) => s + v, 0) / n
    const yAvg = ys.reduce((s, v) => s + v, 0) / n
    let num = 0
    let den = 0
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xAvg) * (ys[i] - yAvg)
      den += (xs[i] - xAvg) ** 2
    }
    const slope = den === 0 ? 0 : num / den
    const direction = Math.abs(slope) < 1e-6 ? 'stable' : slope > 0 ? 'increasing' : 'decreasing'
    trends.push({ name, slope, direction })
  })
  return trends
}

export function generateReport(rawSummary?: any, metricSeries?: { [name: string]: MetricPoint[] }) {
  const summary = rawSummary || getMetricsSummary()
  const bottlenecks = identifyBottlenecks(summary)
  const trends = analyzeTrends(metricSeries || {})

  return {
    timestamp: Date.now(),
    summary,
    bottlenecks,
    trends,
    recommendations: bottlenecks.map((b) => ({ name: b.name, recommendation: b.recommendation, confidence: b.score })),
  }
}

export default {
  identifyBottlenecks,
  recommendForMetric,
  analyzeTrends,
  generateReport,
}
