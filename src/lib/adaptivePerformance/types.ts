/**
 * adaptivePerformance/types.ts
 *
 * Shared types for the Adaptive Performance Engine — Issue #586.
 *
 * The engine combines:
 *   - {@link DeviceProfile}   (hardware capabilities)
 *   - {@link NetworkProfile}  (connection quality)
 *   - {@link UsageProfile}    (behavioural signals)
 *
 * It produces an {@link AdaptationProfile} that the rest of the app
 * consumes through `useAdaptivePerformance()`.
 *
 * Public surface is also exported from `src/lib/adaptivePerformance/index.ts`.
 */

// ─── Discrete device / network / usage tiers ────────────────────────────────

export type DeviceTier = 'low' | 'mid' | 'high'
export type NetworkTier = 'offline' | 'slow' | 'moderate' | 'fast'
export type UsageIntensity = 'casual' | 'regular' | 'power' | 'expert'

// ─── User-controlled modes (override layer) ─────────────────────────────────

/** User-selected preference for the trade-off between quality and speed. */
export type PerformanceMode = 'auto' | 'battery-saver' | 'speed' | 'balanced' | 'quality'

// ─── Device profiler output ─────────────────────────────────────────────────

export interface DeviceProfile {
  /** navigator.hardwareConcurrency — 0 if unknown (SSR / unsupported). */
  cpuCores: number
  /** navigator.deviceMemory in GiB — null when not exposed by the browser. */
  deviceMemoryGb: number | null
  /** Window / screen pixel ratio. */
  devicePixelRatio: number
  /** Effective viewport width in CSS pixels at sample time. */
  viewportWidth: number
  /** Effective viewport height in CSS pixels at sample time. */
  viewportHeight: number
  /** Detected coarse platform. */
  platform: 'mobile' | 'tablet' | 'desktop' | 'unknown'
  /** Estimated discrete tier derived from the raw values. */
  tier: DeviceTier
  /** True when the page is currently visible to the user. */
  isVisible: boolean
  /** True when the device reports a low battery state (≤ 20%). */
  isLowBattery: boolean
  /** Sampling timestamp (epoch ms). */
  sampledAt: number
}

// ─── Network profiler output ────────────────────────────────────────────────

export interface NetworkProfile {
  /** navigator.connection.effectiveType when available. */
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'unknown'
  /** Estimated downlink in Mbps. */
  downlinkMbps: number | null
  /** Connection round-trip-time estimate in ms. */
  rttMs: number | null
  /** Whether the user has explicitly enabled data-saver. */
  saveData: boolean
  /** Last measured HTTP latency (ms) from active probing. */
  measuredLatencyMs: number | null
  /** Last measured effective download throughput (ms for 32KB probe). */
  measuredThroughputMs: number | null
  /** Tier derived from the connection metadata + measurements. */
  tier: NetworkTier
  /** True when the browser reports the user is offline. */
  isOffline: boolean
  /** Sampling timestamp (epoch ms). */
  sampledAt: number
}

// ─── Usage tracker output ───────────────────────────────────────────────────

export interface UsageProfile {
  /** Total user-driven interactions in the current session. */
  totalInteractions: number
  /** Distinct feature areas the user has touched in this session. */
  distinctFeatureAreas: number
  /** Average inter-action interval (ms) — lower = more intense usage. */
  averageIntervalMs: number
  /** Rolling average of measured CWV / metric violations per minute. */
  violationsPerMinute: number
  /** Estimated usage band derived from the activity mix. */
  intensity: UsageIntensity
  /** Timestamp of the first tracked interaction (epoch ms). */
  sessionStartedAt: number
  /** Sampling timestamp (epoch ms). */
  sampledAt: number
}

// ─── Adaptation knobs ───────────────────────────────────────────────────────

/**
 * Discrete adaptation profile that the rest of the app can subscribe to.
 * Every value represents a tunable knob driven by the engine.
 */
export interface AdaptationProfile {
  /** Discrete quality tier decided by the engine. */
  tier: 'high' | 'balanced' | 'battery-saver'

  /** Image rendering size cap (CSS px). Lower => cheaper. */
  imageMaxWidth: number

  /** Whether subtle motion / transitions are allowed. */
  animatedTransitions: boolean

  /** Concurrent network request cap. */
  maxConcurrentRequests: number

  /** Seconds between poll refreshes for ledger / account data. */
  ledgerRefreshSeconds: number

  /** Whether to pre-fetch account & network stats on idle. */
  prefetchOnIdle: boolean

  /** Background sync of queued operations when offline. */
  backgroundSync: boolean

  /** DOM window size for virtual lists / paginated tables. */
  virtualListWindow: number

  /** Debounce applied to WebSocket burst messages (ms). */
  streamDebounceMs: number

  /** Renderer hint for charts (svg is rich, canvas is cheap). */
  chartRenderer: 'svg' | 'canvas'

  /** Confidence in the chosen tier (0–1). */
  confidence: number
}

// ─── Engine state ───────────────────────────────────────────────────────────

export interface AdaptiveEngineSnapshot {
  device: DeviceProfile
  network: NetworkProfile
  usage: UsageProfile
  adaptation: AdaptationProfile
  /** User-selected mode that drove the decision. */
  mode: PerformanceMode
  /** Whether the user has locked any of the adaptation knobs manually. */
  locked: ReadonlyArray<keyof AdaptationProfile>
  /** Rolling accuracy (0-1) over the most recent decisions. */
  accuracy: number
  /** Total decisions observed so far. */
  decisionsObserved: number
  /** Last update timestamp (epoch ms). */
  updatedAt: number
}

// ─── Feedback events ────────────────────────────────────────────────────────

export type FeedbackSource = 'user-override' | 'metric-resolution' | 'metric-violation'

export interface FeedbackRecord {
  /** Adaptation tier that was active when feedback was generated. */
  tier: AdaptationProfile['tier']
  /** Source of the feedback. */
  source: FeedbackSource
  /** 1 = the adaptation was correct, 0 = it was wrong. */
  outcome: 0 | 1
  /** When the feedback was produced (epoch ms). */
  timestamp: number
}
