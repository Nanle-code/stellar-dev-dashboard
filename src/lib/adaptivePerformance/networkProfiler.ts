/**
 * adaptivePerformance/networkProfiler.ts
 *
 * Monitors the network connection quality and assigns a
 * {@link NetworkTier}.
 *
 * Combines three signals:
 *   1. The browser's Network Information API (`navigator.connection`)
 *   2. Active probes — measures the latency of a tiny GET request
 *   3. `online`/`offline` events
 *
 * Subscribers receive the latest profile whenever any signal changes.
 */

import type { NetworkProfile, NetworkTier } from './types'

export type NetworkListener = (profile: NetworkProfile) => void

const listeners = new Set<NetworkListener>()
let cached: NetworkProfile | null = null
let initialized = false
let probeTimers: Array<ReturnType<typeof setTimeout>> = []
let activeIntervals: Array<ReturnType<typeof setInterval>> = []
// Tracks in-flight probes so a reset can cancel their post-resolution
// `publish` call if the test blows away the module state mid-fetch.
const inFlightProbes = new Set<Promise<unknown>>()
let isResetting = false

// Test seams.
let navigatorRef: typeof navigator | undefined
let windowRef: typeof window | undefined
let fetchRef: typeof fetch | undefined

function nav(): typeof navigator | undefined {
  return navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : undefined)
}
function win(): typeof window | undefined {
  return windowRef ?? (typeof window !== 'undefined' ? window : undefined)
}
function fetcher(): typeof fetch | undefined {
  return fetchRef ?? (typeof fetch !== 'undefined' ? fetch : undefined)
}

/**
 * Replace global references. Intended for unit tests.
 */
export function __setNetworkGlobals(
  next: { navigator?: typeof navigator; window?: typeof window; fetch?: typeof fetch }
) {
  if (next.navigator !== undefined) navigatorRef = next.navigator
  if (next.window !== undefined) windowRef = next.window
  if (next.fetch !== undefined) fetchRef = next.fetch
}

function classifyTier(input: {
  effectiveType: NetworkProfile['effectiveType']
  downlinkMbps: number | null
  rttMs: number | null
  measuredLatencyMs: number | null
  saveData: boolean
  isOffline: boolean
}): NetworkTier {
  if (input.isOffline) return 'offline'
  if (input.saveData) return 'slow'

  const rtt = input.measuredLatencyMs ?? input.rttMs ?? Infinity
  const downlink = input.downlinkMbps ?? null

  if (input.effectiveType === 'slow-2g' || input.effectiveType === '2g') return 'slow'
  if (rtt >= 600) return 'slow'
  if (downlink !== null && downlink < 1.5) return 'slow'

  if (input.effectiveType === '3g' || rtt >= 200 || (downlink !== null && downlink < 5)) return 'moderate'
  if (input.effectiveType === '4g' || input.effectiveType === '5g') return 'fast'
  if (rtt < 200 && (downlink === null || downlink >= 5)) return 'fast'

  return 'moderate'
}

function readConnectionMeta(): {
  effectiveType: NetworkProfile['effectiveType']
  downlinkMbps: number | null
  rttMs: number | null
  saveData: boolean
} {
  const navInst = nav()
  if (!navInst) return { effectiveType: 'unknown', downlinkMbps: null, rttMs: null, saveData: false }
  const conn = (navInst as unknown as {
    connection?: {
      effectiveType?: string
      downlink?: number
      rtt?: number
      saveData?: boolean
    }
  } | undefined)?.connection
  if (!conn) return { effectiveType: 'unknown', downlinkMbps: null, rttMs: null, saveData: false }
  const allowed = ['slow-2g', '2g', '3g', '4g', '5g'] as const
  const et = (allowed as readonly string[]).includes(conn.effectiveType ?? '')
    ? (conn.effectiveType as NetworkProfile['effectiveType'])
    : 'unknown'
  return {
    effectiveType: et,
    downlinkMbps: typeof conn.downlink === 'number' ? conn.downlink : null,
    rttMs: typeof conn.rtt === 'number' ? conn.rtt : null,
    saveData: Boolean(conn.saveData),
  }
}

export function getNetworkProfile(): NetworkProfile {
  if (cached) return cached
  const navInst = nav()
  const isOffline = navInst?.onLine === false
  const meta = readConnectionMeta()
  const tier = classifyTier({
    effectiveType: meta.effectiveType,
    downlinkMbps: meta.downlinkMbps,
    rttMs: meta.rttMs,
    measuredLatencyMs: null,
    saveData: meta.saveData,
    isOffline,
  })
  cached = {
    effectiveType: meta.effectiveType,
    downlinkMbps: meta.downlinkMbps,
    rttMs: meta.rttMs,
    saveData: meta.saveData,
    measuredLatencyMs: null,
    measuredThroughputMs: null,
    tier,
    isOffline,
    sampledAt: Date.now(),
  }
  return cached
}

function publish(profile: NetworkProfile) {
  cached = profile
  listeners.forEach((listener) => {
    try { listener(profile) } catch { /* ignore */ }
  })
}

function refreshMetadataOnly() {
  const current = cached
  const meta = readConnectionMeta()
  const navInst = nav()
  const isOffline = navInst?.onLine === false
  const next: NetworkProfile = {
    ...(current ?? getNetworkProfile()),
    effectiveType: meta.effectiveType,
    downlinkMbps: meta.downlinkMbps,
    rttMs: meta.rttMs,
    saveData: meta.saveData,
    isOffline,
    tier: classifyTier({
      effectiveType: meta.effectiveType,
      downlinkMbps: meta.downlinkMbps,
      rttMs: meta.rttMs,
      measuredLatencyMs: current?.measuredLatencyMs ?? null,
      saveData: meta.saveData,
      isOffline,
    }),
    sampledAt: Date.now(),
  }
  publish(next)
}

/**
 * Probes the network by issuing a tiny HEAD/GET request and recording the
 * resulting latency. Designed to be cheap (32-byte canvas data URL by default
 * so we do not require a real backend endpoint).
 */
export async function probeNetwork(options: { sampleBytes?: number; timeoutMs?: number } = {}): Promise<NetworkProfile> {
  const profile = getNetworkProfile()
  if (profile.isOffline) return profile

  const fetchImpl = fetcher()
  const sampleBytes = Math.max(1024, options.sampleBytes ?? 32 * 1024)
  const timeoutMs = options.timeoutMs ?? 4000

  if (typeof fetchImpl !== 'function') {
    // No fetch — keep metadata-only view.
    return profile
  }

  const url = sampleBytes > 1024
    ? `/api/__adaptive_probe__?t=${Date.now()}&size=${sampleBytes}`
    : `data:text/plain;base64,${'A'.repeat(Math.ceil(sampleBytes * 0.75))}`

  const startedAt = performance.now?.() ?? Date.now()
  const probe: Promise<NetworkProfile> = (async () => {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
      const tid = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined
      const res = await fetchImpl(url, { method: 'GET', cache: 'no-store', signal: controller?.signal })
      if (tid !== undefined) clearTimeout(tid)
      await res.text?.().catch(() => null)
      const elapsed = (performance.now?.() ?? Date.now()) - startedAt

      const next: NetworkProfile = {
        ...profile,
        measuredLatencyMs: Math.round(elapsed),
        measuredThroughputMs: Math.round(elapsed),
        tier: classifyTier({
          effectiveType: profile.effectiveType,
          downlinkMbps: profile.downlinkMbps,
          rttMs: profile.rttMs,
          measuredLatencyMs: elapsed,
          saveData: profile.saveData,
          isOffline: false,
        }),
        sampledAt: Date.now(),
      }
      if (!isResetting) publish(next)
      return next
    } catch {
      return profile
    }
  })()

  inFlightProbes.add(probe)
  probe.finally(() => inFlightProbes.delete(probe))
  return probe
}

export function initNetworkProfiler(options: { autoProbeMs?: number } = {}): NetworkProfile {
  const profile = getNetworkProfile()
  if (initialized) return profile
  if (typeof window === 'undefined') return profile
  initialized = true

  const w = win()
  if (!w) return profile

  w.addEventListener('online', refreshMetadataOnly)
  w.addEventListener('offline', refreshMetadataOnly)

  // When the underlying connection object reports a change.
  const navInst = nav()
  const conn = (navInst as unknown as { connection?: EventTarget } | undefined)?.connection
  if (conn && typeof (conn as EventTarget).addEventListener === 'function') {
    ;(conn as EventTarget).addEventListener('change', refreshMetadataOnly)
  }

  const interval = options.autoProbeMs ?? 60_000
  if (interval > 0 && typeof setTimeout === 'function') {
    const initialTimer = setTimeout(() => {
      void probeNetwork().catch(() => undefined)
      const recurring = setInterval(() => {
        void probeNetwork().catch(() => undefined)
      }, interval)
      activeIntervals.push(recurring)
    }, interval)
    probeTimers.push(initialTimer)
  }

  return profile
}

export function subscribeNetwork(listener: NetworkListener): () => void {
  listeners.add(listener)
  try { listener(getNetworkProfile()) } catch { /* ignore */ }
  return () => { listeners.delete(listener) }
}

/**
 * Reset module state. Returns a promise resolved once any in-flight probes
 * finish so callers (typically tests) can `await` before re-using the
 * module. Production callers can ignore the return value.
 */
export async function __resetNetworkProfiler(): Promise<void> {
  // Mark a reset window so probes that finish after this point skip
  // publishing stale state.
  isResetting = true
  cached = null
  listeners.clear()
  initialized = false
  navigatorRef = undefined
  windowRef = undefined
  fetchRef = undefined
  // Clear ALL pending timers so a `setTimeout` chain in flight does not
  // continue scheduling intervals after the test resets the module.
  probeTimers.forEach((handle) => { try { clearTimeout(handle) } catch { /* ignore */ } })
  activeIntervals.forEach((handle) => { try { clearInterval(handle) } catch { /* ignore */ } })
  probeTimers = []
  activeIntervals = []
  await Promise.allSettled([...inFlightProbes])
  inFlightProbes.clear()
  isResetting = false
}
