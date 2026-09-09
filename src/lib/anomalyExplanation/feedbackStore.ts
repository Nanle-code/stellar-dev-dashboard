/**
 * feedbackStore.ts
 * Feature #591: Anomaly Explanation Feedback Store
 *
 * Persists user feedback on anomaly explanations in localStorage and uses
 * it to adjust confidence weights so future explanations improve over time.
 *
 * The learning mechanism is deliberately lightweight (no external model
 * calls) so the system works fully client-side without an API key.
 */

import type { AnomalyExplanation, ExplanationConfidence } from './anomalyExplainer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeedbackRating = 1 | 2 | 3 | 4 | 5

export interface ExplanationFeedback {
  /** Unique ID so we can de-duplicate */
  feedbackId: string
  /** ID of the AnomalyExplanation this feedback applies to */
  explanationId: string
  /** Was the explanation helpful overall? */
  helpful: boolean
  /** 1 (not useful) → 5 (very useful) */
  rating: FeedbackRating
  /** Which action item did the user act on (if any) */
  actionTaken: string | null
  /** Free-text comment from the user */
  comment: string
  /** Category of the explained anomaly */
  anomalyCategory: string
  /** Severity of the explained anomaly */
  anomalySeverity: string
  /** ISO timestamp */
  timestamp: string
}

export interface FeedbackSummary {
  totalFeedback: number
  helpfulCount: number
  unhelpfulCount: number
  averageRating: number
  helpfulnessPct: number
  /** Per-category helpfulness rates (0–100) */
  categoryRates: Record<string, number>
  /** Per-severity helpfulness rates */
  severityRates: Record<string, number>
  lastUpdated: string
}

export interface LearnedWeights {
  /** Multiplier per category (> 1 means boost confidence, < 1 means suppress) */
  categoryMultipliers: Record<string, number>
  /** Multiplier per severity level */
  severityMultipliers: Record<string, number>
  /** Overall confidence adjustment (−0.2 to +0.2) */
  globalAdjustment: number
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const STORAGE_KEY_FEEDBACK = 'stellar-anomaly-feedback-v1'
const STORAGE_KEY_WEIGHTS  = 'stellar-anomaly-weights-v1'
const MAX_FEEDBACK_ENTRIES = 500

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newFeedbackId(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ---------------------------------------------------------------------------
// FeedbackStore class
// ---------------------------------------------------------------------------

class FeedbackStore {
  private feedback: ExplanationFeedback[] = []
  private weights: LearnedWeights = {
    categoryMultipliers: {},
    severityMultipliers: {},
    globalAdjustment: 0,
  }

  constructor() {
    this.load()
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private load(): void {
    try {
      const rawFb = localStorage.getItem(STORAGE_KEY_FEEDBACK)
      if (rawFb) this.feedback = JSON.parse(rawFb) as ExplanationFeedback[]
    } catch {
      this.feedback = []
    }
    try {
      const rawW = localStorage.getItem(STORAGE_KEY_WEIGHTS)
      if (rawW) this.weights = JSON.parse(rawW) as LearnedWeights
    } catch {
      // keep defaults
    }
  }

  private saveFeedback(): void {
    try {
      localStorage.setItem(STORAGE_KEY_FEEDBACK, JSON.stringify(this.feedback))
    } catch {
      // storage quota — silently ignore
    }
  }

  private saveWeights(): void {
    try {
      localStorage.setItem(STORAGE_KEY_WEIGHTS, JSON.stringify(this.weights))
    } catch {
      // storage quota — silently ignore
    }
  }

  // ── Recording feedback ────────────────────────────────────────────────────

  /**
   * Record user feedback for an explanation. Triggers a weights update.
   */
  recordFeedback(
    explanation: AnomalyExplanation,
    helpful: boolean,
    rating: FeedbackRating,
    actionTaken: string | null = null,
    comment = ''
  ): ExplanationFeedback {
    const entry: ExplanationFeedback = {
      feedbackId:       newFeedbackId(),
      explanationId:    explanation.id,
      helpful,
      rating,
      actionTaken,
      comment,
      anomalyCategory:  explanation.category,
      anomalySeverity:  explanation.severity,
      timestamp:        new Date().toISOString(),
    }

    this.feedback.push(entry)

    // Trim to max size (FIFO)
    if (this.feedback.length > MAX_FEEDBACK_ENTRIES) {
      this.feedback.splice(0, this.feedback.length - MAX_FEEDBACK_ENTRIES)
    }

    this.saveFeedback()
    this.recomputeWeights()
    return entry
  }

  // ── Weight learning ───────────────────────────────────────────────────────

  /**
   * Recompute learned weights from the full feedback history.
   * Called automatically after each new feedback entry.
   */
  private recomputeWeights(): void {
    if (this.feedback.length === 0) return

    // Group by category
    const byCat: Record<string, ExplanationFeedback[]> = {}
    const bySev: Record<string, ExplanationFeedback[]> = {}
    for (const fb of this.feedback) {
      const cat = fb.anomalyCategory || 'unknown'
      const sev = fb.anomalySeverity || 'info'
      if (!byCat[cat]) byCat[cat] = []
      if (!bySev[sev]) bySev[sev] = []
      byCat[cat].push(fb)
      bySev[sev].push(fb)
    }

    // Helpfulness rate per category → multiplier
    const categoryMultipliers: Record<string, number> = {}
    for (const [cat, entries] of Object.entries(byCat)) {
      if (entries.length < 3) continue // not enough data
      const rate = entries.filter(e => e.helpful).length / entries.length
      // Map rate 0–1 → multiplier 0.6–1.4
      categoryMultipliers[cat] = clamp(0.6 + rate * 0.8, 0.6, 1.4)
    }

    const severityMultipliers: Record<string, number> = {}
    for (const [sev, entries] of Object.entries(bySev)) {
      if (entries.length < 3) continue
      const rate = entries.filter(e => e.helpful).length / entries.length
      severityMultipliers[sev] = clamp(0.6 + rate * 0.8, 0.6, 1.4)
    }

    // Global adjustment: average rating normalised to ±0.2
    const avgRating =
      this.feedback.reduce((s, fb) => s + fb.rating, 0) / this.feedback.length
    // Rating 3/5 → 0, rating 5/5 → +0.2, rating 1/5 → -0.2
    const globalAdjustment = clamp(((avgRating - 3) / 2) * 0.2, -0.2, 0.2)

    this.weights = { categoryMultipliers, severityMultipliers, globalAdjustment }
    this.saveWeights()
  }

  // ── Query API ─────────────────────────────────────────────────────────────

  /**
   * Return the learned weights for use by the explanation engine.
   */
  getWeights(): LearnedWeights {
    return { ...this.weights }
  }

  /**
   * Adjust the raw confidence of an explanation using the learned weights.
   * Returns an adjusted ExplanationConfidence level.
   */
  adjustConfidence(
    rawConfidence: ExplanationConfidence,
    category: string,
    severity: string
  ): ExplanationConfidence {
    const confidenceMap: Record<ExplanationConfidence, number> = {
      high: 0.9, medium: 0.6, low: 0.3,
    }
    let score = confidenceMap[rawConfidence]

    const catMult = this.weights.categoryMultipliers[category] ?? 1
    const sevMult = this.weights.severityMultipliers[severity] ?? 1
    score = clamp(score * catMult * sevMult + this.weights.globalAdjustment, 0, 1)

    if (score >= 0.75) return 'high'
    if (score >= 0.45) return 'medium'
    return 'low'
  }

  /**
   * Summarise the full feedback history.
   */
  getSummary(): FeedbackSummary {
    const n = this.feedback.length
    if (n === 0) {
      return {
        totalFeedback: 0,
        helpfulCount: 0,
        unhelpfulCount: 0,
        averageRating: 0,
        helpfulnessPct: 0,
        categoryRates: {},
        severityRates: {},
        lastUpdated: new Date().toISOString(),
      }
    }

    const helpfulCount = this.feedback.filter(fb => fb.helpful).length
    const avgRating = this.feedback.reduce((s, fb) => s + fb.rating, 0) / n

    // Per-category rates
    const byCat: Record<string, ExplanationFeedback[]> = {}
    const bySev: Record<string, ExplanationFeedback[]> = {}
    for (const fb of this.feedback) {
      const cat = fb.anomalyCategory || 'unknown'
      const sev = fb.anomalySeverity || 'info'
      if (!byCat[cat]) byCat[cat] = []
      if (!bySev[sev]) bySev[sev] = []
      byCat[cat].push(fb)
      bySev[sev].push(fb)
    }

    const categoryRates: Record<string, number> = {}
    for (const [cat, entries] of Object.entries(byCat)) {
      categoryRates[cat] = Math.round(
        (entries.filter(e => e.helpful).length / entries.length) * 100
      )
    }
    const severityRates: Record<string, number> = {}
    for (const [sev, entries] of Object.entries(bySev)) {
      severityRates[sev] = Math.round(
        (entries.filter(e => e.helpful).length / entries.length) * 100
      )
    }

    const last = this.feedback[this.feedback.length - 1]
    return {
      totalFeedback: n,
      helpfulCount,
      unhelpfulCount: n - helpfulCount,
      averageRating: Math.round(avgRating * 10) / 10,
      helpfulnessPct: Math.round((helpfulCount / n) * 100),
      categoryRates,
      severityRates,
      lastUpdated: last?.timestamp ?? new Date().toISOString(),
    }
  }

  /**
   * Return recent feedback entries (default: last 20).
   */
  getRecentFeedback(limit = 20): ExplanationFeedback[] {
    return this.feedback.slice(-limit).reverse()
  }

  /**
   * Check whether a specific explanation has already been rated.
   */
  hasFeedback(explanationId: string): boolean {
    return this.feedback.some(fb => fb.explanationId === explanationId)
  }

  /**
   * Get feedback for a specific explanation.
   */
  getFeedbackForExplanation(explanationId: string): ExplanationFeedback | null {
    return (
      [...this.feedback].reverse().find(fb => fb.explanationId === explanationId) ??
      null
    )
  }

  /**
   * Clear all feedback and reset learned weights.
   */
  clear(): void {
    this.feedback = []
    this.weights = { categoryMultipliers: {}, severityMultipliers: {}, globalAdjustment: 0 }
    try {
      localStorage.removeItem(STORAGE_KEY_FEEDBACK)
      localStorage.removeItem(STORAGE_KEY_WEIGHTS)
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _store: FeedbackStore | null = null

/**
 * Get the shared FeedbackStore singleton.
 * Lazily initialised on first call (safe in SSR/test environments).
 */
export function getFeedbackStore(): FeedbackStore {
  if (!_store) _store = new FeedbackStore()
  return _store
}

/**
 * Convenience: record feedback without holding a store reference.
 */
export function recordAnomalyFeedback(
  explanation: AnomalyExplanation,
  helpful: boolean,
  rating: FeedbackRating,
  actionTaken: string | null = null,
  comment = ''
): ExplanationFeedback {
  return getFeedbackStore().recordFeedback(explanation, helpful, rating, actionTaken, comment)
}

/**
 * Convenience: get feedback summary stats.
 */
export function getFeedbackSummary(): FeedbackSummary {
  return getFeedbackStore().getSummary()
}
