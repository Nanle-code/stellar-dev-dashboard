/**
 * adaptivePerformance/usageTracker.ts
 *
 * Tracks user interactions during a session, classifies the interaction
 * intensity, and reports a rolling {@link UsageProfile}.
 *
 * Signals considered:
 *   - Click / pointer activity on interactive elements
 *   - Volume of feature areas touched during the session
 *   - Inter-action interval (lower -> more intense usage)
 *   - Budget violations reported via the existing `performance-metric` /
 *     `performance-regression` event channels
 */

import type { UsageIntensity, UsageProfile } from './types'

export type UsageListener = (profile: UsageProfile) => void

const listeners = new Set<UsageListener>()
let cached: UsageProfile | null = null

interface InteractionRecord {
  timestamp: number
  featureArea: string
}

const interactions: InteractionRecord[] = []
const featureAreas = new Set<string>()
let sessionStartedAt = Date.now()
let violationsRolling: number[] = []   // timestamps of recent violations
let lastViolationPrune = Date.now()

let navigatorRef: typeof navigator | undefined
let windowRef: typeof window | undefined
let documentRef: typeof document | undefined

function nav(): typeof navigator | undefined {
  return navigatorRef ?? (typeof navigator !== 'undefined' ? navigator : undefined)
}
function win(): typeof window | undefined {
  return windowRef ?? (typeof window !== 'undefined' ? window : undefined)
}
function doc(): typeof document | undefined {
  return documentRef ?? (typeof document !== 'undefined' ? document : undefined)
}

export function __setUsageGlobals(
  next: { navigator?: typeof navigator; window?: typeof window; document?: typeof document }
) {
  if (next.navigator !== undefined) navigatorRef = next.navigator
  if (next.window !== undefined) windowRef = next.window
  if (next.document !== undefined) documentRef = next.document
}

function classifyIntensity(input: {
  totalInteractions: number
  distinctFeatures: number
  averageIntervalMs: number
  sessionStartedAt: number
}): UsageIntensity {
  const minutes = Math.max(1, (Date.now() - input.sessionStartedAt) / 60_000)
  const perMinute = input.totalInteractions / minutes

  if (perMinute >= 12 || input.distinctFeatures >= 6) return 'expert'
  if (perMinute >= 6 || input.distinctFeatures >= 4) return 'power'
  if (perMinute >= 2 || input.distinctFeatures >= 2) return 'regular'
  return 'casual'
}

function pruneViolations(now: number) {
  // Keep violations in the last 5 minutes for rolling rate.
  const cutoff = now - 5 * 60_000
  if (now - lastViolationPrune < 30_000 && violationsRolling.length < 200) return
  lastViolationPrune = now
  violationsRolling = violationsRolling.filter((t) => t >= cutoff)
}

function computeAverageInterval(): number {
  if (interactions.length < 2) return Infinity
  // Average over the most recent 20 interactions.
  const recent = interactions.slice(-20)
  let total = 0
  for (let i = 1; i < recent.length; i++) {
    total += recent[i].timestamp - recent[i - 1].timestamp
  }
  return total / (recent.length - 1)
}

export function getUsageProfile(): UsageProfile {
  const now = Date.now()
  pruneViolations(now)
  const session = interactions[0]?.timestamp ?? sessionStartedAt
  const distinct = featureAreas.size
  const total = interactions.length
  const averageIntervalMs = Number.isFinite(computeAverageInterval()) ? computeAverageInterval() : 0
  const violationsPerMinute = (violationsRolling.length / 5)

  const profile: UsageProfile = {
    totalInteractions: total,
    distinctFeatureAreas: distinct,
    averageIntervalMs,
    violationsPerMinute,
    intensity: classifyIntensity({
      totalInteractions: total,
      distinctFeatures: distinct,
      averageIntervalMs,
      sessionStartedAt: session,
    }),
    sessionStartedAt: session,
    sampledAt: now,
  }
  cached = profile
  return profile
}

function publish(profile: UsageProfile) {
  cached = profile
  listeners.forEach((listener) => {
    try { listener(profile) } catch { /* ignore */ }
  })
}

/**
 * Record a single user interaction. Safe to call as often as needed — each
 * entry is bounded to the most recent 200 events to bound memory.
 */
export function recordInteraction(featureArea: string, _metadata: Record<string, unknown> = {}) {
  const area = (featureArea || 'general').trim().toLowerCase()
  interactions.push({ timestamp: Date.now(), featureArea: area })
  featureAreas.add(area)
  if (interactions.length > 200) interactions.splice(0, interactions.length - 200)
  publish(getUsageProfile())
}

/**
 * Hook into the DOM — counts click events on interactive elements.
 */
export function initUsageTracker(options: { autoHookDom?: boolean } = {}): UsageProfile {
  const profile = getUsageProfile()
  if (typeof window === 'undefined') return profile

  if (options.autoHookDom !== false) {
    const d = doc()
    if (d && !d.documentElement.hasAttribute('data-usage-tracker-attached')) {
      d.documentElement.setAttribute('data-usage-tracker-attached', 'true')
      const handler = (event: Event) => {
        const target = event.target as HTMLElement | null
        if (!target) return
        const interactive = target.closest?.('button,a,[role="button"],input,select,textarea,nav,section')
        if (!interactive) return
        const area =
          target.closest?.('[data-feature-area]')?.getAttribute('data-feature-area') ??
          target.closest?.('main')?.getAttribute('data-tab') ??
          interactive.tagName.toLowerCase()
        recordInteraction(area)
      }
      d.addEventListener('click', handler, { capture: true, passive: true })
    }
  }

  // Listen for performance-regression events so the engine knows when
  // its adaptations are not preventing budget violations.
  const w = win()
  if (w && !(w as unknown as { __usageTrackerRegressionBound?: boolean }).__usageTrackerRegressionBound) {
    ;(w as unknown as { __usageTrackerRegressionBound?: boolean }).__usageTrackerRegressionBound = true
    const onRegression = () => {
      violationsRolling.push(Date.now())
      if (violationsRolling.length > 500) violationsRolling.shift()
      publish(getUsageProfile())
    }
    w.addEventListener('performance-regression', onRegression)
  }

  return profile
}

/**
 * Reset everything — exposed for tests.
 */
export function resetUsageTracker() {
  interactions.length = 0
  featureAreas.clear()
  violationsRolling = []
  sessionStartedAt = Date.now()
  cached = null
  listeners.clear()
  navigatorRef = undefined
  windowRef = undefined
  documentRef = undefined
}

export function subscribeUsage(listener: UsageListener): () => void {
  listeners.add(listener)
  try { listener(getUsageProfile()) } catch { /* ignore */ }
  return () => { listeners.delete(listener) }
}
