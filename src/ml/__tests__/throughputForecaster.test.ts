import { describe, it, expect, beforeEach } from 'vitest'
import ThroughputForecaster from '../throughputForecaster'

function makeLedger(overrides: Record<string, unknown> = {}) {
  return {
    sequence: 1000 + Math.floor(Math.random() * 1000),
    operation_count: Math.floor(Math.random() * 500),
    successful_transaction_count: Math.floor(Math.random() * 300),
    failed_transaction_count: Math.floor(Math.random() * 20),
    close_time: 5.0,
    closed_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    ...overrides,
  }
}

describe('ThroughputForecaster', () => {
  let forecaster: ThroughputForecaster

  beforeEach(() => {
    forecaster = new ThroughputForecaster()
  })

  it('initializes with default config', () => {
    expect(forecaster).toBeDefined()
    expect(forecaster.history).toHaveLength(0)
    expect(forecaster.fitted).toBe(false)
  })

  it('initializes with custom config', () => {
    const custom = new ThroughputForecaster({
      smoothingAlpha: 0.5,
      smoothingBeta: 0.2,
      minDataPoints: 5,
      ledgerCapacity: 2000,
    })
    expect(custom.smoothingAlpha).toBe(0.5)
    expect(custom.smoothingBeta).toBe(0.2)
    expect(custom.minDataPoints).toBe(5)
    expect(custom.ledgerCapacity).toBe(2000)
  })

  it('adds ledger data', () => {
    const ledger = makeLedger({ operation_count: 200, successful_transaction_count: 150 })
    forecaster.addLedgerData(ledger)
    expect(forecaster.history).toHaveLength(1)
    expect(forecaster.history[0].ops).toBe(200)
    expect(forecaster.history[0].txCount).toBe(150)
  })

  it('computes TPS and congestion ratio', () => {
    const ledger = makeLedger({ operation_count: 500, successful_transaction_count: 300, close_time: 5.0 })
    forecaster.addLedgerData(ledger)
    expect(forecaster.history[0].tps).toBe(60)
    expect(forecaster.history[0].opsPerSecond).toBe(100)
    expect(forecaster.history[0].congestionRatio).toBe(0.5)
  })

  it('limits history to 500 entries', () => {
    for (let i = 0; i < 510; i++) {
      forecaster.addLedgerData(makeLedger())
    }
    expect(forecaster.history).toHaveLength(500)
  })

  it('returns false when insufficient data to fit', () => {
    for (let i = 0; i < 5; i++) {
      forecaster.addLedgerData(makeLedger({ operation_count: 100, successful_transaction_count: 80 }))
    }
    const result = forecaster.fit()
    expect(result).toBe(false)
    expect(forecaster.fitted).toBe(false)
  })

  it('fits model with sufficient data', () => {
    for (let i = 0; i < 15; i++) {
      forecaster.addLedgerData(makeLedger({
        operation_count: 200 + i * 10,
        successful_transaction_count: 150 + i * 8,
        close_time: 5.0,
      }))
    }
    const result = forecaster.fit()
    expect(result).toBe(true)
    expect(forecaster.fitted).toBe(true)
  })

  it('generates forecast after fitting', () => {
    for (let i = 0; i < 20; i++) {
      forecaster.addLedgerData(makeLedger({
        operation_count: 200 + i * 5,
        successful_transaction_count: 150 + i * 4,
        close_time: 5.0,
      }))
    }
    const forecast = forecaster.forecast(10)
    expect(forecast.predictions).toHaveLength(10)
    expect(forecast.currentLevel).toBeGreaterThanOrEqual(0)
    expect(forecast.dataPoints).toBe(20)
    expect(forecast.forecastPeriods).toBe(10)
    expect(['increasing', 'decreasing', 'stable']).toContain(forecast.trendDirection)
    expect(forecast.fitQuality).toBeGreaterThanOrEqual(0)
    expect(forecast.fitQuality).toBeLessThanOrEqual(1)
  })

  it('predictions have valid structure', () => {
    for (let i = 0; i < 15; i++) {
      forecaster.addLedgerData(makeLedger({
        operation_count: 300,
        successful_transaction_count: 200,
        close_time: 5.0,
      }))
    }
    const forecast = forecaster.forecast(5)
    for (const pred of forecast.predictions) {
      expect(pred.horizon).toBeGreaterThan(0)
      expect(pred.predictedTps).toBeGreaterThanOrEqual(0)
      expect(pred.predictedOps).toBeGreaterThanOrEqual(0)
      expect(pred.lowerBound).toBeLessThanOrEqual(pred.predictedTps)
      expect(pred.upperBound).toBeGreaterThanOrEqual(pred.predictedTps)
      expect(pred.congestionUtilization).toBeGreaterThanOrEqual(0)
      expect(pred.congestionUtilization).toBeLessThanOrEqual(1)
    }
  })

  it('forecast capacity utilization', () => {
    for (let i = 0; i < 20; i++) {
      forecaster.addLedgerData(makeLedger({
        operation_count: 400,
        successful_transaction_count: 250,
        close_time: 5.0,
      }))
    }
    const capacity = forecaster.forecastCapacityUtilization(1)
    expect(capacity.currentUtilization).toBeGreaterThanOrEqual(0)
    expect(capacity.currentUtilization).toBeLessThanOrEqual(1)
    expect(capacity.avgUtilization).toBeGreaterThanOrEqual(0)
    expect(capacity.maxUtilization).toBeGreaterThanOrEqual(0)
    expect(capacity.timeHorizonHours).toBe(1)
    expect(['capacity-constrained', 'moderate-load', 'normal']).toContain(capacity.scalingScenario)
  })

  it('analyzes scaling scenario', () => {
    for (let i = 0; i < 25; i++) {
      forecaster.addLedgerData(makeLedger({
        operation_count: 200 + Math.floor(Math.random() * 100),
        successful_transaction_count: 150 + Math.floor(Math.random() * 80),
        close_time: 5.0,
      }))
    }
    const analysis = forecaster.analyzeScalingScenario()
    expect(['normal', 'approaching-capacity', 'critical', 'declining', 'insufficient-data']).toContain(analysis.scenario)
    expect(analysis.recommendation).toBeDefined()
  })

  it('returns insufficient-data for scaling when data too low', () => {
    for (let i = 0; i < 5; i++) {
      forecaster.addLedgerData(makeLedger())
    }
    const analysis = forecaster.analyzeScalingScenario()
    expect(analysis.scenario).toBe('insufficient-data')
  })

  it('saves and loads model state', () => {
    for (let i = 0; i < 20; i++) {
      forecaster.addLedgerData(makeLedger({
        operation_count: 250,
        successful_transaction_count: 180,
        close_time: 5.0,
      }))
    }
    forecaster.fit()
    const state = forecaster.save()
    expect(state.level).toBeDefined()
    expect(state.trend).toBeDefined()
    expect(state.history).toHaveLength(20)

    const loaded = ThroughputForecaster.load(state)
    expect(loaded.level).toBe(forecaster.level)
    expect(loaded.trend).toBe(forecaster.trend)
    expect(loaded.history).toHaveLength(20)
    expect(loaded.fitted).toBe(true)
  })

  it('generates default forecast with insufficient data', () => {
    const forecast = forecaster.forecast(5)
    expect(forecast.predictions).toHaveLength(5)
    expect(forecast.trendDirection).toBe('unknown')
    expect(forecast.fitQuality).toBe(0)
  })

  it('trend detection works', () => {
    const increasing = new ThroughputForecaster({ minDataPoints: 10 })
    for (let i = 0; i < 15; i++) {
      increasing.addLedgerData(makeLedger({
        operation_count: 100 + i * 30,
        successful_transaction_count: 80 + i * 25,
        close_time: 5.0,
      }))
    }
    const incForecast = increasing.forecast(5)
    expect(incForecast.trendDirection).toBe('increasing')

    const decreasing = new ThroughputForecaster({ minDataPoints: 10 })
    for (let i = 0; i < 15; i++) {
      decreasing.addLedgerData(makeLedger({
        operation_count: 500 - i * 25,
        successful_transaction_count: 400 - i * 20,
        close_time: 5.0,
      }))
    }
    const decForecast = decreasing.forecast(5)
    expect(decForecast.trendDirection).toBe('decreasing')
  })

  it('handles zero close_time gracefully', () => {
    const ledger = makeLedger({ operation_count: 100, successful_transaction_count: 80, close_time: 0 })
    forecaster.addLedgerData(ledger)
    expect(forecaster.history[0].tps).toBe(16)
    expect(forecaster.history[0].opsPerSecond).toBe(20)
  })

  it('handles missing ledger fields gracefully', () => {
    forecaster.addLedgerData({})
    expect(forecaster.history).toHaveLength(1)
    expect(forecaster.history[0].ops).toBe(0)
    expect(forecaster.history[0].tps).toBe(0)
  })
})
