/**
 * useAdaptivePerformance — Issue #586
 *
 * React hook that subscribes to the Adaptive Performance Engine and
 * exposes the current {@link AdaptiveEngineSnapshot} plus ergonomic
 * helpers for components to record interactions, lock adaptations and
 * submit feedback.
 */

import { useEffect, useState, useCallback } from 'react'

import AdaptiveEngine, {
  type AdaptationProfile,
  type AdaptiveEngineSnapshot,
  type FeedbackRecord,
  type PerformanceMode,
  initAdaptiveEngine,
  subscribeAdaptiveEngine,
  refreshAdaptiveSnapshot,
  setPerformanceMode as engineSetPerformanceMode,
  lockAdaptation as engineLockAdaptation,
  unlockAdaptation as engineUnlockAdaptation,
  unlockAllAdaptations as engineUnlockAllAdaptations,
  submitFeedback as engineSubmitFeedback,
  trackAdaptiveInteraction,
  getAdaptiveSnapshot,
} from '../lib/adaptivePerformance'

export interface UseAdaptivePerformanceResult {
  /** Latest engine snapshot (or `null` if the engine has not initialised yet). */
  snapshot: AdaptiveEngineSnapshot | null
  /** True after the engine promise has settled at least once. */
  ready: boolean
  /** Update the user-controlled performance mode. */
  setPerformanceMode: (next: PerformanceMode) => void
  /** Lock a single adaptation knob so the engine stops overriding it. */
  lockAdaptation: (key: keyof AdaptationProfile) => void
  /** Unlock a previously-locked adaptation knob. */
  unlockAdaptation: (key: keyof AdaptationProfile) => void
  /** Unlock every locked knob. */
  unlockAllAdaptations: () => void
  /** Record a feature interaction so the usage tracker stays in sync. */
  trackInteraction: (featureArea: string, metadata?: Record<string, unknown>) => void
  /** Submit feedback after observing a positive/negative outcome. */
  submitFeedback: (outcome: 0 | 1, source: FeedbackRecord['source']) => Promise<void>
  /** Force an immediate probe + refresh. */
  refresh: () => Promise<void>
}

export function useAdaptivePerformance(componentName?: string): UseAdaptivePerformanceResult {
  const [snapshot, setSnapshot] = useState<AdaptiveEngineSnapshot | null>(() => {
    try { return getAdaptiveSnapshot() } catch { return null }
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined

    initAdaptiveEngine()
      .then(() => {
        if (cancelled) return
        setSnapshot(getAdaptiveSnapshot())
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setReady(true)
      })

    unsub = subscribeAdaptiveEngine((next) => {
      if (cancelled) return
      setSnapshot(next)
    })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const setPerformanceMode = useCallback((next: PerformanceMode) => {
    engineSetPerformanceMode(next)
    setSnapshot(getAdaptiveSnapshot())
  }, [])

  const lockAdaptation = useCallback((key: keyof AdaptationProfile) => {
    engineLockAdaptation(key)
    setSnapshot(getAdaptiveSnapshot())
  }, [])

  const unlockAdaptation = useCallback((key: keyof AdaptationProfile) => {
    engineUnlockAdaptation(key)
    setSnapshot(getAdaptiveSnapshot())
  }, [])

  const unlockAllAdaptations = useCallback(() => {
    engineUnlockAllAdaptations()
    setSnapshot(getAdaptiveSnapshot())
  }, [])

  const trackInteraction = useCallback(
    (featureArea: string, metadata?: Record<string, unknown>) => {
      const area = featureArea || componentName || 'unknown'
      trackAdaptiveInteraction(area, metadata)
    },
    [componentName]
  )

  const submitFeedback = useCallback(async (outcome: 0 | 1, source: FeedbackRecord['source']) => {
    await engineSubmitFeedback(outcome, source)
    setSnapshot(getAdaptiveSnapshot())
  }, [])

  const refresh = useCallback(async () => {
    await refreshAdaptiveSnapshot()
    setSnapshot(getAdaptiveSnapshot())
  }, [])

  return {
    snapshot,
    ready,
    setPerformanceMode,
    lockAdaptation,
    unlockAdaptation,
    unlockAllAdaptations,
    trackInteraction,
    submitFeedback,
    refresh,
  }
}

export default useAdaptivePerformance
export { AdaptiveEngine }
