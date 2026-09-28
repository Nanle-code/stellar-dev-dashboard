/**
 * codeReview/types.ts
 *
 * Type definitions for the AI-Powered Code Review Assistant.
 * Defines the data structures for static analysis results,
 * ML-based issue detection, review checklists, and best
 * practice recommendations.
 */

// ─── Issue Severity ──────────────────────────────────────────────────────────

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// ─── Issue Categories ────────────────────────────────────────────────────────

export type CodeReviewCategory =
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'reliability'
  | 'stellar-best-practice'
  | 'type-safety'
  | 'code-style'
  | 'testing'
  | 'documentation'
  | 'complexity'
  | 'potential-bug';

// ─── Code Review Issue ────────────────────────────────────────────────────────

export interface CodeReviewIssue {
  /** Unique identifier */
  id: string;
  /** Category of the issue */
  category: CodeReviewCategory;
  /** Severity level */
  severity: IssueSeverity;
  /** Short title for display */
  title: string;
  /** Detailed description of the issue */
  description: string;
  /** File path where the issue was found */
  file: string;
  /** Start line number (1-indexed) */
  startLine: number;
  /** End line number (1-indexed) */
  endLine: number;
  /** The problematic code snippet */
  snippet?: string;
  /** Suggested fix or remediation */
  suggestion: string;
  /** Rationale explaining why this matters */
  rationale: string;
  /** ML confidence score (0-1) for this detection */
  confidence: number;
  /** Estimated effort to fix (minutes) */
  effortMinutes: number;
  /** Whether this is likely a false positive */
  likelyFalsePositive: boolean;
  /** Specific Stellar-related tags */
  stellarTags?: string[];
  /** Links to relevant documentation */
  references?: string[];
}

// ─── Review Checklist Item ────────────────────────────────────────────────────

export type ChecklistCategory =
  | 'security'
  | 'stellar-specific'
  | 'code-quality'
  | 'testing'
  | 'performance'
  | 'documentation'
  | 'accessibility'
  | 'error-handling';

export interface ReviewChecklistItem {
  /** Unique ID */
  id: string;
  /** Category of the checklist item */
  category: ChecklistCategory;
  /** The check prompt */
  prompt: string;
  /** Detailed explanation of what to look for */
  details: string;
  /** Whether this is a Stellar-specific check */
  isStellarSpecific: boolean;
  /** Auto-detected status: 'pass' | 'fail' | 'warning' | 'unknown' */
  autoStatus: 'pass' | 'fail' | 'warning' | 'unknown';
  /** Evidence or reasoning for autoStatus */
  evidence?: string;
}

// ─── Best Practice Recommendation ─────────────────────────────────────────────

export interface BestPracticeRecommendation {
  /** Unique ID */
  id: string;
  /** Title of the recommendation */
  title: string;
  /** Detailed recommendation description */
  description: string;
  /** Stellar domain area */
  domain: 'stellar-core' | 'soroban' | 'horizon' | 'sdk' | 'general';
  /** Priority: 'essential' | 'recommended' | 'suggested' */
  priority: 'essential' | 'recommended' | 'suggested';
  /** Code example showing good practice */
  goodExample?: string;
  /** Code example showing poor practice */
  badExample?: string;
  /** Link to official Stellar documentation */
  docReference?: string;
  /** Applicable file patterns (e.g., ['*.ts', '*.js']) */
  appliesTo: string[];
}

// ─── Full Code Review Result ─────────────────────────────────────────────────

export interface CodeReviewResult {
  /** Timestamp of the analysis */
  analyzedAt: string;
  /** Source files that were analyzed */
  analyzedFiles: string[];
  /** All detected issues */
  issues: CodeReviewIssue[];
  /** Issues grouped by severity count */
  severityBreakdown: Record<IssueSeverity, number>;
  /** Issues grouped by category count */
  categoryBreakdown: Record<CodeReviewCategory, number>;
  /** Auto-generated review checklist */
  checklist: ReviewChecklistItem[];
  /** Stellar-specific best practice findings */
  bestPractices: BestPracticeRecommendation[];
  /** Overall code health score (0-100) */
  codeHealthScore: number;
  /** Summary of the review */
  summary: string;
  /** Top recommendations for action */
  topRecommendations: string[];
  /** Estimated total effort to fix all issues (minutes) */
  totalEstimatedEffortMinutes: number;
  /** Percentage of code that passes review standards */
  passRate: number;
  /** Number of critical/high issues */
  criticalCount: number;
  /** Whether this passes the review gate */
  passesGate: boolean;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface SourceFile {
  /** File path relative to project root */
  path: string;
  /** File extension / language */
  language: 'ts' | 'tsx' | 'js' | 'jsx' | 'json' | 'md';
  /** Full source text */
  source: string;
}

export interface CodeReviewOptions {
  /** Focus on specific categories */
  categories?: CodeReviewCategory[];
  /** Minimum severity to report */
  minSeverity?: IssueSeverity;
  /** File patterns to include (default: all source files) */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Enable Stellar-specific best practice checks */
  stellarBestPractices?: boolean;
  /** Generate a review checklist */
  generateChecklist?: boolean;
  /** Custom pass threshold (0-100) */
  passThreshold?: number;
}

// ─── Detector Interface ──────────────────────────────────────────────────────

export interface DetectorContext {
  /** The source file being analyzed */
  file: SourceFile;
  /** Line-split source for line-level analysis */
  lines: string[];
  /** Complete source as a single string */
  source: string;
}

export type IssueDetector = (ctx: DetectorContext) => CodeReviewIssue[];
