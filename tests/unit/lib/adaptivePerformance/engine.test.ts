import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __setProfilerGlobals,
  __resetDeviceProfiler,
  getDeviceProfile,
} from '../../../src/lib/adaptivePerformance/deviceProfiler'
import {
  __setNetworkGlobals,
  __resetNetworkProfiler,
  getNetworkProfile,
} from '../../../src/lib/adaptivePerformance/networkProfiler'
import {
  __setUsageGlobals,
  __resetUsageTracker,
  getUsageProfile,
  recordInteraction,
} from '../../../src/lib/adaptivePerformance/usageTracker'
import {
  __setAccuracyStorage,
  __resetAccuracyTracker,
} from '../../../src/lib/adaptivePerformance/accuracyTracker'
import {
  __resetAdaptiveEngine,
  initAdaptiveEngine,
  getAdaptiveSnapshot,
  setPerformanceMode,
  submitFeedback,
  subscribeAdaptiveEngine,
  refreshAdaptiveSnapshot,
  exportPredictorWeights,
  importPredictorWeights,
  resetPredictorWeights,
  lockAdaptation,
  unlockAdaptation,
  unlockAllAdaptations,
} from '../../../src/lib/adaptivePerformance/engine'

class MemoryStorage {
  store: Record<string, string> = {}
  getItem(key: string) { return this.store[key] ?? null }
  setItem(key: string, value: string) { this.store[key] = value }
  removeItem(key: string) { delete this.store[key] }
}

function installEnvironment(overrides: {
  navigator?: Record<string, unknown>
  window?: Record<string, unknown>
  document?: Record<string, unknown>
}) {
  __setProfilerGlobals({
    navigator: { hardwareConcurrency: 8, deviceMemory: 8, onLine: true, ...overrides.navigator } as typeof navigator,
    window: {
      innerWidth: 1280,
      innerHeight: 800,
      devicePixelRatio: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      ...overrides.window,
    } as typeof window,
    document: {
      visibilityState: 'visible',
      documentElement: { hasAttribute: vi.fn().mockReturnValue(false), setAttribute: vi.fn() },
      addEventListener: vi.fn(),
      ...overrides.document,
    } as typeof document,
  })
  __setNetworkGlobals({
    navigator: { hardwareConcurrency: 8, onLine: true, connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false, addEventListener: vi.fn() }, ...overrides.navigator } as typeof navigator,
    window: { addEventListener: vi.fn(), removeEventListener: vi.fn(), ...overrides.window } as typeof window,
  })
  __setUsageGlobals({
    navigator: { onLine: true, ...overrides.navigator } as typeof navigator,
    window: { addEventListener: vi.fn(), removeEventListener: vi.fn(), ...overrides.window } as typeof window,
    document: { visibilityState: 'visible', documentElement: { hasAttribute: vi.fn().mockReturnValue(false), setAttribute: vi.fn() }, addEventListener: vi.fn(), ...overrides.document } as typeof document,
  })
}

beforeEach(async () => {
  __resetAccuracyTracker()
  __setAccuracyStorage(new MemoryStorage())
  __resetDeviceProfiler()
  __resetNetworkProfiler()
  __resetUsageTracker()
  __resetAdaptiveEngine()
  installEnvironment({})
  await initAdaptiveEngine()
})

afterEach(() => {
  __resetAdaptiveEngine()
})

describe('adaptive engine', () => {
  it('produces a coherent snapshot for a high-end device on a fast network', async () => {
    const snapshot = await initAdaptiveEngine()
    expect(snapshot.device.tier).toBe('high')
    expect(snapshot.network.tier).toBe('fast')
    expect(['high', 'balanced']).toContain(snapshot.adaptation.tier)
    expect(snapshot.adaptation.maxConcurrentRequests).toBeGreaterThan(0)
  })

  it('forces the battery-saver tier when the user picks battery-saver mode', async () => {
    setPerformanceMode('battery-saver')
    const snapshot = getAdaptiveSnapshot()
    expect(snapshot.mode).toBe('battery-saver')
    expect(snapshot.adaptation.tier).toBe('battery-saver')
    expect(snapshot.adaptation.animatedTransitions).toBe(false)
    expect(snapshot.adaptation.backgroundSync).toBe(false)
  })

  it('forces a balanced tier under quality mode when the device is mid-spec', () => {
    // Override the device once the engine has initialised.
    __setProfilerGlobals({
      navigator: { hardwareConcurrency: 4, deviceMemory: 4, onLine: true } as typeof navigator,
      window: { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener: vi.fn(), removeEventListener: vi.fn() } as typeof window,
      document: { visibilityState: 'visible', documentElement: { hasAttribute: vi.fn().mockReturnValue(false), setAttribute: vi.fn() }, addEventListener: vi.fn() } as typeof document,
    })
    __setNetworkGlobals({
      navigator: { hardwareConcurrency: 4, onLine: true, connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false, addEventListener: vi.fn() } } as typeof navigator,
      window: { addEventListener: vi.fn(), removeEventListener: vi.fn() } as typeof window,
    })
    setPerformanceMode('quality')
    expect(getAdaptiveSnapshot().adaptation.tier).toBe('balanced')
  })

  it('emits fresh snapshots to subscribers', async () => {
    const listener = vi.fn()
    const unsub = subscribeAdaptiveEngine(listener)
    listener.mockClear()
    setPerformanceMode('battery-saver')
    expect(listener).toHaveBeenCalled()
    unsub()
  })

  it('updates usage signals when recordInteraction is invoked', () => {
    recordInteraction('network')
    recordInteraction('analytics')
    const profile = getUsageProfile()
    expect(profile.totalInteractions).toBe(2)
    expect(profile.distinctFeatureAreas).toBe(2)
  })

  it('learns from feedback — weights diverge from the initial baseline', async () => {
    const initial = exportPredictorWeights()
    for (let i = 0; i < 8; i++) {
      await submitFeedback(1, 'user-override', { tierOverride: 'battery-saver' })
    }
    const after = exportPredictorWeights()
    const totalDiff = after.weights.reduce((acc, w, idx) => acc + Math.abs(w - initial.weights[idx]), 0)
    expect(totalDiff).toBeGreaterThan(0)
  })

  it('reports the active locks after lockAdaptation / unlockAdaptation', () => {
    lockAdaptation('imageMaxWidth')
    expect(getAdaptiveSnapshot().locked).toContain('imageMaxWidth')
    unlockAdaptation('imageMaxWidth')
    expect(getAdaptiveSnapshot().locked).not.toContain('imageMaxWidth')
    lockAdaptation('animatedTransitions')
    expect(getAdaptiveSnapshot().locked).toContain('animatedTransitions')
    unlockAllAdaptations()
    expect(getAdaptiveSnapshot().locked).toEqual([])
  })

  it('refreshAdaptiveSnapshot returns a snapshot without throwing', async () => {
    const snapshot = await refreshAdaptiveSnapshot()
    expect(snapshot).toBeDefined()
    expect(snapshot.updatedAt).toBeTypeOf('number')
  })

  it('import and reset weights round-trip', () => {
    const weights = exportPredictorWeights()
    importPredictorWeights({ weights: weights.weights.map((w) => w * 1.5), bias: 0.123 })
    const reloaded = exportPredictorWeights()
    expect(reloaded.bias).toBeCloseTo(0.123)
    resetPredictorWeights()
    const reset = exportPredictorWeights()
    expect(reset.weights).toEqual(Array.from(weights.weights))
  })
})
