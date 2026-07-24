/**
 * refactoring/types.ts
 *
 * Type definitions for the AI-powered code refactoring
 * recommendation system.
 */

export type RefactorKind =
  | 'extract-function'
  | 'simplify-conditional'
  | 'reduce-complexity'
  | 'remove-dead-code'
  | 'rename-symbol'
  | 'replace-any'
  | 'split-file'
  | 'memoize'
  | 'inline-trivial'
  | 'consolidate-duplicates'
  | 'reduce-parameters'
  | 'modernize-syntax'
  | 'add-type-annotation'
  | 'flatten-nesting';

export type RefactorSeverity = 'info' | 'warning' | 'critical';

export interface FileTarget {
  /** Absolute or repo-relative file path */
  path: string;
  /** Language */
  language: 'ts' | 'tsx' | 'js' | 'jsx';
  /** Full source text */
  source: string;
}

export interface FunctionBlock {
  name: string;
  /** Start line (1-indexed) */
  startLine: number;
  /** End line (1-indexed) */
  endLine: number;
  /** Lines of code (excluding blanks/comments) */
  loc: number;
  /** McCabe-style cyclomatic complexity */
  cyclomaticComplexity: number;
  /** Maximum nesting depth encountered */
  maxNestingDepth: number;
  /** Number of parameters */
  paramCount: number;
  /** Distinct identifiers referenced (proxy for fan-out) */
  identifierFanOut: number;
  /** Frame location for code preview */
  preview: string;
}

export interface FileMetrics {
  path: string;
  language: 'ts' | 'tsx' | 'js' | 'jsx';
  loc: number;
  /** Logical lines of code (no comments / blanks) */
  logicalLoc: number;
  /** Non-executable noise ratio (blanks + comments / loc). */
  nonCodeRatio: number;
  averageLineLength: number;
  maxLineLength: number;
  /** Number of `console.log` calls (heuristic for debug spam) */
  consoleUsage: number;
  /** Number of `: any` annotations (browser-safe count) */
  anyUsage: number;
  /** Number of `// TODO` / `// FIXME` markers */
  todoCount: number;
  /** Approximate duplicate literal strings count */
  duplicateLiteralScore: number;
  /** Strong-typing proxy: type annotations / total lines */
  typeAnnotationRatio: number;
  /** Tracked function blocks */
  functions: FunctionBlock[];
  overallCyclomaticComplexity: number;
  averageFunctionComplexity: number;
  /** Average number of parameters per function */
  averageParameters: number;
  /** Smallest extract-worthy block size */
  longestFunction: { name: string; loc: number; line: number };
}

export interface RefactoringSuggestion {
  id: string;
  kind: RefactorKind;
  title: string;
  description: string;
  rationale: string;
  /** Path of the file that contains the opportunity */
  file: string;
  /** Suggested line range */
  startLine: number;
  endLine: number;
  preview: string;
  severity: RefactorSeverity;
  /** Estimated lines saved */
  linesSaved: number;
  /** Estimated cyclomatic complexity delta (positive = reduction) */
  complexityDelta: number;
  /** Estimated improvement in the maintainability index (0-100) */
  maintainabilityDelta: number;
  /** Effort in minutes (rough) */
  effortMinutes: number;
  /** Coupling fan-out count */
  coupling: number;
  /** Whether tests cover the file (heuristic) */
  coveredByTests: boolean;
  /** Whether the suggestion contains `any` types */
  hasAnyType: boolean;
  /** Whether the target is exported and used elsewhere */
  isPublicApi: boolean;
  /** ML confidence (0-1) */
  confidence: number;
  /** Safety score (0-1) */
  safety: number;
  /** Composite priority score 0-100 */
  priority: number;
  /** Estimated labels the model picked */
  predictedLabels: string[];
}

export interface Hotspot {
  file: string;
  /** ML anomaly score 0-1 (higher = more deviant) */
  anomalyScore: number;
  contributingFactors: string[];
  /** Mean metric value across the corpus (for comparison) */
  baseline: { avgLoc: number; avgComplexity: number; avgParams: number };
}

export interface PrioritizedSuggestion extends RefactoringSuggestion {
  rank: number;
  bucket: 'safe-now' | 'review-needed' | 'high-effort';
}

export interface RefactorReport {
  generatedAt: string;
  totalFilesAnalysed: number;
  totalFunctionsAnalysed: number;
  totalSuggestions: number;
  averageAcceptanceProbability: number;
  /** Overall composite code quality score (0-100) */
  codeQualityScore: number;
  /** Top hotspots */
  hotspots: Hotspot[];
  /** Pri-order ranked suggestions */
  suggestions: PrioritizedSuggestion[];
  /** Quality category breakdown */
  issueBreakdown: Record<RefactorKind, number>;
  /** Estimated total impact */
  impact: {
    totalLinesSaved: number;
    totalComplexityReduction: number;
    totalMaintainabilityGain: number;
  };
}

export interface RecommendOptions {
  /** Only consider files matching one of these paths */
  fileFilter?: (path: string) => boolean;
  /** Limit number of suggestions returned */
  maxSuggestions?: number;
  /** Minimum priority score to include */
  minPriority?: number;
  /** Include risky suggestions even if safety is low */
  includeRisky?: boolean;
}

export interface SafetyAssessment {
  safety: number; // 0-1
  reasons: string[];
  warnings: string[];
  safeToAutoApply: boolean;
}

export interface ImpactAssessment {
  linesSaved: number;
  complexityDelta: number;
  maintainabilityDelta: number;
  maintainabilityIndexAfter: number;
  effortMinutes: number;
  estimatedAcceptanceProbability: number;
}
