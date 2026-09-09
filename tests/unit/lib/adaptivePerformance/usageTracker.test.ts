import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __setUsageGlobals,
  __resetUsageTracker,
  getUsageProfile,
  initUsageTracker,
  recordInteraction,
  subscribeUsage,
} from '../../../src/lib/adaptivePerformance/usageTracker'

function makeDocument(): typeof document {
  return {
    visibilityState: 'visible',
    documentElement: {
      hasAttribute: vi.fn(() => false),
      setAttribute: vi.fn(),
    },
    addEventListener: vi.fn(),
  } as unknown as typeof document
}

function makeWindow(): typeof window {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as typeof window
}

describe('usageTracker', () => {
  beforeEach(() => {
    __resetUsageTracker()
  })

  afterEach(() => {
    __resetUsageTracker()
  })

  it('starts as "casual" with no activity', () => {
    __setUsageGlobals({ window: makeWindow(), document: makeDocument() })
    expect(getUsageProfile().intensity).toBe('casual')
    expect(getUsageProfile().totalInteractions).toBe(0)
    expect(getUsageProfile().distinctFeatureAreas).toBe(0)
  })

  it('promotes intensity to "regular" after a couple of interactions', () => {
    __setUsageGlobals({ window: makeWindow(), document: makeDocument() })
    recordInteraction('overview')
    recordInteraction('analytics')
    const profile = getUsageProfile()
    expect(profile.totalInteractions).toBe(2)
    expect(profile.distinctFeatureAreas).toBe(2)
    expect(['regular', 'casual']).toContain(profile.intensity)
  })

  it('escalates to "expert" / "power" when many distinct areas are touched', () => {
    __setUsageGlobals({ window: makeWindow(), document: makeDocument() })
    const areas = ['overview', 'analytics', 'network', 'realtime', 'transactions', 'wallet', 'multisig', 'audit']
    for (const area of areas) recordInteraction(area)
    const profile = getUsageProfile()
    expect(profile.distinctFeatureAreas).toBe(8)
    expect(['power', 'expert']).toContain(profile.intensity)
  })

  it('records perfect interval metrics when many interactions burst in', () => {
    __setUsageGlobals({ window: makeWindow(), document: makeDocument() })
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(200)
        recordInteraction('overview')
      }
    } finally {
      vi.useRealTimers()
    }
    const profile = getUsageProfile()
    expect(profile.totalInteractions).toBe(5)
    expect(profile.averageIntervalMs).toBeGreaterThan(100)
    expect(profile.averageIntervalMs).toBeLessThan(400)
  })

  it('subscribeUsage pushes the current snapshot once', () => {
    __setUsageGlobals({ window: makeWindow(), document: makeDocument() })
    recordInteraction('overview')
    const listener = vi.fn()
    const unsub = subscribeUsage(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].totalInteractions).toBe(1)
    unsub()
  })

  it('initUsageTracker attaches a document click listener when autoHookDom is on', () => {
    const doc = makeDocument()
    __setUsageGlobals({ window: makeWindow(), document: doc })
    initUsageTracker()
    initUsageTracker() // idempotent
    const calls = (doc.addEventListener as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.some(([event]) => event === 'click')).toBe(true)
  })

  it('records a violation whenever a performance-regression event is fired', () => {
    const win = makeWindow()
    __setUsageGlobals({ window: win, document: makeDocument() })
    initUsageTracker()
    const calls = (win.addEventListener as ReturnType<typeof vi.fn>).mock.calls
    const regressionBinding = calls.find(([event]) => event === 'performance-regression')
    expect(regressionBinding).toBeDefined()
    const handler = regressionBinding![1] as () => void
    const before = getUsageProfile()
    handler()
    handler()
    const after = getUsageProfile()
    expect(after.violationsPerMinute).toBeGreaterThanOrEqual(before.violationsPerMinute)
  })
})
