/**
 * Query Pattern Analyzer & Optimization Advisor
 *
 * Watches how the app's IndexedDB-backed stores (see alertRulesDb.ts) are
 * queried and surfaces heuristic, rule-based recommendations: missing
 * indexes, repeated full-table scans, and hot queries worth caching.
 *
 * This is deliberately NOT a machine-learning system. There is no SQL
 * database anywhere in this codebase (the "database layer" is IndexedDB in
 * the browser), and training/serving an ML model needs production query
 * telemetry this project doesn't collect. A rule-based advisor over
 * observed scan-vs-return ratios and query frequency is the honest,
 * verifiable thing to ship; it also satisfies the "safe" requirement below
 * by construction (see `safe` on every recommendation).
 *
 * Usage:
 *   queryOptimizer.recordQuery({ store: 'alert-rules', operation: 'index-lookup', ... })
 *   const report = queryOptimizer.getReport()
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueryOperation = 'index-lookup' | 'full-scan' | 'get-by-key'

export interface QueryEvent {
  store: string
  operation: QueryOperation
  /** Index used for the lookup, if any (undefined implies a full-scan). */
  indexUsed?: string
  /** Field the query filtered on, when known (used for full-scan advice). */
  filterField?: string
  durationMs: number
  /** Records examined to produce the result (== rowsReturned for an index lookup). */
  rowsScanned: number
  rowsReturned: number
  timestamp?: number
}

export type RecommendationType = 'add-index' | 'cache-result' | 'avoid-full-scan'

export interface OptimizationRecommendation {
  id: string
  type: RecommendationType
  store: string
  field?: string
  reason: string
  occurrences: number
  avgDurationMs: number
  avgScanRatio: number
  estimatedImpact: 'high' | 'medium' | 'low'
  /** Heuristic estimate only — derived from observed scan ratio, not measured before/after. */
  estimatedSpeedupPercent: number
  /** Always true: every recommendation here is additive (add an index / cache a read) and never rewrites or deletes existing data or schema. */
  safe: true
}

export interface QueryPatternReport {
  totalQueries: number
  slowQueries: number
  distinctPatterns: number
  recommendations: OptimizationRecommendation[]
  generatedAt: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SLOW_QUERY_MS = 50
const MIN_OCCURRENCES = 3
const FULL_SCAN_RATIO_THRESHOLD = 3
const MAX_EVENTS = 500

interface PatternStats {
  store: string
  operation: QueryOperation
  field?: string
  count: number
  totalDurationMs: number
  totalScanned: number
  totalReturned: number
  lastSeen: number
}

// ─── State ────────────────────────────────────────────────────────────────────

const patterns = new Map<string, PatternStats>()
const recentEvents: QueryEvent[] = []

function patternKey(store: string, operation: QueryOperation, field?: string): string {
  return `${store}::${operation}::${field ?? '*'}`
}

// ─── Recording ────────────────────────────────────────────────────────────────

export function recordQuery(event: QueryEvent): void {
  const timestamp = event.timestamp ?? Date.now()
  const field = event.filterField ?? event.indexUsed

  recentEvents.push({ ...event, timestamp })
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.shift()
  }

  const key = patternKey(event.store, event.operation, field)
  const existing = patterns.get(key)
  if (existing) {
    existing.count += 1
    existing.totalDurationMs += event.durationMs
    existing.totalScanned += event.rowsScanned
    existing.totalReturned += event.rowsReturned
    existing.lastSeen = timestamp
  } else {
    patterns.set(key, {
      store: event.store,
      operation: event.operation,
      field,
      count: 1,
      totalDurationMs: event.durationMs,
      totalScanned: event.rowsScanned,
      totalReturned: event.rowsReturned,
      lastSeen: timestamp,
    })
  }
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

function impactFor(speedupPercent: number): 'high' | 'medium' | 'low' {
  if (speedupPercent >= 60) return 'high'
  if (speedupPercent >= 30) return 'medium'
  return 'low'
}

function buildRecommendation(
  stats: PatternStats,
  type: RecommendationType,
  reason: string
): OptimizationRecommendation {
  const avgDurationMs = stats.totalDurationMs / stats.count
  const avgScanRatio = stats.totalReturned > 0 ? stats.totalScanned / stats.totalReturned : stats.totalScanned
  // Model an index turning an O(scanned) walk into an O(returned) lookup: the
  // fraction of scanned rows that were "wasted" is a reasonable proxy for
  // potential speedup. Clamped to keep the estimate defensible as a heuristic.
  const rawSpeedup = avgScanRatio > 1 ? (1 - 1 / avgScanRatio) * 100 : 0
  const estimatedSpeedupPercent = Math.round(Math.min(90, Math.max(0, rawSpeedup)))

  return {
    id: `${type}:${patternKey(stats.store, stats.operation, stats.field)}`,
    type,
    store: stats.store,
    field: stats.field,
    reason,
    occurrences: stats.count,
    avgDurationMs: Math.round(avgDurationMs * 100) / 100,
    avgScanRatio: Math.round(avgScanRatio * 100) / 100,
    estimatedImpact: impactFor(estimatedSpeedupPercent),
    estimatedSpeedupPercent,
    safe: true,
  }
}

export function getRecommendations(): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = []

  for (const stats of patterns.values()) {
    if (stats.count < MIN_OCCURRENCES) continue

    const avgScanRatio = stats.totalReturned > 0 ? stats.totalScanned / stats.totalReturned : stats.totalScanned
    const avgDurationMs = stats.totalDurationMs / stats.count

    if (stats.operation === 'full-scan' && avgScanRatio >= FULL_SCAN_RATIO_THRESHOLD) {
      const field = stats.field ? `"${stats.field}"` : 'the queried field'
      recommendations.push(
        buildRecommendation(
          stats,
          'add-index',
          `${stats.count} full scans of "${stats.store}" filtering on ${field} examined ` +
            `~${avgScanRatio.toFixed(1)}x more rows than returned. Adding an index on ${field} ` +
            `would let this query look up matches directly instead of scanning the whole store.`
        )
      )
    } else if (stats.operation === 'full-scan') {
      recommendations.push(
        buildRecommendation(
          stats,
          'avoid-full-scan',
          `${stats.count} scans of "${stats.store}" are reading the whole store. Consider an ` +
            `index or a narrower query even though the scan ratio is currently low.`
        )
      )
    }

    if (stats.count >= MIN_OCCURRENCES * 2 && avgDurationMs >= SLOW_QUERY_MS) {
      recommendations.push(
        buildRecommendation(
          stats,
          'cache-result',
          `"${stats.store}" was queried ${stats.count} times (avg ${avgDurationMs.toFixed(1)}ms each) ` +
            `with the same pattern. Caching the result and invalidating on write would avoid repeat reads.`
        )
      )
    }
  }

  return recommendations.sort((a, b) => b.estimatedSpeedupPercent - a.estimatedSpeedupPercent)
}

export function getReport(): QueryPatternReport {
  const slowQueries = recentEvents.filter((e) => e.durationMs >= SLOW_QUERY_MS).length
  return {
    totalQueries: recentEvents.length,
    slowQueries,
    distinctPatterns: patterns.size,
    recommendations: getRecommendations(),
    generatedAt: Date.now(),
  }
}

export function reset(): void {
  patterns.clear()
  recentEvents.length = 0
}

export const queryOptimizer = {
  recordQuery,
  getRecommendations,
  getReport,
  reset,
}
