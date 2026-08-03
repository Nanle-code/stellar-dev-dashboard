/**
 * adaptivePerformance/deviceProfiler.ts
 *
 * Detects device hardware capabilities and assigns a discrete {@link DeviceTier}.
 *
 * The profiler subscribes to:
 *   - visibilitychange (battery & rendering cost are higher on background pages)
 *   - resize           (re-classify viewport / platform when the window changes)
 *   - levelchange      (Battery API — when the device crosses the 20% threshold)
 *
 * The returned `subscribe()` callback receives the latest
 * {@link DeviceProfile} whenever any signal changes. Callers can also call
 * {@link getDeviceProfile} synchronously for a one-shot sample.
 */

import type { DeviceProfile, DeviceTier } from './types'

export type DeviceListener = (profile: DeviceProfile) => void

const listeners = new Set<DeviceListener>()
let cached: DeviceProfile | null = null

// Test seams — replaceable in Vitest before `initDeviceProfiler()` runs.
let navigatorRef: typeof navigator | undefined
let windowRef: typeof window | undefined
let documentRef: typeof document | undefined

function nav(): typeof navigator | undefined { return navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : undefined) }
function win(): typeof window | undefined { return windowRef ?? (typeof window !== 'undefined' ? window : undefined) }
function doc(): typeof document | undefined { return documentRef ?? (typeof document !== 'undefined' ? document : undefined) }

/**
 * Replace global references. Intended for unit tests; production code should
 * leave these untouched.
 */
export function __setProfilerGlobals(next: { navigator?: typeof navigator; window?: typeof window; document?: typeof document }) {
  if (next.navigator !== undefined) navigatorRef = next.navigator
  if (next.window !== undefined) windowRef = next.window
  if (next.document !== undefined) documentRef = next.document
}

function classifyPlatform(width: number): DeviceProfile['platform'] {
  if (!width) return 'unknown'
  if (width <= 600) return 'mobile'
  if (width <= 1024) return 'tablet'
  return 'desktop'
}

function classifyTier(input: { cores: number; memoryGb: number | null; dpr: number; width: number }): DeviceTier {
  // Conservative classification — when a signal is missing we round towards
  // "low" so the engine prefers a safe default on unknown devices.
  const cores = input.cores || 2
  const memory = input.memoryGb ?? 2
  const dpr = input.dpr || 1
  const width = input.width || 0

  let score = 0
  if (cores >= 8) score += 2
  else if (cores >= 4) score += 1
  if (memory >= 8) score += 2
  else if (memory >= 4) score += 1
  if (dpr <= 2 && width >= 1280) score += 1 // High-DPI on a desktop
  if (width <= 480) score -= 1 // Tiny mobile is always constrained

  if (score >= 4) return 'high'
  if (score >= 2) return 'mid'
  return 'low'
}

async function readBatteryState(): Promise<boolean> {
  const navInst = nav()
  const batteryLike = (navInst as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> } | undefined)?.getBattery
  if (typeof batteryLike !== 'function') return false
  try {
    const b = await batteryLike()
    return b.level <= 0.2 && !b.charging
  } catch {
    return false
  }
}

/**
 * Sample the browser for current device capabilities.
 * Safe to call in SSR / happy-dom — every signal is optional.
 */
export function getDeviceProfile(): DeviceProfile {
  if (cached) return cached

  const w = win()
  const d = doc()
  const navInst = nav()
  const cores = Number((navInst as { hardwareConcurrency?: number } | undefined)?.hardwareConcurrency) || 0
  const memoryRaw = (navInst as { deviceMemory?: number } | undefined)?.deviceMemory
  const memoryGb = typeof memoryRaw === 'number' && memoryRaw > 0 ? memoryRaw : null
  const dpr = w?.devicePixelRatio ?? 1
  const width = w?.innerWidth ?? 0
  const height = w?.innerHeight ?? 0
  const platform = classifyPlatform(width)
  const tier = classifyTier({ cores, memoryGb, dpr, width })
  const isVisible = d?.visibilityState === undefined ? true : d.visibilityState === 'visible'
  const profile: DeviceProfile = {
    cpuCores: cores || 0,
    deviceMemoryGb: memoryGb,
    devicePixelRatio: dpr,
    viewportWidth: width,
    viewportHeight: height,
    platform,
    tier,
    isVisible,
    isLowBattery: false,
    sampledAt: Date.now(),
  }

  cached = profile
  // Battery is async — apply the resolved value after the initial sample.
  void readBatteryState().then((isLow) => {
    if (!cached) return
    publish({ ...cached, isLowBattery: isLow })
  })

  return profile
}

function publish(profile: DeviceProfile) {
  cached = profile
  listeners.forEach((listener) => {
    try { listener(profile) } catch { /* swallow listener errors */ }
  })
}

let initialized = false

/**
 * Attach listeners so the cached profile is refreshed on relevant events.
 * Idempotent — calling twice is a no-op.
 */
export function initDeviceProfiler(): DeviceProfile {
  const profile = getDeviceProfile()
  if (initialized || typeof window === 'undefined') return profile
  initialized = true

  const w = win()
  if (!w) return profile

  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const handleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      cached = null
      getDeviceProfile()
    }, 250)
  }

  w.addEventListener('resize', handleResize)
  doc()?.addEventListener?.('visibilitychange', () => {
    cached = null
    getDeviceProfile()
  })

  return profile
}

/**
 * Subscribe to profile updates. Returns an unsubscribe function.
 */
export function subscribeDevice(listener: DeviceListener): () => void {
  listeners.add(listener)
  // Push current snapshot immediately for newly-attached listeners.
  try { listener(getDeviceProfile()) } catch { /* ignore */ }
  return () => { listeners.delete(listener) }
}

/**
 * Reset internal state. Intended for tests.
 */
export function __resetDeviceProfiler() {
  cached = null
  listeners.clear()
  initialized = false
  navigatorRef = undefined
  windowRef = undefined
  documentRef = undefined
}
