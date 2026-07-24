/**
 * refactoring/impactAssessment.ts
 *
 * Translates raw suggestion metrics into a normalized ImpactAssessment.
 * The composite intentionally blends complexity reduction, lines saved,
 * maintainability gain, and effort to keep automated rankings fair.
 */

import type {
  FileMetrics,
  ImpactAssessment,
  PrioritizedSuggestion,
  RefactoringSuggestion,
} from './types.js';

export interface CorpusBaseline {
  averageLoc: number;
  averageComplexity: number;
  averageParameters: number;
  averageAnyUsage: number;
}

export function buildBaseline(files: FileMetrics[]): CorpusBaseline {
  if (!files.length) {
    return {
      averageLoc: 0,
      averageComplexity: 0,
      averageParameters: 0,
      averageAnyUsage: 0,
    };
  }
  const totalLoc = files.reduce((s, f) => s + f.loc, 0);
  const totalComplexity = files.reduce(
    (s, f) => s + f.averageFunctionComplexity * f.functions.length,
    0
  );
  const totalParams = files.reduce(
    (s, f) => s + f.averageParameters * f.functions.length,
    0
  );
  const totalAny = files.reduce((s, f) => s + f.anyUsage, 0);
  const fns = files.reduce((s, f) => s + f.functions.length, 0) || 1;
  return {
    averageLoc: totalLoc / files.length,
    averageComplexity: totalComplexity / fns,
    averageParameters: totalParams / fns,
    averageAnyUsage: totalAny / files.length,
  };
}

export function computeImpact(
  suggestion: RefactoringSuggestion,
  file: FileMetrics,
  baseline: CorpusBaseline
): ImpactAssessment {
  const complexityFactor = Math.min(1, suggestion.complexityDelta / 6);
  const linesFactor = Math.min(1, suggestion.linesSaved / 30);
  const maintain = Math.min(1, suggestion.maintainabilityDelta / 8);
  const effort = Math.max(1, suggestion.effortMinutes);

  // Estimated acceptance probability lifts suggestions that have high
  // impact, low effort, and reasonable confidence.
  const effortPenalty = Math.min(1, effort / 60);
  const acceptanceProbability = Math.max(
    0.05,
    1 - effortPenalty + 0.25 * (complexityFactor + linesFactor + maintain) / 3
  );

  // Maintainability Index (Halstead-style simplified).
  const mi = maintainabilityIndex(file);
  const miDelta = Math.min(20, suggestion.maintainabilityDelta * 1.5);

  return {
    linesSaved: suggestion.linesSaved,
    complexityDelta: suggestion.complexityDelta,
    maintainabilityDelta: miDelta,
    maintainabilityIndexAfter: Math.min(100, Math.max(0, mi + miDelta)),
    effortMinutes: effort,
    estimatedAcceptanceProbability: Number(
      (acceptanceProbability * 100).toFixed(1)
    ),
  };
}

/**
 * Compute priority score 0-100 using:
 *   priority = (impact * confidence * 70) + (safety * 30)
 * where impact is the aggregate of normalized benefit signals.
 */
export function computePriority(
  suggestion: RefactoringSuggestion,
  impact: ImpactAssessment
): number {
  const benefit =
    (impact.complexityDelta + impact.linesSaved + impact.maintainabilityDelta) /
    3;
  const normalized = Math.min(1, benefit / 10);
  const safety = suggestion.safety;
  const score =
    normalized * suggestion.confidence * 70 + safety * 30;
  return Number(score.toFixed(1));
}

/**
 * Rank suggestions by priority score, attaching a friendly bucket tag.
 */
export function rankSuggestions(
  suggestions: RefactoringSuggestion[],
  safetyScores: Record<string, number>
): PrioritizedSuggestion[] {
  const sorted = suggestions
    .slice()
    .sort((a, b) => b.priority - a.priority)
    .map((s, idx) => {
      const safety = safetyScores[s.id] ?? s.safety;
      const bucket: PrioritizedSuggestion['bucket'] =
        safety >= 0.85 && s.priority >= 70
          ? 'safe-now'
          : s.priority >= 50
            ? 'review-needed'
            : 'high-effort';
      return {
        ...s,
        safety,
        rank: idx + 1,
        bucket,
      };
    });
  return sorted;
}

/**
 * Simplified Maintainability Index (range 0-100). The Halstead formula is
 * intentionally reduced to a stable, browser-friendly variant.
 */
export function maintainabilityIndex(file: FileMetrics): number {
  const avgCc = file.averageFunctionComplexity || 1;
  const loc = Math.max(1, file.loc);
  const comment = Math.max(0, file.nonCodeRatio);
  // MI = 171 - 5.2 * ln(V) - 0.23 * CC - 16.2 * ln(LOC) + 50 * sin(sqrt(2.46 * comment))
  // We use a linear approximation for speed.
  const ccPenalty = Math.min(50, avgCc * 4);
  const locPenalty = Math.min(30, Math.log(loc) * 4);
  const commentBoost = comment * 20;
  const mi = 100 - ccPenalty - locPenalty + commentBoost;
  return Number(Math.max(0, Math.min(100, mi)).toFixed(1));
}
