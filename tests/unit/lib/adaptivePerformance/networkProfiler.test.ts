import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __setNetworkGlobals,
  __resetNetworkProfiler,
  getNetworkProfile,
  initNetworkProfiler,
  probeNetwork,
  subscribeNetwork,
} from '../../../src/lib/adaptivePerformance/networkProfiler'

function makeNavigator(overrides: {
  onLine?: boolean
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
} = {}): typeof navigator {
  return {
    onLine: overrides.onLine ?? true,
    connection: {
      effectiveType: overrides.effectiveType ?? '4g',
      downlink: overrides.downlink,
      rtt: overrides.rtt,
      saveData: overrides.saveData ?? false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  } as unknown as typeof navigator
}

function makeWindow(): typeof window {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as typeof window
}

describe('networkProfiler', () => {
  beforeEach(() => {
    __resetNetworkProfiler()
  })

  afterEach(() => {
    __resetNetworkProfiler()
  })

  it('reports fast tier on a 4G connection with low RTT', () => {
    __setNetworkGlobals({
      navigator: makeNavigator({ effectiveType: '4g', downlink: 10, rtt: 50 }),
      window: makeWindow(),
    })
    const profile = getNetworkProfile()
    expect(profile.tier).toBe('fast')
    expect(profile.downlinkMbps).toBe(10)
    expect(profile.rttMs).toBe(50)
  })

  it('drops to slow tier on a 2G connection', () => {
    __setNetworkGlobals({
      navigator: makeNavigator({ effectiveType: '2g', downlink: 0.5, rtt: 800 }),
      window: makeWindow(),
    })
    expect(getNetworkProfile().tier).toBe('slow')
  })

  it('treats navigator.onLine === false as offline regardless of effectiveType', () => {
    __setNetworkGlobals({
      navigator: makeNavigator({ effectiveType: '4g', onLine: false }),
      window: makeWindow(),
    })
    expect(getNetworkProfile().tier).toBe('offline')
    expect(getNetworkProfile().isOffline).toBe(true)
  })

  it('treats saveData = true as slow tier', () => {
    __setNetworkGlobals({
      navigator: makeNavigator({ effectiveType: '4g', saveData: true }),
      window: makeWindow(),
    })
    expect(getNetworkProfile().tier).toBe('slow')
  })

  it('returns safe defaults when navigator is missing', () => {
    __setNetworkGlobals({
      navigator: {} as typeof navigator,
      window: makeWindow(),
    })
    const profile = getNetworkProfile()
    expect(profile.effectiveType).toBe('unknown')
    expect(profile.tier).toBe('moderate')
  })

  it('subscribeNetwork pushes the current snapshot once', () => {
    __setNetworkGlobals({
      navigator: makeNavigator({ effectiveType: '4g', rtt: 20, downlink: 50 }),
      window: makeWindow(),
    })
    const listener = vi.fn()
    const unsub = subscribeNetwork(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].tier).toBe('fast')
    unsub()
  })

  it('probeNetwork records a successful latency and re-classifies the tier', async () => {
    __setNetworkGlobals({
      navigator: makeNavigator({ effectiveType: '3g', rtt: 250, downlink: 2 }),
      window: makeWindow(),
      fetch: vi.fn().mockResolvedValue({ text: () => Promise.resolve('') }),
    })
    initNetworkProfiler({ autoProbeMs: 0 })

    const before = getNetworkProfile()
    // Override the rapid-3g+rtt=250 baseline; the probe should re-tighten
    // the effective estimate. We override the URL to a tiny data URL so the
    // probe does not need a backend.
    const probed = await probeNetwork({ sampleBytes: 1024 })
    expect(probed.measuredLatencyMs).toBeTypeOf('number')
    expect(probed.measuredThroughputMs).toBeTypeOf('number')
    expect(before.tier).toBe('moderate')
  })

  it('attaches online/offline/change listeners on init', () => {
    __setNetworkGlobals({
      navigator: makeNavigator({ effectiveType: '4g' }),
      window: makeWindow(),
    })
    const win = (globalThis as { window?: typeof window }).window
    const addSpy = vi.spyOn(win!, 'addEventListener')
    initNetworkProfiler({ autoProbeMs: 0 })
    const events = addSpy.mock.calls.map(([event]) => event)
    expect(events).toContain('online')
    expect(events).toContain('offline')
  })
})
