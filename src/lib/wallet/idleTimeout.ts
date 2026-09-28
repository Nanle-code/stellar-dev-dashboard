/**
 * Wallet session idle timeout (#837).
 *
 * Tracks user activity and, after a configurable idle period, first warns the
 * user and then expires the wallet session. Intended for shared workstations
 * where a connected wallet must not stay usable after the owner walks away.
 *
 * This module is framework-free: it does not import the store, so it can be
 * used from the store (persisted setting) and from UI components alike.
 */

/** Idle timeout used when nothing (or something invalid) is configured. */
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 15
export const MIN_IDLE_TIMEOUT_MINUTES = 1
export const MAX_IDLE_TIMEOUT_MINUTES = 240
/** A configured value of 0 disables the idle timeout. */
export const IDLE_TIMEOUT_DISABLED = 0

/** How long before expiry the disconnect prompt is shown. */
export const DEFAULT_WARNING_MS = 60_000

export const IDLE_TIMEOUT_STORAGE_KEY = 'stellar-dash:wallet-idle-timeout-minutes'

/** Reason recorded on the store when a session expires from inactivity. */
export const IDLE_TIMEOUT_REVOKE_REASON = 'idle_timeout'

/** Choices offered in the UI; any integer in range is also accepted. */
export const IDLE_TIMEOUT_OPTIONS: ReadonlyArray<{ minutes: number; label: string }> = [
  { minutes: IDLE_TIMEOUT_DISABLED, label: 'Off' },
  { minutes: 5, label: '5 minutes' },
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
]

export const DEFAULT_ACTIVITY_EVENTS: ReadonlyArray<string> = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
]

export type IdleTimeoutIssue =
  | 'not_a_number'
  | 'negative'
  | 'below_minimum'
  | 'above_maximum'
  | 'not_an_integer'

export interface NormalizedIdleTimeout {
  /** Effective minutes; 0 means disabled. */
  minutes: number
  /** False when the input had to be replaced or adjusted. */
  valid: boolean
  issue?: IdleTimeoutIssue
}

/**
 * Validate a user- or storage-supplied idle timeout.
 *
 * - `0` disables the timeout.
 * - Non-numeric and negative input falls back to the default (fail safe:
 *   corrupt config must never silently disable the protection).
 * - Out-of-range values are clamped; fractional values are rounded.
 */
export function normalizeIdleTimeoutMinutes(value: unknown): NormalizedIdleTimeout {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN

  if (!Number.isFinite(numeric)) {
    return { minutes: DEFAULT_IDLE_TIMEOUT_MINUTES, valid: false, issue: 'not_a_number' }
  }
  if (numeric < 0) {
    return { minutes: DEFAULT_IDLE_TIMEOUT_MINUTES, valid: false, issue: 'negative' }
  }
  if (numeric === IDLE_TIMEOUT_DISABLED) {
    return { minutes: IDLE_TIMEOUT_DISABLED, valid: true }
  }

  const rounded = Math.round(numeric)
  if (rounded < MIN_IDLE_TIMEOUT_MINUTES) {
    return { minutes: MIN_IDLE_TIMEOUT_MINUTES, valid: false, issue: 'below_minimum' }
  }
  if (rounded > MAX_IDLE_TIMEOUT_MINUTES) {
    return { minutes: MAX_IDLE_TIMEOUT_MINUTES, valid: false, issue: 'above_maximum' }
  }
  if (rounded !== numeric) {
    return { minutes: rounded, valid: false, issue: 'not_an_integer' }
  }
  return { minutes: rounded, valid: true }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Accessing localStorage throws in some sandboxed / privacy modes.
    return null
  }
}

/** Read the persisted timeout, falling back to the default on any failure. */
export function loadIdleTimeoutMinutes(storage: StorageLike | null = defaultStorage()): number {
  if (!storage) return DEFAULT_IDLE_TIMEOUT_MINUTES
  try {
    const raw = storage.getItem(IDLE_TIMEOUT_STORAGE_KEY)
    if (raw === null) return DEFAULT_IDLE_TIMEOUT_MINUTES
    return normalizeIdleTimeoutMinutes(raw).minutes
  } catch {
    return DEFAULT_IDLE_TIMEOUT_MINUTES
  }
}

/** Persist a timeout. Returns the normalized value that was stored (or would have been). */
export function saveIdleTimeoutMinutes(
  value: unknown,
  storage: StorageLike | null = defaultStorage(),
): number {
  const { minutes } = normalizeIdleTimeoutMinutes(value)
  try {
    storage?.setItem(IDLE_TIMEOUT_STORAGE_KEY, String(minutes))
  } catch {
    // Quota exceeded / storage blocked: the in-memory value still applies.
  }
  return minutes
}

/** Warning lead time for a timeout: 60s, but never more than half the timeout. */
export function getWarningLeadMs(timeoutMs: number, warningMs = DEFAULT_WARNING_MS): number {
  return Math.max(0, Math.min(warningMs, Math.floor(timeoutMs / 2)))
}

interface IdleEnvironment {
  addEventListener?: unknown
  removeEventListener?: unknown
  setTimeout?: unknown
  clearTimeout?: unknown
}

/**
 * Whether activity tracking can work here. SSR, workers without DOM events,
 * and stripped-down embedded webviews are reported as unsupported.
 */
export function isIdleTimeoutSupported(env: IdleEnvironment | null = globalThis as IdleEnvironment): boolean {
  return Boolean(
    env &&
      typeof env.addEventListener === 'function' &&
      typeof env.removeEventListener === 'function' &&
      typeof env.setTimeout === 'function' &&
      typeof env.clearTimeout === 'function',
  )
}

export type IdlePhase = 'stopped' | 'active' | 'warning' | 'expired'

export interface IdleSessionMonitorOptions {
  timeoutMs: number
  warningMs?: number
  onWarning?: (remainingMs: number) => void
  onTimeout: () => void
  /** Clock, injectable for tests. */
  now?: () => number
  /** Where activity events are observed. Defaults to `window`. */
  target?: EventTarget | null
  /** Document used for `visibilitychange` re-checks. Defaults to `document`. */
  visibilityTarget?: EventTarget | null
  activityEvents?: ReadonlyArray<string>
}

export interface IdleSessionMonitor {
  readonly supported: boolean
  start: () => void
  stop: () => void
  /** Explicitly extend the session (e.g. the "Stay connected" button). */
  acknowledge: () => void
  getPhase: () => IdlePhase
  /** Milliseconds until expiry; 0 once expired or stopped. */
  getRemainingMs: () => number
}

/**
 * Create an idle monitor. Timers are re-validated against the wall clock on
 * every tick and whenever the tab becomes visible again, so a laptop that
 * slept past the deadline expires immediately on wake instead of granting a
 * fresh countdown.
 *
 * Passive activity (mouse moves, key presses) resets the idle clock while the
 * session is active, but does NOT dismiss an open warning — the user must
 * acknowledge it, so a bumped mouse cannot silently keep a shared session alive.
 */
export function createIdleSessionMonitor(options: IdleSessionMonitorOptions): IdleSessionMonitor {
  const { timeoutMs, onTimeout, onWarning } = options
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(`Idle timeout must be a positive number of milliseconds, got ${timeoutMs}`)
  }

  const now = options.now ?? (() => Date.now())
  const target =
    options.target !== undefined ? options.target : typeof window !== 'undefined' ? window : null
  const visibilityTarget =
    options.visibilityTarget !== undefined
      ? options.visibilityTarget
      : typeof document !== 'undefined'
        ? document
        : null
  const activityEvents = options.activityEvents ?? DEFAULT_ACTIVITY_EVENTS
  const warningLeadMs = getWarningLeadMs(timeoutMs, options.warningMs)
  const supported = target !== null && isIdleTimeoutSupported(globalThis as IdleEnvironment)

  let phase: IdlePhase = 'stopped'
  let lastActivity = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const schedule = (delayMs: number) => {
    clearTimer()
    timer = setTimeout(evaluate, Math.max(0, delayMs))
  }

  function evaluate(): void {
    timer = null
    if (phase === 'stopped' || phase === 'expired') return

    const elapsed = now() - lastActivity
    const remaining = timeoutMs - elapsed

    if (remaining <= 0) {
      phase = 'expired'
      detach()
      onTimeout()
      return
    }

    if (remaining <= warningLeadMs) {
      if (phase !== 'warning') {
        phase = 'warning'
        onWarning?.(remaining)
      }
      schedule(remaining)
      return
    }

    // Still active (activity may have moved the deadline): wake at warning time.
    schedule(remaining - warningLeadMs)
  }

  const handleActivity = () => {
    if (phase === 'active') lastActivity = now()
  }

  const handleVisibility = () => {
    if (phase === 'active' || phase === 'warning') evaluate()
  }

  let attached = false
  const attach = () => {
    if (attached || !target) return
    activityEvents.forEach((type) => target.addEventListener(type, handleActivity, { passive: true }))
    visibilityTarget?.addEventListener('visibilitychange', handleVisibility)
    attached = true
  }

  function detach(): void {
    if (!attached || !target) return
    activityEvents.forEach((type) => target.removeEventListener(type, handleActivity))
    visibilityTarget?.removeEventListener('visibilitychange', handleVisibility)
    attached = false
  }

  return {
    supported,
    start() {
      if (!supported || phase === 'active' || phase === 'warning') return
      phase = 'active'
      lastActivity = now()
      attach()
      evaluate()
    },
    stop() {
      phase = 'stopped'
      clearTimer()
      detach()
    },
    acknowledge() {
      if (phase !== 'active' && phase !== 'warning') return
      phase = 'active'
      lastActivity = now()
      evaluate()
    },
    getPhase: () => phase,
    getRemainingMs() {
      if (phase !== 'active' && phase !== 'warning') return 0
      return Math.max(0, timeoutMs - (now() - lastActivity))
    },
  }
}
