/**
 * codeReview/index.ts
 *
 * Public API surface for the AI-Powered Code Review Assistant.
 * Provides static analysis, ML-enhanced issue detection, review
 * checklist generation, best practice recommendations, and
 * report generation in a unified interface.
 */

export { analyzeFiles, CodeAnomalyDetector } from './staticAnalyzer';
export { generateReviewChecklist, getChecklistStats } from './reviewChecklistGenerator';
export {
  getPrioritizedSuggestions,
  clusterSuggestions,
  generateTopRecommendations,
  runCodeReview,
} from './codeReviewSuggestions';
export {
  getAllBestPractices,
  getBestPracticesByDomain,
  getBestPracticesByPriority,
  getRelevantBestPractices,
  checkBestPracticesViolations,
} from './stellarBestPractices';
export { toJSON, toMarkdown, toHTML } from './reportGenerator';

export type {
  CodeReviewIssue,
  CodeReviewCategory,
  CodeReviewResult,
  CodeReviewOptions,
  ReviewChecklistItem,
  BestPracticeRecommendation,
  SourceFile,
  IssueSeverity,
  IssueDetector,
  DetectorContext,
  ChecklistCategory,
  ReviewChecklistItem as ChecklistItem,
} from './types';
