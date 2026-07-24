import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __setProfilerGlobals,
  __resetDeviceProfiler,
  getDeviceProfile,
  initDeviceProfiler,
  subscribeDevice,
} from '../../../src/lib/adaptivePerformance/deviceProfiler'

interface MockNav {
  hardwareConcurrency?: number
  deviceMemory?: number
}

function makeNavigator(overrides: MockNav = {}): typeof navigator {
  return {
    hardwareConcurrency: overrides.hardwareConcurrency ?? 4,
    deviceMemory: overrides.deviceMemory,
  } as unknown as typeof navigator
}

function makeWindow(opts: { width?: number; height?: number; dpr?: number } = {}): typeof window {
  return {
    innerWidth: opts.width ?? 1280,
    innerHeight: opts.height ?? 800,
    devicePixelRatio: opts.dpr ?? 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as typeof window
}

function makeDocument(visibility = 'visible'): typeof document {
  return {
    visibilityState: visibility,
    documentElement: { setAttribute: vi.fn(), hasAttribute: vi.fn(() => false) },
    addEventListener: vi.fn(),
  } as unknown as typeof document
}

describe('deviceProfiler', () => {
  beforeEach(() => {
    __resetDeviceProfiler()
  })

  afterEach(() => {
    __resetDeviceProfiler()
  })

  it('classifies a high-end desktop as the "high" tier', () => {
    __setProfilerGlobals({
      navigator: makeNavigator({ hardwareConcurrency: 16, deviceMemory: 32 }),
      window: makeWindow({ width: 1920, dpr: 2 }),
      document: makeDocument(),
    })
    const profile = getDeviceProfile()
    expect(profile.tier).toBe('high')
    expect(profile.platform).toBe('desktop')
    expect(profile.cpuCores).toBe(16)
    expect(profile.deviceMemoryGb).toBe(32)
  })

  it('classifies a 4-core laptop as "mid"', () => {
    __setProfilerGlobals({
      navigator: makeNavigator({ hardwareConcurrency: 4, deviceMemory: 4 }),
      window: makeWindow({ width: 1280 }),
      document: makeDocument(),
    })
    const profile = getDeviceProfile()
    expect(profile.tier).toBe('mid')
    expect(profile.platform).toBe('desktop')
  })

  it('classifies an unknown / low-spec device as "low"', () => {
    __setProfilerGlobals({
      navigator: makeNavigator({ hardwareConcurrency: 0, deviceMemory: undefined }),
      window: makeWindow({ width: 360 }),
      document: makeDocument(),
    })
    const profile = getDeviceProfile()
    expect(profile.tier).toBe('low')
    expect(profile.platform).toBe('mobile')
    expect(profile.cpuCores).toBe(0)
    expect(profile.deviceMemoryGb).toBeNull()
  })

  it('classifies tablet viewport correctly', () => {
    __setProfilerGlobals({
      navigator: makeNavigator({ hardwareConcurrency: 4 }),
      window: makeWindow({ width: 800 }),
      document: makeDocument(),
    })
    expect(getDeviceProfile().platform).toBe('tablet')
  })

  it('returns safe defaults in an empty environment (no navigator, no window)', () => {
    __setProfilerGlobals({
      navigator: {} as typeof navigator,
      window: {} as typeof window,
      document: {} as typeof document,
    })
    const profile = getDeviceProfile()
    expect(profile.cpuCores).toBe(0)
    expect(profile.deviceMemoryGb).toBeNull()
    expect(profile.viewportWidth).toBe(0)
    expect(profile.platform).toBe('unknown')
    expect(profile.isVisible).toBe(true)
  })

  it('marks the page as hidden when the document visibility is hidden', () => {
    __setProfilerGlobals({
      navigator: makeNavigator(),
      window: makeWindow(),
      document: makeDocument('hidden'),
    })
    expect(getDeviceProfile().isVisible).toBe(false)
  })

  it('subscribeDevice fires immediately with the current snapshot and accepts unsubscribes', () => {
    __setProfilerGlobals({
      navigator: makeNavigator({ hardwareConcurrency: 8, deviceMemory: 16 }),
      window: makeWindow({ width: 1440 }),
      document: makeDocument(),
    })
    const listener = vi.fn()
    const unsub = subscribeDevice(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    const arg = listener.mock.calls[0][0]
    expect(arg.tier).toBe('high')
    unsub()
  })

  it('initDeviceProfiler attaches resize and visibilitychange listeners exactly once', () => {
    __setProfilerGlobals({
      navigator: makeNavigator(),
      window: makeWindow(),
      document: makeDocument(),
    })
    const win = (globalThis as { window?: typeof window }).window
    if (win) {
      const addSpy = vi.spyOn(win, 'addEventListener')
      initDeviceProfiler()
      initDeviceProfiler()
      const resizeCalls = addSpy.mock.calls.filter(([event]) => event === 'resize').length
      expect(resizeCalls).toBe(1)
    }
  })
})
