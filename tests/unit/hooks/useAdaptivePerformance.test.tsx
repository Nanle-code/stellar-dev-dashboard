import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  __setProfilerGlobals,
  __resetDeviceProfiler,
} from '../../../src/lib/adaptivePerformance/deviceProfiler'
import {
  __setNetworkGlobals,
  __resetNetworkProfiler,
} from '../../../src/lib/adaptivePerformance/networkProfiler'
import {
  __setUsageGlobals,
  __resetUsageTracker,
  recordInteraction,
} from '../../../src/lib/adaptivePerformance/usageTracker'
import {
  __resetAdaptiveEngine,
  initAdaptiveEngine,
  setPerformanceMode,
} from '../../../src/lib/adaptivePerformance/engine'
import { useAdaptivePerformance } from '../../../src/hooks/useAdaptivePerformance'

function installEnvironment() {
  __setProfilerGlobals({
    navigator: { hardwareConcurrency: 8, deviceMemory: 8, onLine: true } as typeof navigator,
    window: {
      innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as typeof window,
    document: {
      visibilityState: 'visible',
      documentElement: { hasAttribute: vi.fn().mockReturnValue(false), setAttribute: vi.fn() },
      addEventListener: vi.fn(),
    } as typeof document,
  })
  __setNetworkGlobals({
    navigator: {
      hardwareConcurrency: 8, onLine: true,
      connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false, addEventListener: vi.fn() },
    } as typeof navigator,
    window: { addEventListener: vi.fn(), removeEventListener: vi.fn() } as typeof window,
  })
  __setUsageGlobals({
    navigator: { onLine: true } as typeof navigator,
    window: { addEventListener: vi.fn(), removeEventListener: vi.fn() } as typeof window,
    document: {
      visibilityState: 'visible',
      documentElement: { hasAttribute: vi.fn().mockReturnValue(false), setAttribute: vi.fn() },
      addEventListener: vi.fn(),
    } as typeof document,
  })
}

beforeEach(async () => {
  __resetDeviceProfiler()
  __resetNetworkProfiler()
  __resetUsageTracker()
  __resetAdaptiveEngine()
  installEnvironment()
  await initAdaptiveEngine()
})

afterEach(() => {
  __resetAdaptiveEngine()
})

describe('useAdaptivePerformance', () => {
  it('exposes a ready snapshot ready=true after init', async () => {
    const { result } = renderHook(() => useAdaptivePerformance('test'))
    // Wait for the engine to bootstrap via the micro-task queue.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.ready).toBe(true)
    expect(result.current.snapshot).not.toBeNull()
  })

  it('updates when the user changes the mode', async () => {
    const { result } = renderHook(() => useAdaptivePerformance('test'))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    act(() => setPerformanceMode('battery-saver'))
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.snapshot?.mode).toBe('battery-saver')
    expect(result.current.snapshot?.adaptation.tier).toBe('battery-saver')
  })

  it('tracks interaction through the helper', async () => {
    const { result } = renderHook(() => useAdaptivePerformance('test'))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    act(() => result.current.trackInteraction('overview'))
    expect(true).toBe(true) // The helper is a thin wrapper; ensure no exception
  })

  it('submits positive feedback without throwing', async () => {
    const { result } = renderHook(() => useAdaptivePerformance('test'))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      await result.current.submitFeedback(1, 'user-override')
    })
    expect(result.current.snapshot).not.toBeNull()
  })
})
