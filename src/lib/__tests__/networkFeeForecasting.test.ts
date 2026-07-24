/**
 * Tests for Network Fee Trend Analysis and Forecasting (#568).
 */

import { describe, it, expect } from 'vitest'
import {
  ACCURACY_TARGET,
  analyzeNetworkFees,
  aggregateToHourlyBuckets,
  buildFeeTimeSeriesFromLedgers,
  calculateEMA,
  detectSeasonalPatterns,
  evaluateForecastAccuracy,
  forecastFees,
  generateFeeRecommendations,
  generateSyntheticFeeHistory,
  type FeeTimePoint,
} from '../networkFeeForecasting'

describe('calculateEMA', () => {
  it('returns empty for empty input', () => {
    expect(calculateEMA([])).toEqual([])
  })

  it('smooths a rising series', () => {
    const ema = calculateEMA([100, 110, 120, 130, 140], 3)
    expect(ema).toHaveLength(5)
    expect(ema[ema.length - 1]).toBeGreaterThan(ema[0])
  })
})

describe('time series construction', () => {
  it('builds hourly series from ledger records', () => {
    const now = Date.UTC(2026, 6, 23, 12, 0, 0)
    const ledgers = Array.from({ length: 5 }, (_, i) => ({
      closed_at: new Date(now + i * 5000).toISOString(),
      base_fee_in_stroops: 100 + i,
      operation_count: 200 + i * 10,
    }))
    const series = buildFeeTimeSeriesFromLedgers(ledgers)
    expect(series.length).toBeGreaterThanOrEqual(1)
    expect(series[0].baseFee).toBeGreaterThanOrEqual(100)
  })

  it('aggregates points into hourly buckets', () => {
    const base = Date.UTC(2026, 6, 23, 10, 0, 0)
    const points: FeeTimePoint[] = [
      { timestamp: base + 1000, label: '', baseFee: 100, operationCount: 10, loadRatio: 0.1 },
      { timestamp: base + 2000, label: '', baseFee: 120, operationCount: 20, loadRatio: 0.2 },
      { timestamp: base + 60 * 60 * 1000 + 1000, label: '', baseFee: 150, operationCount: 30, loadRatio: 0.3 },
    ]
    const hourly = aggregateToHourlyBuckets(points)
    expect(hourly).toHaveLength(2)
    expect(hourly[0].baseFee).toBe(110)
  })
})

describe('seasonal pattern detection (AC)', () => {
  it('identifies seasonal patterns on synthetic history', () => {
    const history = generateSyntheticFeeHistory({ hours: 72, baseFee: 100, seedNoise: 0.02 })
    const patterns = detectSeasonalPatterns(history)
    expect(patterns.detected).toBe(true)
    expect(patterns.hourly).toHaveLength(24)
    expect(patterns.daily).toHaveLength(7)
    expect(patterns.peakHours.length).toBe(3)
    expect(patterns.troughHours.length).toBe(3)
    expect(patterns.confidence).toBeGreaterThan(0.5)
  })

  it('marks sparse data as not confidently seasonal', () => {
    const history = generateSyntheticFeeHistory({ hours: 6, baseFee: 100 })
    const patterns = detectSeasonalPatterns(history)
    expect(patterns.detected).toBe(false)
  })
})

describe('24h forecasting & accuracy (AC: ≥85%)', () => {
  it('produces a 24-point forecast with confidence bands', () => {
    const history = generateSyntheticFeeHistory({ hours: 72, baseFee: 100 })
    const seasonality = detectSeasonalPatterns(history)
    const forecast = forecastFees(history, seasonality, 24)
    expect(forecast.points).toHaveLength(24)
    expect(forecast.nextHourFee).toBeGreaterThanOrEqual(100)
    expect(forecast.next24hMedian).toBeGreaterThanOrEqual(100)
    expect(forecast.points.every((p) => p.high >= p.predictedFee && p.predictedFee >= p.low)).toBe(true)
    expect(['rising', 'falling', 'stable']).toContain(forecast.trend)
  })

  it('achieves ≥85% walk-forward accuracy on seasonal synthetic data', () => {
    const history = generateSyntheticFeeHistory({ hours: 96, baseFee: 100, seedNoise: 0.02 })
    const accuracy = evaluateForecastAccuracy(history, { tolerancePct: 0.15, minTrain: 24 })
    expect(accuracy.sampleCount).toBeGreaterThan(0)
    expect(accuracy.accuracy24h).toBeGreaterThanOrEqual(ACCURACY_TARGET)
    expect(accuracy.meetsTarget).toBe(true)
  })
})

describe('optimization recommendations (AC: actionable)', () => {
  it('returns actionable recommendations with fees and timing', () => {
    const result = analyzeNetworkFees({
      history: generateSyntheticFeeHistory({ hours: 72, baseFee: 100 }),
      feeStats: {
        last_ledger_base_fee: 110,
        median_accepted_fee: 140,
        p90_accepted_fee: 220,
        ledger_capacity_usage: 0.35,
      },
    })
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.recommendations.every((r) => r.actionable)).toBe(true)
    expect(result.recommendations.every((r) => r.suggestedFeeStroops >= 100)).toBe(true)
    expect(result.recommendations.every((r) => r.timingHint.length > 0)).toBe(true)
    expect(result.recommendations.every((r) => r.detail.length > 0)).toBe(true)
  })
})

describe('analyzeNetworkFees orchestrator', () => {
  it('returns a complete analysis suitable for visualization', () => {
    const result = analyzeNetworkFees({
      history: generateSyntheticFeeHistory({ hours: 72 }),
      horizonHours: 24,
    })
    expect(result.history.length).toBeGreaterThan(24)
    expect(result.forecast.points).toHaveLength(24)
    expect(result.seasonality.hourly).toHaveLength(24)
    expect(result.insights.length).toBeGreaterThan(2)
    expect(result.accuracy.meetsTarget).toBe(true)
    expect(result.load.level).toBeTruthy()
  })

  it('bootstraps when live history is empty', () => {
    const result = analyzeNetworkFees({
      ledgers: [],
      history: [],
      feeStats: { last_ledger_base_fee: 100, median_accepted_fee: 120 },
    })
    expect(result.pointCount).toBeGreaterThanOrEqual(36)
    expect(result.forecast.points).toHaveLength(24)
  })
})

describe('generateFeeRecommendations helpers', () => {
  it('includes urgent and standard strategies', () => {
    const history = generateSyntheticFeeHistory({ hours: 48 })
    const seasonality = detectSeasonalPatterns(history)
    const forecast = forecastFees(history, seasonality, 24)
    const recs = generateFeeRecommendations({
      history,
      forecast,
      seasonality,
      load: {
        currentLoad: 0.6,
        level: 'HIGH',
        color: 'red',
        predictedPeakInHours: 2,
        description: 'high',
      },
    })
    expect(recs.some((r) => r.id === 'urgent')).toBe(true)
    expect(recs.some((r) => r.id === 'standard-inclusion')).toBe(true)
  })
})
