import { describe, it, expect } from 'vitest'
import { PerformancePredictor, DEFAULT_WEIGHTS, DEFAULT_BIAS } from '../../../src/lib/adaptivePerformance/predictor'
import type { DeviceProfile, NetworkProfile, UsageProfile } from '../../../src/lib/adaptivePerformance/types'

function makeDevice(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    cpuCores: 8,
    deviceMemoryGb: 8,
    devicePixelRatio: 1,
    viewportWidth: 1280,
    viewportHeight: 800,
    platform: 'desktop',
    tier: 'high',
    isVisible: true,
    isLowBattery: false,
    sampledAt: 0,
    ...overrides,
  }
}

function makeNetwork(overrides: Partial<NetworkProfile> = {}): NetworkProfile {
  return {
    effectiveType: '4g',
    downlinkMbps: 10,
    rttMs: 50,
    saveData: false,
    measuredLatencyMs: null,
    measuredThroughputMs: null,
    tier: 'fast',
    isOffline: false,
    sampledAt: 0,
    ...overrides,
  }
}

function makeUsage(overrides: Partial<UsageProfile> = {}): UsageProfile {
  return {
    totalInteractions: 0,
    distinctFeatureAreas: 0,
    averageIntervalMs: 0,
    violationsPerMinute: 0,
    intensity: 'casual',
    sessionStartedAt: 0,
    sampledAt: 0,
    ...overrides,
  }
}

describe('PerformancePredictor', () => {
  it('exposes the well-formed default weights and bias', () => {
    expect(DEFAULT_WEIGHTS).toHaveLength(7)
    expect(DEFAULT_BIAS).toBeTypeOf('number')
  })

  it('predicts "high" tier for a powerful device with a fast network and casual usage', () => {
    const predictor = new PerformancePredictor()
    const result = predictor.predict(makeDevice(), makeNetwork(), makeUsage())
    expect(result.tier).toBe('high')
    expect(result.stress).toBeGreaterThanOrEqual(0)
    expect(result.stress).toBeLessThanOrEqual(1)
  })

  it('predicts "battery-saver" tier on a low device with a slow network', () => {
    const predictor = new PerformancePredictor()
    const result = predictor.predict(
      makeDevice({ tier: 'low', cpuCores: 1, deviceMemoryGb: 0.5, viewportWidth: 320, platform: 'mobile' }),
      makeNetwork({ effectiveType: 'slow-2g', rttMs: 1500, tier: 'slow' }),
      makeUsage({ intensity: 'casual' })
    )
    expect(result.tier).toBe('battery-saver')
  })

  it('respects saveData flag aggressively', () => {
    const predictor = new PerformancePredictor()
    const result = predictor.predict(
      makeDevice(),
      makeNetwork({ saveData: true, tier: 'slow' }),
      makeUsage()
    )
    expect(result.tier).toBe('battery-saver')
  })

  it('respects isLowBattery even on a powerful device', () => {
    const predictor = new PerformancePredictor()
    const result = predictor.predict(
      makeDevice({ isLowBattery: true }),
      makeNetwork(),
      makeUsage()
    )
    expect(result.tier).toBe('battery-saver')
  })

  it('passes a clamped confidence score', () => {
    const predictor = new PerformancePredictor({ weights: new Array(7).fill(0), bias: 0 })
    const result = predictor.predict(makeDevice(), makeNetwork(), makeUsage())
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('moves the model closer to a target tier on positive feedback', () => {
    const predictor = new PerformancePredictor()
    const device = makeDevice()
    const network = makeNetwork()
    const usage = makeUsage()
    const before = predictor.exportWeights()
    predictor.observe({ tier: 'battery-saver', source: 'user-override', outcome: 1, timestamp: 0 }, device, network, usage)
    const after = predictor.exportWeights()
    const totalDiff = after.weights.reduce((acc, w, i) => acc + Math.abs(w - before.weights[i]), 0)
    expect(totalDiff).toBeGreaterThan(0)
    expect(after.observationCount).toBe(1)
  })

  it('produces a balanced prediction when features are mixed', () => {
    const predictor = new PerformancePredictor()
    const result = predictor.predict(
      makeDevice({ tier: 'mid', cpuCores: 4 }),
      makeNetwork({ tier: 'moderate', effectiveType: '3g', rttMs: 250 }),
      makeUsage({ intensity: 'regular' })
    )
    expect(['balanced', 'high']).toContain(result.tier)
  })

  it('hides engagement beyond the observation cap', () => {
    const predictor = new PerformancePredictor()
    for (let i = 0; i < 10_010; i++) {
      predictor.observe(
        { tier: 'high', source: 'user-override', outcome: 1, timestamp: i },
        makeDevice(),
        makeNetwork(),
        makeUsage()
      )
    }
    expect(predictor.exportWeights().observationCount).toBe(10_000)
  })

  it('importWeights replaces model parameters', () => {
    const predictor = new PerformancePredictor()
    const before = predictor.exportWeights()
    predictor.importWeights({ weights: before.weights.map(() => 0.5), bias: 0.25 })
    const after = predictor.exportWeights()
    expect(after.weights.every((w) => Math.abs(w - 0.5) < 1e-9)).toBe(true)
    expect(after.bias).toBeCloseTo(0.25)
  })
})
