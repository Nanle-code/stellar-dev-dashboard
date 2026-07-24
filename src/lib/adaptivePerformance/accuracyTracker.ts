/**
 * adaptivePerformance/accuracyTracker.ts
 *
 * Maintains a rolling confusion matrix over the last 100 engine decisions
 * to verify the "appropriate 90% of the time" acceptance criterion.
 *
 * Confusion matrix semantics:
 *   - TP: outcome === 1 (engine considered correct)
 *   - FP: outcome === 0 with `user-override` (user manually reverted)
 *   - TN: outcome === 0 with no user override and no metric violation
 *        (engine correctly sat still while metrics stayed inside budget)
 *   - FN: outcome === 0 with `metric-violation`
 *        (engine held tier while regressions kept firing)
 *
 * Persisted under {@link STORAGE_KEY} so accuracy survives reloads.
 */

import type { FeedbackRecord } from './types'

export const STORAGE_KEY = 'adaptive-accuracy-v1'
const HISTORY_LIMIT = 100

export interface AccuracyReport {
  /** Decisions evaluated. */
  total: number
  /** Decisions where the engine was correct. */
  correct: number
  /** Accuracy (correct / total) — undefined when no samples. */
  accuracy: number | undefined
  /** Counts per outcome. */
  outcomeCounts: { truePositive: number; falsePositive: number; trueNegative: number; falseNegative: number }
  /** Timestamp the report was generated. */
  generatedAt: number
}

interface PersistedShape {
  history: FeedbackRecord[]
}

let history: FeedbackRecord[] = []
let initialized = false
let storageRef: Pick<Storage, 'getItem' | 'setItem'> | undefined

/**
 * Replace the storage backend (used in tests to avoid touching localStorage).
 */
export function __setAccuracyStorage(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined) {
  storageRef = storage
}

function getStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  if (storageRef) return storageRef
  if (typeof localStorage !== 'undefined') return localStorage
  return undefined
}

async function load(): Promise<void> {
  const s = getStorage()
  if (!s) { initialized = true; return }
  try {
    const raw = s.getItem(STORAGE_KEY)
    if (!raw) { initialized = true; return }
    const parsed = JSON.parse(raw) as PersistedShape
    if (Array.isArray(parsed?.history)) history = parsed.history.slice(-HISTORY_LIMIT)
  } catch {
    /* ignore — treat as empty */
  }
  initialized = true
}

async function persist(): Promise<void> {
  const s = getStorage()
  if (!s) return
  try {
    const payload: PersistedShape = { history }
    s.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* swallow quota errors */
  }
}

/**
 * Boot the tracker. Must be awaited (or invoked at least once) before
 * `recordFeedback` so any prior state is restored.
 */
export async function initAccuracyTracker(): Promise<void> {
  if (initialized) return
  await load()
}

export async function recordFeedback(record: FeedbackRecord): Promise<void> {
  if (!initialized) await initAccuracyTracker()
  history.push(record)
  if (history.length > HISTORY_LIMIT) history.shift()
  await persist()
}

export async function clearAccuracyHistory(): Promise<void> {
  history = []
  await persist()
}

/**
 * Map a {@link FeedbackRecord} to one of the four confusion-matrix slots.
 * Exported so tests + dashboard widgets can interpret the report.
 */
export function classifyFeedback(
  record: FeedbackRecord,
): keyof AccuracyReport['outcomeCounts'] {
  if (record.outcome === 1) return 'truePositive'
  if (record.source === 'user-override') return 'falsePositive'
  if (record.source === 'metric-violation') return 'falseNegative'
  return 'trueNegative'
}

export function getAccuracyReport(): AccuracyReport {
  const counts = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 }
  for (const record of history) {
    counts[classifyFeedback(record)] += 1
  }
  const total = history.length
  const correct = counts.truePositive + counts.trueNegative
  return {
    total,
    correct,
    accuracy: total > 0 ? correct / total : undefined,
    outcomeCounts: counts,
    generatedAt: Date.now(),
  }
}

export function getDecisionCount(): number {
  return history.length
}

/** Synchronous test-only reset. Does NOT touch the persisted store. */
export function __resetAccuracyTracker() {
  history = []
  initialized = false
  storageRef = undefined
}
