/**
 * codeReview/codeReviewSuggestions.ts
 *
 * Generates actionable code improvement suggestions from the
 * detected issues. Each suggestion is prioritized by severity,
 * confidence, and estimated effort so developers can focus on
 * the most impactful changes first.
 */

import type { CodeReviewIssue, CodeReviewResult, SourceFile, CodeReviewCategory, IssueSeverity, CodeReviewOptions } from './types';
import { analyzeFiles } from './staticAnalyzer';
import { generateReviewChecklist, getChecklistStats } from './reviewChecklistGenerator';
import { getAllBestPractices, checkBestPracticesViolations } from './stellarBestPractices';
import type { BestPracticeRecommendation } from './types';

// ─── Suggestion Prioritization ───────────────────────────────────────────────

export interface PrioritizedSuggestion {
  issue: CodeReviewIssue;
  priorityScore: number;
  category: string;
  effortLabel: string;
  impactLabel: string;
}

function computePriorityScore(issue: CodeReviewIssue): number {
  const severityWeight: Record<string, number> = {
    critical: 100,
    high: 70,
    medium: 40,
    low: 20,
    info: 5,
  };

  const baseScore = severityWeight[issue.severity] || 0;
  const confidenceBonus = issue.confidence * 20; // up to 20 pts for high confidence
  const effortPenalty = Math.min(30, issue.effortMinutes * 0.5); // penalty for long efforts

  return Math.max(0, baseScore + confidenceBonus - effortPenalty);
}

function getEffortLabel(minutes: number): string {
  if (minutes <= 5) return 'quick';
  if (minutes <= 15) return 'short';
  if (minutes <= 30) return 'medium';
  if (minutes <= 60) return 'long';
  return 'extensive';
}

function getImpactLabel(issue: CodeReviewIssue): string {
  if (issue.severity === 'critical' || issue.severity === 'high') return 'high';
  if (issue.severity === 'medium') return 'medium';
  return 'low';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get prioritized suggestions from detected issues.
 */
export function getPrioritizedSuggestions(
  issues: CodeReviewIssue[]
): PrioritizedSuggestion[] {
  return issues
    .map((issue) => ({
      issue,
      priorityScore: computePriorityScore(issue),
      category: issue.category,
      effortLabel: getEffortLabel(issue.effortMinutes),
      impactLabel: getImpactLabel(issue),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Cluster suggestions into actionable groups.
 */
export function clusterSuggestions(
  suggestions: PrioritizedSuggestion[]
): {
  quickWins: PrioritizedSuggestion[];
  highImpact: PrioritizedSuggestion[];
  strategic: PrioritizedSuggestion[];
} {
  return {
    quickWins: suggestions.filter(
      (s) => s.effortLabel === 'quick' && s.impactLabel === 'high'
    ),
    highImpact: suggestions.filter(
      (s) => s.impactLabel === 'high' && s.effortLabel !== 'quick'
    ),
    strategic: suggestions.filter(
      (s) => s.impactLabel !== 'high' || s.effortLabel === 'extensive'
    ),
  };
}

/**
 * Generate top actionable recommendations from issues.
 */
export function generateTopRecommendations(
  issues: CodeReviewIssue[],
  maxRecommendations: number = 5
): string[] {
  const prioritized = getPrioritizedSuggestions(issues);
  const seen = new Set<string>();
  const recommendations: string[] = [];

  for (const s of prioritized) {
    const key = s.issue.category + ':' + s.issue.title.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);

    const prefix = s.issue.severity === 'critical' ? '🚨' :
      s.issue.severity === 'high' ? '⚠️' : '💡';

    recommendations.push(
      `${prefix} **${s.issue.title}** — ${s.issue.suggestion.slice(0, 80)}... (${s.effortLabel})`
    );

    if (recommendations.length >= maxRecommendations) break;
  }

  return recommendations;
}

/**
 * Run the complete code review pipeline and return the result.
 */
export function runCodeReview(
  files: SourceFile[],
  options?: {
    categories?: CodeReviewCategory[];
    minSeverity?: IssueSeverity;
    stellarBestPractices?: boolean;
    generateChecklist?: boolean;
    passThreshold?: number;
  }
): CodeReviewResult {
  // Run static analysis
  const issuesOptions: CodeReviewOptions = {
    stellarBestPractices: options?.stellarBestPractices,
    generateChecklist: options?.generateChecklist,
    passThreshold: options?.passThreshold,
  };
  if (options?.categories) issuesOptions.categories = options.categories;
  if (options?.minSeverity) issuesOptions.minSeverity = options.minSeverity;
  const issues = analyzeFiles(files, issuesOptions);

  // Generate checklist
  const checklistOptions: CodeReviewOptions = {};
  if (options?.categories) checklistOptions.categories = options.categories;
  const checklist = generateReviewChecklist(files, issues, checklistOptions);

  // Get best practices
  const bestPractices = options?.stellarBestPractices !== false
    ? checkBestPracticesViolations(files)
    : [];

  // Build severity and category breakdowns
  const severityBreakdown: Record<IssueSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  const categoryBreakdown: Record<CodeReviewCategory, number> = {} as Record<CodeReviewCategory, number>;

  for (const issue of issues) {
    severityBreakdown[issue.severity]++;
    const cat = issue.category as CodeReviewCategory;
    categoryBreakdown[cat] = ((categoryBreakdown as Record<string, number>)[cat] || 0) + 1;
  }

  // Compute scores
  const checklistStats = getChecklistStats(checklist);
  const passRate = checklistStats.total > 0
    ? Math.round((checklistStats.pass / checklistStats.total) * 100)
    : 0;

  const severityScore = Math.max(0, 100 -
    severityBreakdown.critical * 15 -
    severityBreakdown.high * 8 -
    severityBreakdown.medium * 3 -
    severityBreakdown.low * 1);
  const checklistScore = passRate;
  const bestPracticeScore = issues.filter((i) => i.stellarTags?.length).length > 0
    ? Math.max(0, 100 - issues.filter((i) => i.stellarTags?.length).length * 5)
    : 90;

  const codeHealthScore = Math.round(
    severityScore * 0.5 + checklistScore * 0.3 + bestPracticeScore * 0.2
  );

  // Build summary
  const prioritized = getPrioritizedSuggestions(issues);
  const clusters = clusterSuggestions(prioritized);
  const totalEffort = issues.reduce((sum, i) => sum + i.effortMinutes, 0);
  const criticalCount = severityBreakdown.critical + severityBreakdown.high;
  const passesGate = criticalCount === 0 && passRate >= 70;

  const summaryLines: string[] = [];
  summaryLines.push(`Code review found ${issues.length} issue${issues.length !== 1 ? 's' : ''} across ${files.length} file${files.length !== 1 ? 's' : ''}.`);
  if (criticalCount > 0) {
    summaryLines.push(`${criticalCount} critical/high severity issue${criticalCount > 1 ? 's' : ''} require${criticalCount === 1 ? 's' : ''} immediate attention.`);
  }
  if (clusters.quickWins.length > 0) {
    summaryLines.push(`${clusters.quickWins.length} quick win${clusters.quickWins.length > 1 ? 's' : ''} identified (high impact, low effort).`);
  }
  summaryLines.push(`Code health score: ${codeHealthScore}/100 — ${codeHealthScore >= 70 ? '✅ Good' : codeHealthScore >= 45 ? '⚠️ Needs improvement' : '❌ Critical attention needed'}.`);

  const topRecommendations = generateTopRecommendations(issues);

  return {
    analyzedAt: new Date().toISOString(),
    analyzedFiles: files.map((f) => f.path),
    issues,
    severityBreakdown,
    categoryBreakdown,
    checklist,
    bestPractices,
    codeHealthScore,
    summary: summaryLines.join(' '),
    topRecommendations,
    totalEstimatedEffortMinutes: totalEffort,
    passRate,
    criticalCount,
    passesGate,
  };
}

export type { PrioritizedSuggestion };
