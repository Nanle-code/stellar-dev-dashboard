/**
 * src/lib/anomalyExplanation/index.ts
 * Feature #591: Module entry point for the AI-Powered Anomaly Explanation system.
 *
 * Exports the public API and provides the high-level `buildAnomalyExplanations`
 * context builder that integrates the explainer with the feedback-learned weights.
 */

export type {
  AnomalyExplanation,
  ExplanationConfidence,
  FeatureImportance,
  ExplainerContext,
} from './anomalyExplainer'

export {
  explainPattern,
  explainPatterns,
  explainAnomalyScore,
} from './anomalyExplainer'

export type {
  ExplanationFeedback,
  FeedbackRating,
  FeedbackSummary,
  LearnedWeights,
} from './feedbackStore'

export {
  getFeedbackStore,
  recordAnomalyFeedback,
  getFeedbackSummary,
} from './feedbackStore'

// ---------------------------------------------------------------------------
// High-level context builder
// ---------------------------------------------------------------------------

import { explainPatterns, explainAnomalyScore } from './anomalyExplainer'
import { getFeedbackStore } from './feedbackStore'
import type { AnomalyExplanation, ExplainerContext } from './anomalyExplainer'
import type {
  DetectedPattern,
  AnomalyScore,
} from '../transactionPatternAnalysis'

export interface AnomalyExplanationSet {
  /** Explanation for each detected pattern, sorted by magnitude */
  patternExplanations: AnomalyExplanation[]
  /** Explanation for the overall anomaly score */
  overallExplanation: AnomalyExplanation | null
  /** Whether any high/critical-confidence explanations exist */
  hasHighConfidence: boolean
  /** Total count of explanations generated */
  count: number
  /** ISO timestamp of generation */
  generatedAt: string
}

/**
 * Build a complete set of anomaly explanations from a pattern analysis result.
 *
 * Combines the per-pattern explainer output with the feedback-adjusted
 * confidence levels so that explanations improve with user input over time.
 *
 * @param patterns  DetectedPattern[] from analyzeTransactionPatterns()
 * @param anomalyScore  AnomalyScore from the same analysis result
 * @param context   Raw transaction/operation data for feature extraction
 * @returns  AnomalyExplanationSet ready for UI consumption
 */
export function buildAnomalyExplanations(
  patterns: DetectedPattern[],
  anomalyScore: AnomalyScore,
  context: ExplainerContext
): AnomalyExplanationSet {
  const store = getFeedbackStore()

  // Generate raw explanations
  const patternExplanations = explainPatterns(patterns, context).map(exp => ({
    ...exp,
    // Apply feedback-learned confidence adjustment
    confidence: store.adjustConfidence(exp.confidence, exp.category, exp.severity),
  }))

  // Generate an overall explanation only if the anomaly score is notable
  let overallExplanation: AnomalyExplanation | null = null
  if (anomalyScore.score >= 30) {
    const raw = explainAnomalyScore(anomalyScore, context)
    overallExplanation = {
      ...raw,
      confidence: store.adjustConfidence(raw.confidence, raw.category, raw.severity),
    }
  }

  const all = [
    ...patternExplanations,
    ...(overallExplanation ? [overallExplanation] : []),
  ]

  return {
    patternExplanations,
    overallExplanation,
    hasHighConfidence: all.some(e => e.confidence === 'high'),
    count: all.length,
    generatedAt: new Date().toISOString(),
  }
}
