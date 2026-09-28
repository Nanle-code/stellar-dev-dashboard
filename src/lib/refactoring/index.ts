/**
 * refactoring/index.ts
 *
 * Public surface of the AI refactoring recommendation system.
 */

export { analyzeFile, analyzeFiles } from './codeAnalyzer.js';
export {
  runDetectors,
  type Detector,
} from './refactoringPatterns.js';
export {
  buildBaseline,
  computeImpact,
  computePriority,
  maintainabilityIndex,
  rankSuggestions,
  type CorpusBaseline,
} from './impactAssessment.js';
export {
  assessSafety,
  buildSafetyContext,
  type SafetyContext,
} from './safetyAnalysis.js';
export {
  recommend,
  type RecommendInput,
  type RecommendResult,
} from './recommender.js';
export { toJSON, toMarkdown, toHTML } from './reportGenerator.js';
export * from './types.js';
