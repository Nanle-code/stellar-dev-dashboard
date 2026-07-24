// tests/unit/lib/capacityPrediction.test.ts
import { describe, it, expect } from 'vitest'
import {
  predictCapacity,
  forecastTimeSeries,
  buildScenarios,
  analyseFeatureAdoption,
  generateRecommendations,
  generateInsights,
  ledgerHistoryToCapacityPoints,
  CAPACITY_LIMIT_OPS,
  FORECAST_WINDOWS,
} from '../../../src/lib/capacityPrediction'
import type {
  CapacityDataPoint,
  ScenarioProjection,
} from '../../../src/lib/capacityPrediction'
import type { LedgerStatsEntry } from '../../../src/lib/store'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Build n evenly-spaced data points starting from a base timestamp */
function makePoints(
  n: number,
  baseOps = 200,
  slopePerDay = 5,
  startIso = '2024-01-01T00:00:00Z',
): CapacityDataPoint[] {
  const start = new Date(startIso).getTime()
  const MS = 86_400_000
  return Array.from({ length: n }, (_, i) => ({
    timestamp: new Date(start + i * MS).toISOString(),
    operationCount: Math.max(0, Math.round(baseOps + slopePerDay * i)),
    txCount: Math.max(0, Math.round((baseOps + slopePerDay * i) * 0.6)),
    baseFee: 100,
    congestionRatio: Math.min(1, (baseOps + slopePerDay * i) / CAPACITY_LIMIT_OPS),
    failedTxPercent: 2,
  }))
}

/** Build LedgerStatsEntry array (mirrors store shape) */
function makeLedgerHistory(n: number): LedgerStatsEntry[] {
  const start = new Date('2024-03-01T00:00:00Z').getTime()
  const MS = 5_000 // 5 s per ledger
  return Array.from({ length: n }, (_, i) => ({
    sequence: 50_000 + i,
    closedAt: new Date(start + i * MS).toISOString(),
    baseFee: 100,
    operationCount: 150 + i * 2,
    txSuccessCount: 40 + i,
    txFailedCount: i % 5 === 0 ? 2 : 0,
  }))
}

// ---------------------------------------------------------------------------
// CAPACITY_LIMIT_OPS constant
// ---------------------------------------------------------------------------

describe('CAPACITY_LIMIT_OPS', () => {
  it('equals 1000 (matches networkMonitoring.js LEDGER_OPERATION_LIMIT)', () => {
    expect(CAPACITY_LIMIT_OPS).toBe(1000)
  })
})

// ---------------------------------------------------------------------------
// FORECAST_WINDOWS
// ---------------------------------------------------------------------------

describe('FORECAST_WINDOWS', () => {
  it('contains 7, 14, 30, 90', () => {
    expect(FORECAST_WINDOWS).toContain(7)
    expect(FORECAST_WINDOWS).toContain(14)
    expect(FORECAST_WINDOWS).toContain(30)
    expect(FORECAST_WINDOWS).toContain(90)
  })
})

// ---------------------------------------------------------------------------
// ledgerHistoryToCapacityPoints
// ---------------------------------------------------------------------------

describe('ledgerHistoryToCapacityPoints', () => {
  it('returns empty array for empty input', () => {
    expect(ledgerHistoryToCapacityPoints([])).toEqual([])
  })

  it('maps each ledger entry to a CapacityDataPoint', () => {
    const history = makeLedgerHistory(3)
    const points = ledgerHistoryToCapacityPoints(history)
    expect(points).toHaveLength(3)
    expect(points[0].timestamp).toBe(history[0].closedAt)
    expect(points[0].operationCount).toBe(history[0].operationCount)
    expect(points[0].baseFee).toBe(100)
  })

  it('calculates congestionRatio correctly', () => {
    const history: LedgerStatsEntry[] = [{
      sequence: 1, closedAt: '2024-01-01T00:00:00Z',
      baseFee: 100, operationCount: 500,
      txSuccessCount: 10, txFailedCount: 0,
    }]
    const [pt] = ledgerHistoryToCapacityPoints(history)
    expect(pt.congestionRatio).toBeCloseTo(0.5)
  })

  it('clamps congestionRatio to 1 when ops exceed limit', () => {
    const history: LedgerStatsEntry[] = [{
      sequence: 1, closedAt: '2024-01-01T00:00:00Z',
      baseFee: 100, operationCount: 2000,
      txSuccessCount: 10, txFailedCount: 0,
    }]
    const [pt] = ledgerHistoryToCapacityPoints(history)
    expect(pt.congestionRatio).toBe(1)
  })

  it('calculates failedTxPercent correctly', () => {
    const history: LedgerStatsEntry[] = [{
      sequence: 1, closedAt: '2024-01-01T00:00:00Z',
      baseFee: 100, operationCount: 10,
      txSuccessCount: 8, txFailedCount: 2,
    }]
    const [pt] = ledgerHistoryToCapacityPoints(history)
    expect(pt.failedTxPercent).toBeCloseTo(20)
  })

  it('returns 0 failedTxPercent when total tx is 0', () => {
    const history: LedgerStatsEntry[] = [{
      sequence: 1, closedAt: '2024-01-01T00:00:00Z',
      baseFee: 100, operationCount: 0,
      txSuccessCount: 0, txFailedCount: 0,
    }]
    const [pt] = ledgerHistoryToCapacityPoints(history)
    expect(pt.failedTxPercent).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// forecastTimeSeries
// ---------------------------------------------------------------------------

describe('forecastTimeSeries', () => {
  it('returns empty array when fewer than 5 data points', () => {
    const points = makePoints(4)
    expect(forecastTimeSeries(points, 7)).toEqual([])
  })

  it('returns exactly horizonDays prediction points', () => {
    const points = makePoints(20)
    const preds = forecastTimeSeries(points, 14)
    expect(preds).toHaveLength(14)
  })

  it('each prediction point has required fields', () => {
    const preds = forecastTimeSeries(makePoints(15), 7)
    for (const p of preds) {
      expect(p).toHaveProperty('timestamp')
      expect(p).toHaveProperty('predictedOps')
      expect(p).toHaveProperty('lowerBound')
      expect(p).toHaveProperty('upperBound')
      expect(p).toHaveProperty('confidence')
    }
  })

  it('lowerBound <= predictedOps <= upperBound', () => {
    const preds = forecastTimeSeries(makePoints(20), 30)
    for (const p of preds) {
      expect(p.lowerBound).toBeLessThanOrEqual(p.predictedOps)
      expect(p.predictedOps).toBeLessThanOrEqual(p.upperBound)
    }
  })

  it('confidence decreases as horizon grows', () => {
    const preds = forecastTimeSeries(makePoints(30), 30)
    expect(preds[0].confidence).toBeGreaterThanOrEqual(preds[preds.length - 1].confidence)
  })

  it('confidence stays in [0, 1]', () => {
    const preds = forecastTimeSeries(makePoints(20), 90)
    for (const p of preds) {
      expect(p.confidence).toBeGreaterThanOrEqual(0)
      expect(p.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('predictedOps is non-negative', () => {
    const preds = forecastTimeSeries(makePoints(10, 10, -3), 14)
    for (const p of preds) {
      expect(p.predictedOps).toBeGreaterThanOrEqual(0)
    }
  })

  it('upward-trending series produces increasing predicted values', () => {
    const points = makePoints(20, 100, 10) // strong upward slope
    const preds = forecastTimeSeries(points, 7)
    expect(preds[preds.length - 1].predictedOps).toBeGreaterThan(preds[0].predictedOps)
  })

  it('predictions have future timestamps relative to last data point', () => {
    const points = makePoints(10)
    const lastTs = new Date(points[points.length - 1].timestamp).getTime()
    const preds = forecastTimeSeries(points, 7)
    for (const p of preds) {
      expect(new Date(p.timestamp).getTime()).toBeGreaterThan(lastTs)
    }
  })
})

// ---------------------------------------------------------------------------
// buildScenarios
// ---------------------------------------------------------------------------

describe('buildScenarios', () => {
  it('returns exactly 3 scenarios', () => {
    const scenarios = buildScenarios(200, 30)
    expect(scenarios).toHaveLength(3)
  })

  it('includes conservative, moderate, and aggressive scenarios', () => {
    const scenarios = buildScenarios(200, 30)
    const types = scenarios.map((s) => s.scenario)
    expect(types).toContain('conservative')
    expect(types).toContain('moderate')
    expect(types).toContain('aggressive')
  })

  it('each scenario has the correct number of data points', () => {
    const scenarios = buildScenarios(300, 14)
    for (const s of scenarios) {
      expect(s.points).toHaveLength(14)
    }
  })

  it('aggressive scenario has higher projected peak than conservative', () => {
    const scenarios = buildScenarios(200, 30)
    const cons = scenarios.find((s) => s.scenario === 'conservative')!
    const agg = scenarios.find((s) => s.scenario === 'aggressive')!
    expect(agg.projectedPeakOps).toBeGreaterThan(cons.projectedPeakOps)
  })

  it('daysToCapacityLimit is null when baseline is well below limit', () => {
    const scenarios = buildScenarios(50, 7, CAPACITY_LIMIT_OPS)
    const cons = scenarios.find((s) => s.scenario === 'conservative')!
    expect(cons.daysToCapacityLimit).toBeNull()
  })

  it('daysToCapacityLimit is a positive integer when limit is reachable', () => {
    // baseline = 950, aggressive growth over 90 days will hit 1000
    const scenarios = buildScenarios(950, 90, CAPACITY_LIMIT_OPS)
    const agg = scenarios.find((s) => s.scenario === 'aggressive')!
    if (agg.daysToCapacityLimit !== null) {
      expect(agg.daysToCapacityLimit).toBeGreaterThan(0)
      expect(Number.isInteger(agg.daysToCapacityLimit)).toBe(true)
    }
  })

  it('lowerBound <= predictedOps <= upperBound for every point', () => {
    const scenarios = buildScenarios(200, 30)
    for (const s of scenarios) {
      for (const p of s.points) {
        expect(p.lowerBound).toBeLessThanOrEqual(p.predictedOps)
        expect(p.predictedOps).toBeLessThanOrEqual(p.upperBound)
      }
    }
  })

  it('annualGrowthRate is correct for each scenario', () => {
    const scenarios = buildScenarios(100, 30)
    const cons = scenarios.find((s) => s.scenario === 'conservative')!
    const mod = scenarios.find((s) => s.scenario === 'moderate')!
    const agg = scenarios.find((s) => s.scenario === 'aggressive')!
    expect(cons.annualGrowthRate).toBeCloseTo(0.10)
    expect(mod.annualGrowthRate).toBeCloseTo(0.30)
    expect(agg.annualGrowthRate).toBeCloseTo(0.75)
  })

  it('handles zero baseline without throwing', () => {
    expect(() => buildScenarios(0, 30)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// analyseFeatureAdoption
// ---------------------------------------------------------------------------

describe('analyseFeatureAdoption', () => {
  it('returns empty array for fewer than 2 data points', () => {
    expect(analyseFeatureAdoption([])).toEqual([])
    expect(analyseFeatureAdoption(makePoints(1))).toEqual([])
  })

  it('returns 4 feature metrics for sufficient data', () => {
    const metrics = analyseFeatureAdoption(makePoints(10))
    expect(metrics).toHaveLength(4)
  })

  it('all usage rates are in [0, 1]', () => {
    const metrics = analyseFeatureAdoption(makePoints(20))
    for (const m of metrics) {
      expect(m.usageRate).toBeGreaterThanOrEqual(0)
      expect(m.usageRate).toBeLessThanOrEqual(1)
    }
  })

  it('all projected values are in [0, 1]', () => {
    const metrics = analyseFeatureAdoption(makePoints(20))
    for (const m of metrics) {
      expect(m.projectedUsageIn30Days).toBeGreaterThanOrEqual(0)
      expect(m.projectedUsageIn30Days).toBeLessThanOrEqual(1)
    }
  })

  it('each metric has a feature name string', () => {
    const metrics = analyseFeatureAdoption(makePoints(10))
    for (const m of metrics) {
      expect(typeof m.feature).toBe('string')
      expect(m.feature.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// generateRecommendations
// ---------------------------------------------------------------------------

describe('generateRecommendations', () => {
  const noopScenarios: ScenarioProjection[] = [
    { scenario: 'conservative', annualGrowthRate: 0.1, label: '', color: '', points: [], daysToCapacityLimit: null, projectedPeakOps: 100 },
    { scenario: 'moderate',     annualGrowthRate: 0.3, label: '', color: '', points: [], daysToCapacityLimit: null, projectedPeakOps: 200 },
    { scenario: 'aggressive',   annualGrowthRate: 0.75, label: '', color: '', points: [], daysToCapacityLimit: null, projectedPeakOps: 300 },
  ]

  it('returns at least one recommendation always (baseline monitoring)', () => {
    const recs = generateRecommendations(0.3, 1, noopScenarios, 0, 2)
    expect(recs.length).toBeGreaterThanOrEqual(1)
  })

  it('returns critical recommendation when utilisation >= 0.8', () => {
    const recs = generateRecommendations(0.85, 2, noopScenarios, 0, 2)
    expect(recs.some((r) => r.priority === 'critical' && r.id === 'cap-critical')).toBe(true)
  })

  it('returns high recommendation when utilisation is between 0.6 and 0.8', () => {
    const recs = generateRecommendations(0.65, 2, noopScenarios, 0, 2)
    expect(recs.some((r) => r.id === 'cap-warning')).toBe(true)
  })

  it('does NOT return capacity warning when utilisation < 0.6', () => {
    const recs = generateRecommendations(0.4, 2, noopScenarios, 0, 2)
    expect(recs.some((r) => r.id === 'cap-critical' || r.id === 'cap-warning')).toBe(false)
  })

  it('recommends growth planning for positive trend slope > 5', () => {
    const recs = generateRecommendations(0.3, 8, noopScenarios, 0, 2)
    expect(recs.some((r) => r.id === 'trend-growth')).toBe(true)
  })

  it('recommends investigation for declining slope < -3', () => {
    const recs = generateRecommendations(0.3, -5, noopScenarios, 0, 2)
    expect(recs.some((r) => r.id === 'trend-decline')).toBe(true)
  })

  it('raises anomaly recommendation when anomaliesDetected >= 3', () => {
    const recs = generateRecommendations(0.3, 1, noopScenarios, 4, 2)
    expect(recs.some((r) => r.id === 'anomalies')).toBe(true)
  })

  it('does not raise anomaly recommendation for fewer than 3 anomalies', () => {
    const recs = generateRecommendations(0.3, 1, noopScenarios, 2, 2)
    expect(recs.some((r) => r.id === 'anomalies')).toBe(false)
  })

  it('raises failed-tx recommendation when failedTxPercent > 10', () => {
    const recs = generateRecommendations(0.3, 1, noopScenarios, 0, 15)
    expect(recs.some((r) => r.id === 'high-failure-rate')).toBe(true)
  })

  it('raises critical failed-tx when failedTxPercent > 20', () => {
    const recs = generateRecommendations(0.3, 1, noopScenarios, 0, 25)
    const rec = recs.find((r) => r.id === 'high-failure-rate')
    expect(rec?.priority).toBe('critical')
  })

  it('every recommendation has required fields', () => {
    const recs = generateRecommendations(0.9, 10, noopScenarios, 5, 25)
    for (const r of recs) {
      expect(r).toHaveProperty('id')
      expect(r).toHaveProperty('priority')
      expect(r).toHaveProperty('category')
      expect(r).toHaveProperty('title')
      expect(r).toHaveProperty('description')
      expect(r).toHaveProperty('timeframe')
      expect(r).toHaveProperty('estimatedImpact')
      expect(Array.isArray(r.actionItems)).toBe(true)
      expect(r.actionItems.length).toBeGreaterThan(0)
    }
  })

  it('generates a scenario recommendation when moderate scenario hits limit within 30 days', () => {
    const scenariosWithLimit: ScenarioProjection[] = [
      ...noopScenarios.filter((s) => s.scenario !== 'moderate'),
      { scenario: 'moderate', annualGrowthRate: 0.3, label: '', color: '', points: [], daysToCapacityLimit: 20, projectedPeakOps: 1000 },
    ]
    const recs = generateRecommendations(0.4, 2, scenariosWithLimit, 0, 2)
    expect(recs.some((r) => r.id === 'scenario-moderate-limit')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// generateInsights
// ---------------------------------------------------------------------------

describe('generateInsights', () => {
  const scenarios = buildScenarios(200, 30)

  it('always returns at least one insight', () => {
    const insights = generateInsights(0.4, 2, [], scenarios, false, 0, 0.8)
    expect(insights.length).toBeGreaterThan(0)
  })

  it('mentions utilisation percentage in first insight', () => {
    const insights = generateInsights(0.45, 2, [], scenarios, false, 0, 0.8)
    expect(insights[0]).toMatch(/45%/)
  })

  it('mentions growth when slope is positive', () => {
    const insights = generateInsights(0.3, 5, [], scenarios, false, 0, 0.8)
    expect(insights.some((s) => s.includes('growing'))).toBe(true)
  })

  it('mentions decline when slope is negative', () => {
    const insights = generateInsights(0.3, -4, [], scenarios, false, 0, 0.8)
    expect(insights.some((s) => s.includes('declining'))).toBe(true)
  })

  it('mentions seasonality when detected', () => {
    const insights = generateInsights(0.3, 2, [], scenarios, true, 0, 0.8)
    expect(insights.some((s) => s.toLowerCase().includes('seasonality'))).toBe(true)
  })

  it('mentions anomalies when present', () => {
    const insights = generateInsights(0.3, 2, [], scenarios, false, 3, 0.8)
    expect(insights.some((s) => s.includes('3 anomalous'))).toBe(true)
  })

  it('mentions model accuracy', () => {
    const insights = generateInsights(0.3, 2, [], scenarios, false, 0, 0.82)
    expect(insights.some((s) => s.includes('82%'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// predictCapacity — main entry point
// ---------------------------------------------------------------------------

describe('predictCapacity', () => {
  it('returns result with poor data quality and no predictions for fewer than 5 points', () => {
    const result = predictCapacity(makePoints(3), 30)
    expect(result.report.dataQuality).toBe('poor')
    expect(result.report.predictions).toHaveLength(0)
    expect(result.dataPoints).toBe(3)
  })

  it('returns result with need-data recommendation for insufficient data', () => {
    const result = predictCapacity(makePoints(2), 30)
    expect(result.report.recommendations.some((r) => r.id === 'need-data')).toBe(true)
  })

  it('returns predictions for sufficient data', () => {
    const result = predictCapacity(makePoints(15), 7)
    expect(result.report.predictions.length).toBeGreaterThan(0)
  })

  it('returns exactly horizonDays predictions', () => {
    const result = predictCapacity(makePoints(20), 14)
    expect(result.report.predictions).toHaveLength(14)
  })

  it('returns 3 scenarios', () => {
    const result = predictCapacity(makePoints(15), 30)
    expect(result.report.scenarios).toHaveLength(3)
  })

  it('trendSlope is a finite number', () => {
    const result = predictCapacity(makePoints(20, 200, 5), 30)
    expect(Number.isFinite(result.trendSlope)).toBe(true)
  })

  it('trendSlope is positive for upward-trending data', () => {
    const result = predictCapacity(makePoints(20, 100, 10), 30)
    expect(result.trendSlope).toBeGreaterThan(0)
  })

  it('trendSlope is negative for downward-trending data', () => {
    const result = predictCapacity(makePoints(20, 400, -8), 30)
    expect(result.trendSlope).toBeLessThan(0)
  })

  it('baselineOps is a non-negative integer', () => {
    const result = predictCapacity(makePoints(15), 30)
    expect(result.baselineOps).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(result.baselineOps)).toBe(true)
  })

  it('capacityLimitOps defaults to CAPACITY_LIMIT_OPS', () => {
    const result = predictCapacity(makePoints(10), 30)
    expect(result.capacityLimitOps).toBe(CAPACITY_LIMIT_OPS)
  })

  it('respects a custom capacityLimit', () => {
    const result = predictCapacity(makePoints(10), 30, 500)
    expect(result.capacityLimitOps).toBe(500)
  })

  it('currentUtilisation is in [0, 1]', () => {
    const result = predictCapacity(makePoints(15), 30)
    expect(result.report.currentUtilisation).toBeGreaterThanOrEqual(0)
    expect(result.report.currentUtilisation).toBeLessThanOrEqual(1)
  })

  it('utilizationTrend is one of the valid values', () => {
    const result = predictCapacity(makePoints(15), 30)
    expect(['increasing', 'stable', 'decreasing']).toContain(result.report.utilizationTrend)
  })

  it('dataQuality is fair for 5–19 points', () => {
    const result = predictCapacity(makePoints(10), 30)
    expect(result.report.dataQuality).toBe('fair')
  })

  it('dataQuality is good for 20+ points', () => {
    const result = predictCapacity(makePoints(25), 30)
    expect(result.report.dataQuality).toBe('good')
  })

  it('report has a non-empty summary string', () => {
    const result = predictCapacity(makePoints(15), 30)
    expect(typeof result.report.summary).toBe('string')
    expect(result.report.summary.length).toBeGreaterThan(0)
  })

  it('report has a non-empty insights array', () => {
    const result = predictCapacity(makePoints(15), 30)
    expect(result.report.insights.length).toBeGreaterThan(0)
  })

  it('generatedAt is a valid ISO timestamp', () => {
    const result = predictCapacity(makePoints(10), 30)
    expect(() => new Date(result.analyzedAt)).not.toThrow()
    expect(new Date(result.analyzedAt).getTime()).not.toBeNaN()
  })

  it('modelAccuracy is in [0, 1]', () => {
    const result = predictCapacity(makePoints(20), 30)
    expect(result.report.modelAccuracy).toBeGreaterThanOrEqual(0)
    expect(result.report.modelAccuracy).toBeLessThanOrEqual(1)
  })

  it('includes featureAdoption metrics for sufficient data', () => {
    const result = predictCapacity(makePoints(10), 30)
    expect(result.report.featureAdoption.length).toBeGreaterThan(0)
  })

  it('high-utilisation data triggers critical recommendation', () => {
    // Create points where ops > 800 (80% of 1000)
    const points = makePoints(15, 850, 0)
    const result = predictCapacity(points, 30)
    expect(result.report.recommendations.some((r) => r.priority === 'critical')).toBe(true)
  })

  it('all prediction lowerBounds are non-negative', () => {
    const result = predictCapacity(makePoints(20), 30)
    for (const p of result.report.predictions) {
      expect(p.lowerBound).toBeGreaterThanOrEqual(0)
    }
  })

  it('forecastWindowDays matches requested horizon', () => {
    const result = predictCapacity(makePoints(15), 90)
    expect(result.report.forecastWindowDays).toBe(90)
  })

  it('does not throw on flat (constant) time-series', () => {
    const points = makePoints(20, 300, 0)
    expect(() => predictCapacity(points, 30)).not.toThrow()
  })

  it('does not throw on single-value time-series edge case', () => {
    // all zeros
    const points = makePoints(10, 0, 0)
    expect(() => predictCapacity(points, 7)).not.toThrow()
  })

  it('works end-to-end with ledgerHistoryToCapacityPoints adapter', () => {
    const history = makeLedgerHistory(20)
    const points = ledgerHistoryToCapacityPoints(history)
    const result = predictCapacity(points, 14)
    expect(result.dataPoints).toBe(20)
    expect(result.report.predictions).toHaveLength(14)
  })
})
