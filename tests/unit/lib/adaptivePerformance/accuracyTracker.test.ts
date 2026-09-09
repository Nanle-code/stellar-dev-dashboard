import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  __resetAccuracyTracker,
  __setAccuracyStorage,
  initAccuracyTracker,
  recordFeedback,
  getAccuracyReport,
  clearAccuracyHistory,
  getDecisionCount,
} from '../../../src/lib/adaptivePerformance/accuracyTracker'

class MemoryStorage {
  store: Record<string, string> = {}

  getItem(key: string): string | null { return this.store[key] ?? null }
  setItem(key: string, value: string): void { this.store[key] = value }
  removeItem(key: string): void { delete this.store[key] }
  clear(): void { this.store = {} }
  key(): string | null { return null }
  get length(): number { return Object.keys(this.store).length }
}

const memoryStorage = new MemoryStorage()

describe('accuracyTracker', () => {
  beforeEach(async () => {
    memoryStorage.clear()
    __setAccuracyStorage(memoryStorage)
    __resetAccuracyTracker()
    await initAccuracyTracker()
  })

  afterEach(async () => {
    await clearAccuracyHistory()
    __resetAccuracyTracker()
  })

  it('starts empty', () => {
    const report = getAccuracyReport()
    expect(report.total).toBe(0)
    expect(report.accuracy).toBeUndefined()
    expect(getDecisionCount()).toBe(0)
  })

  it('reports 100% accuracy when all decisions are correct', async () => {
    for (let i = 0; i < 10; i++) {
      await recordFeedback({ tier: 'high', source: 'metric-resolution', outcome: 1, timestamp: i })
    }
    const report = getAccuracyReport()
    expect(report.total).toBe(10)
    expect(report.correct).toBe(10)
    expect(report.accuracy).toBe(1)
  })

  it('dips below the 90% acceptance bar when failures pile up', async () => {
    for (let i = 0; i < 8; i++) {
      await recordFeedback({ tier: 'high', source: 'metric-resolution', outcome: 1, timestamp: i })
    }
    await recordFeedback({ tier: 'high', source: 'user-override', outcome: 0, timestamp: 10 })
    await recordFeedback({ tier: 'high', source: 'metric-violation', outcome: 0, timestamp: 11 })
    const report = getAccuracyReport()
    expect(report.total).toBe(11)
    // 8 TP + 1 FP + 1 FN + 0 TN => correct = 8
    expect(report.correct).toBe(8)
    expect(report.accuracy).toBeCloseTo(8 / 11, 5)
    expect(report.accuracy ?? 0).toBeLessThan(0.9)
  })

  it('persists between hydration cycles', async () => {
    await recordFeedback({ tier: 'balanced', source: 'metric-resolution', outcome: 1, timestamp: 0 })
    await recordFeedback({ tier: 'battery-saver', source: 'user-override', outcome: 0, timestamp: 1 })
    const report = getAccuracyReport()
    expect(report.total).toBe(2)
    expect(memoryStorage.store['adaptive-accuracy-v1']).toBeDefined()

    // Re-boot the tracker and confirm the history is restored.
    __resetAccuracyTracker()
    await initAccuracyTracker()
    const report2 = getAccuracyReport()
    expect(report2.total).toBe(2)
    expect(report2.outcomeCounts.truePositive).toBeGreaterThanOrEqual(1)
  })

  it('caps the rolling history to 100 entries', async () => {
    for (let i = 0; i < 150; i++) {
      await recordFeedback({ tier: 'high', source: 'metric-resolution', outcome: 1, timestamp: i })
    }
    expect(getDecisionCount()).toBe(100)
  })

  it('treats clearing as a successful reset', async () => {
    await recordFeedback({ tier: 'high', source: 'user-override', outcome: 0, timestamp: 0 })
    await clearAccuracyHistory()
    expect(getDecisionCount()).toBe(0)
  })
})
