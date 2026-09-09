/**
 * adaptivePerformance/engine.ts
 *
 * The Adaptive Performance Engine — Issue #586.
 *
 * Composition:
 *   - {@link getDeviceProfile}  → device tier + signals
 *   - {@link getNetworkProfile} → connection tier + latency
 *   - {@link getUsageProfile}   → usage intensity + budget-violation rate
 *   - {@link PerformancePredictor} → stress score & learned tier
 *   - User-selected {@link PerformanceMode} → override layer
 *
 * The engine listens to each profiler and emits a coherent
 * {@link AdaptiveEngineSnapshot} to subscribers whenever any input changes.
 *
 * To respect privacy / sync requirements (see
 * `src/lib/userPreferences.ts` `syncAcrossDevices`) the engine never
 * reports personal identifier information to monitoring endpoints.
 */

import { getDeviceProfile, initDeviceProfiler, subscribeDevice } from './deviceProfiler'
import { getNetworkProfile, initNetworkProfiler, probeNetwork, subscribeNetwork } from './networkProfiler'
import { getUsageProfile, initUsageTracker, subscribeUsage, recordInteraction } from './usageTracker'
import {
  PerformancePredictor,
  DEFAULT_WEIGHTS,
  DEFAULT_BIAS,
} from './predictor'
import {
  initAccuracyTracker,
  recordFeedback,
  getAccuracyReport,
  getDecisionCount as getDecisionCountFromTracker,
  type AccuracyReport,
} from './accuracyTracker'
import type {
  AdaptationProfile,
  AdaptiveEngineSnapshot,
  DeviceProfile,
  FeedbackRecord,
  NetworkProfile,
  PerformanceMode,
  UsageProfile,
} from './types'

type EngineListener = (snapshot: AdaptiveEngineSnapshot) => void

const listeners = new Set<EngineListener>()

let initialized = false
let mode: PerformanceMode = 'auto'
let currentDevice: DeviceProfile = getDeviceProfile()
let currentNetwork: NetworkProfile = getNetworkProfile()
let currentUsage: UsageProfile = getUsageProfile()
let predictor = new PerformancePredictor()
const locked = new Set<keyof AdaptationProfile>()
const pendingFeedbackQueue: FeedbackRecord[] = []
let lastAccuracyReport: AccuracyReport = { total: 0, correct: 0, accuracy: undefined, outcomeCounts: { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 }, generatedAt: Date.now() }

const TIER_TO_ADAPTATION: Record<AdaptationProfile['tier'], AdaptationProfile> = {
  'high': {
    tier: 'high',
    imageMaxWidth: 1280,
    animatedTransitions: true,
    maxConcurrentRequests: 8,
    ledgerRefreshSeconds: 5,
    prefetchOnIdle: true,
    backgroundSync: true,
    virtualListWindow: 50,
    streamDebounceMs: 0,
    chartRenderer: 'svg',
    confidence: 1,
  },
  'balanced': {
    tier: 'balanced',
    imageMaxWidth: 800,
    animatedTransitions: true,
    maxConcurrentRequests: 4,
    ledgerRefreshSeconds: 15,
    prefetchOnIdle: true,
    backgroundSync: true,
    virtualListWindow: 30,
    streamDebounceMs: 250,
    chartRenderer: 'svg',
    confidence: 1,
  },
  'battery-saver': {
    tier: 'battery-saver',
    imageMaxWidth: 480,
    animatedTransitions: false,
    maxConcurrentRequests: 2,
    ledgerRefreshSeconds: 30,
    prefetchOnIdle: false,
    backgroundSync: false,
    virtualListWindow: 15,
    streamDebounceMs: 750,
    chartRenderer: 'canvas',
    confidence: 1,
  },
}

/** Apply the user's mode to the predicted tier. */
function applyMode(
  predicted: AdaptationProfile,
  userMode: PerformanceMode,
  device: DeviceProfile,
  network: NetworkProfile
): AdaptationProfile {
  if (userMode === 'auto') return predicted

  const next = { ...predicted }

  // The user-pinned mode short-circuits the engine's tier.
  switch (userMode) {
    case 'quality':
      next.tier = device.tier === 'high' ? 'high' : 'balanced'
      break
    case 'balanced':
      next.tier = 'balanced'
      break
    case 'speed':
      next.tier = 'battery-saver'
      break
    case 'battery-saver':
      next.tier = 'battery-saver'
      break
  }

  // Always preserve "layers" the user can't choose (e.g. confidence below
  // 0.4 means we should refuse to drop too aggressively even under "speed").
  if (next.confidence < 0.4 && next.tier === 'battery-saver') {
    next.tier = 'balanced'
  }

  // When the network is offline the user mode is overridden.
  if (network.isOffline) next.tier = 'battery-saver'

  const tierProfile = TIER_TO_ADAPTATION[next.tier]
  return { ...tierProfile, confidence: next.confidence, tier: next.tier }
}

function snapshot(): AdaptiveEngineSnapshot {
  const prediction = predictor.predict(currentDevice, currentNetwork, currentUsage)
  const base = { ...TIER_TO_ADAPTATION[prediction.tier], confidence: prediction.confidence }
  const adaptation = applyMode(base, mode, currentDevice, currentNetwork)
  return {
    device: currentDevice,
    network: currentNetwork,
    usage: currentUsage,
    adaptation,
    mode,
    locked: Array.from(locked),
    accuracy: lastAccuracyReport.accuracy ?? 0,
    decisionsObserved: lastAccuracyReport.total,
    updatedAt: Date.now(),
  }
}

function publish() {
  const snap = snapshot()
  listeners.forEach((listener) => {
    try { listener(snap) } catch { /* ignore */ }
  })
}

function absorbProfilers() {
  const previousDevice = currentDevice
  const previousNetwork = currentNetwork
  const previousUsage = currentUsage
  const next = snapshot()
  return { previousDevice, previousNetwork, previousUsage, next }
}

/**
 * Boot the engine. Safe to call multiple times — only the first call has
 * any side effect. The returned promise resolves once persisted state is
 * hydrated.
 */
export async function initAdaptiveEngine(): Promise<AdaptiveEngineSnapshot> {
  if (!initialized) {
    initDeviceProfiler()
    initNetworkProfiler()
    initUsageTracker()
    await initAccuracyTracker()
    // Drain any feedback that was queued before initialization finished.
    while (pendingFeedbackQueue.length) {
      const next = pendingFeedbackQueue.shift()!
      await recordFeedback(next)
    }
    lastAccuracyReport = getAccuracyReport()
    initialized = true
  }

  subscribeDevice((device) => { currentDevice = device; publish() })
  subscribeNetwork((network) => { currentNetwork = network; publish() })
  subscribeUsage((usage) => { currentUsage = usage; publish() })

  // Warm the engines with one sync snapshot so subscribers get data
  // immediately and so the predictor sees real signals.
  publish()
  return snapshot()
}

/**
 * Subscribe to engine output. Returns an unsubscribe function.
 */
export function subscribeAdaptiveEngine(listener: EngineListener): () => void {
  listeners.add(listener)
  if (initialized) {
    try { listener(snapshot()) } catch { /* ignore */ }
  }
  return () => { listeners.delete(listener) }
}

/**
 * Read the current engine snapshot without subscribing.
 */
export function getAdaptiveSnapshot(): AdaptiveEngineSnapshot {
  return snapshot()
}

/**
 * Manually inform the engine about a feature interaction. Convenience
 * wrapper around the usage tracker so feature code can record the signal
 * without a direct dependency on the tracker.
 */
export function trackAdaptiveInteraction(featureArea: string, metadata?: Record<string, unknown>) {
  recordInteraction(featureArea, metadata)
}

export function setPerformanceMode(next: PerformanceMode): AdaptiveEngineSnapshot {
  mode = next
  publish()
  return snapshot()
}

export function lockAdaptation(key: keyof AdaptationProfile): AdaptiveEngineSnapshot {
  locked.add(key)
  publish()
  return snapshot()
}

export function unlockAdaptation(key: keyof AdaptationProfile): AdaptiveEngineSnapshot {
  locked.delete(key)
  publish()
  return snapshot()
}

export function unlockAllAdaptations(): AdaptiveEngineSnapshot {
  locked.clear()
  publish()
  return snapshot()
}

/**
 * Force a fresh snapshot from device / network / usage profilers.
 */
export async function refreshAdaptiveSnapshot(): Promise<AdaptiveEngineSnapshot> {
  await probeNetwork().catch(() => undefined)
  publish()
  return snapshot()
}

/**
 * Submit explicit feedback (e.g. from a "Revert to high quality" button).
 */
export async function submitFeedback(
  outcome: 0 | 1,
  source: FeedbackRecord['source'],
  options: { tierOverride?: AdaptationProfile['tier'] } = {}
): Promise<void> {
  const current = snapshot()
  const record: FeedbackRecord = {
    tier: options.tierOverride ?? current.adaptation.tier,
    source,
    outcome,
    timestamp: Date.now(),
  }
  predictor.observe(record, currentDevice, currentNetwork, currentUsage)
  if (!initialized) {
    pendingFeedbackQueue.push(record)
  } else {
    await recordFeedback(record)
    lastAccuracyReport = getAccuracyReport()
  }
  publish()
}

export function getAccuracy(): AccuracyReport {
  return getAccuracyReport()
}

/**
 * Historical count of decisions the engine has observed (rolling 100).
 * Named to match the {@link accuracyTracker} module — engine layer delegates.
 */
export function getDecisionCount(): number {
  return getDecisionCountFromTracker()
}

export function exportPredictorWeights() {
  return predictor.exportWeights()
}

export function importPredictorWeights(next: { weights?: number[]; bias?: number }): AdaptiveEngineSnapshot {
  predictor.importWeights(next)
  publish()
  return snapshot()
}

export function resetPredictorWeights(): AdaptiveEngineSnapshot {
  predictor = new PerformancePredictor({
    weights: [...DEFAULT_WEIGHTS],
    bias: DEFAULT_BIAS,
  })
  lastAccuracyReport = getAccuracyReport()
  publish()
  return snapshot()
}

/**
 * Test-only reset. Tears down listeners, locks, predictor, and the
 * pending feedback queue. Does NOT touch persistent storage.
 */
export function __resetAdaptiveEngine() {
  listeners.clear()
  initialized = false
  mode = 'auto'
  locked.clear()
  pendingFeedbackQueue.length = 0
  predictor = new PerformancePredictor()
  currentDevice = getDeviceProfile()
  currentNetwork = getNetworkProfile()
  currentUsage = getUsageProfile()
  publish()
}
