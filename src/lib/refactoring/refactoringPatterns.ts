/**
 * refactoring/refactoringPatterns.ts
 *
 * Pattern database. Each detector consumes a cleaned-up structure
 * derived from FileMetrics and produces zero or more candidate
 * suggestions. Detectors are pure, synchronous, and side-effect free.
 */

import type {
  FileMetrics,
  FunctionBlock,
  RefactorKind,
  RefactorSeverity,
  RefactoringSuggestion,
} from './types.js';

interface DetectorContext {
  file: FileMetrics;
  /** Raw source text (used by detectors that need lexical inspection). */
  source: string;
  coveredByTests: boolean;
  isPublicApi: boolean;
  /** External coupling count (import count for this file) */
  coupling: number;
}

type Detector = (ctx: DetectorContext) => RefactoringSuggestion[];

const detectors: Record<RefactorKind, Detector> = {
  'extract-function': detectExtractFunction,
  'simplify-conditional': detectSimplifyConditional,
  'reduce-complexity': detectReduceComplexity,
  'remove-dead-code': detectDeadCode,
  'rename-symbol': detectRenameIssues,
  'replace-any': detectReplaceAny,
  'split-file': detectSplitFile,
  memoize: detectMemoize,
  'inline-trivial': detectInlineTrivial,
  'consolidate-duplicates': detectConsolidateDuplicates,
  'reduce-parameters': detectReduceParameters,
  'modernize-syntax': detectModernizeSyntax,
  'add-type-annotation': detectAddTypeAnnotation,
  'flatten-nesting': detectFlattenNesting,
};

export function runDetectors(context: DetectorContext): RefactoringSuggestion[] {
  const all: RefactoringSuggestion[] = [];
  for (const kind of Object.keys(detectors) as RefactorKind[]) {
    try {
      all.push(...detectors[kind](context));
    } catch (err) {
      // Detectors must never break analysis; log and continue.
      // eslint-disable-next-line no-console
      console.warn(`[refactoring] detector ${kind} failed`, err);
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextId(kind: RefactorKind, file: string, line: number): string {
  const hash = simpleHash(`${kind}:${file}:${line}`);
  return `${kind}-${hash.toString(36)}`;
}

function simpleHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return h >>> 0;
}

function previewBlock(file: FileMetrics, block: FunctionBlock): string {
  return block.preview;
}

function previewLines(file: FileMetrics, start: number, end: number): string {
  // Returns a short marker for non-function previews
  return `${file.path} (lines ${start}-${end})`;
}

function severityForScore(score: number): RefactorSeverity {
  if (score >= 0.75) return 'critical';
  if (score >= 0.45) return 'warning';
  return 'info';
}

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

/**
 * Detect functions that exceed recommended LOC thresholds
 * and contain nested logic that should be extracted.
 */
function detectExtractFunction(ctx: DetectorContext): RefactoringSuggestion[] {
  const out: RefactoringSuggestion[] = [];
  for (const fn of ctx.file.functions) {
    if (fn.loc < 30) continue; // skip tiny functions
    if (fn.maxNestingDepth < 2 && fn.cyclomaticComplexity < 6) continue;
    const severity = severityForScore(
      Math.min(1, fn.loc / 80 + fn.maxNestingDepth / 5)
    );
    out.push({
      id: nextId('extract-function', ctx.file.path, fn.startLine),
      kind: 'extract-function',
      title: `Extract a sub-function from \`${fn.name}\``,
      description: `\`${fn.name}\` spans ${fn.loc} LOC with nesting depth ${fn.maxNestingDepth}. Extracting cohesive blocks will improve readability.`,
      rationale:
        'Functions over 30 LOC with nested branches are 2.5× more likely to host future defects. Smaller units are easier to reason about and unit-test.',
      file: ctx.file.path,
      startLine: fn.startLine,
      endLine: fn.endLine,
      preview: previewBlock(ctx.file, fn),
      severity,
      linesSaved: Math.round(fn.loc * 0.25),
      complexityDelta: Math.max(1, Math.round(fn.cyclomaticComplexity * 0.3)),
      maintainabilityDelta: Math.min(8, Math.round(fn.loc / 12)),
      effortMinutes: 15 + Math.round(fn.loc / 10),
      coupling: fn.identifierFanOut,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: ctx.file.anyUsage > 0,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.85,
      safety: 0,
      priority: 0,
      predictedLabels: ['extract-function', 'reduce-complexity'],
    });
  }
  return out;
}

function detectSimplifyConditional(ctx: DetectorContext): RefactoringSuggestion[] {
  const out: RefactoringSuggestion[] = [];
  for (const fn of ctx.file.functions) {
    // Approximate the number of ternaries by scanning the preview.
    const ternaries = (fn.preview.match(/\?[^?]+:/g) ?? []).filter((m) => m.length > 4).length;
    const longIfs =
      (fn.preview.match(/\bif\b/g) ?? []).length >= 4 ? 1 : 0;
    const issues = ternaries + longIfs;
    if (issues === 0) continue;
    const severity = severityForScore(Math.min(1, issues / 4));
    out.push({
      id: nextId('simplify-conditional', ctx.file.path, fn.startLine),
      kind: 'simplify-conditional',
      title: `Simplify conditionals in \`${fn.name}\``,
      description: `\`${fn.name}\` has ${ternaries} nested ternar${ternaries === 1 ? 'y' : 'ies'} and ${longIfs} long \`if\` chains.`,
      rationale:
        'Deep conditionals and ternaries reduce code review throughput. Replacing with guard clauses or lookup tables improves correctness.',
      file: ctx.file.path,
      startLine: fn.startLine,
      endLine: fn.endLine,
      preview: previewBlock(ctx.file, fn),
      severity,
      linesSaved: Math.max(2, issues * 3),
      complexityDelta: Math.max(1, issues),
      maintainabilityDelta: Math.min(6, issues * 2),
      effortMinutes: 10 + issues * 4,
      coupling: fn.identifierFanOut,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: ctx.file.anyUsage > 0,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.78,
      safety: 0,
      priority: 0,
      predictedLabels: ['simplify-conditional'],
    });
  }
  return out;
}

function detectReduceComplexity(ctx: DetectorContext): RefactoringSuggestion[] {
  const out: RefactoringSuggestion[] = [];
  for (const fn of ctx.file.functions) {
    if (fn.cyclomaticComplexity < 10) continue;
    const severity = severityForScore(
      Math.min(1, fn.cyclomaticComplexity / 25)
    );
    out.push({
      id: nextId('reduce-complexity', ctx.file.path, fn.startLine),
      kind: 'reduce-complexity',
      title: `Reduce cyclomatic complexity in \`${fn.name}\``,
      description: `\`${fn.name}\` has a cyclomatic complexity of ${fn.cyclomaticComplexity} (threshold: 10).`,
      rationale:
        'Functions with complexity ≥ 10 correlate strongly with bug density and regression risk in studies of TypeScript codebases.',
      file: ctx.file.path,
      startLine: fn.startLine,
      endLine: fn.endLine,
      preview: previewBlock(ctx.file, fn),
      severity,
      linesSaved: Math.round(fn.loc * 0.15),
      complexityDelta: Math.round(fn.cyclomaticComplexity * 0.4),
      maintainabilityDelta: Math.round(fn.cyclomaticComplexity * 0.5),
      effortMinutes: 25 + fn.cyclomaticComplexity,
      coupling: fn.identifierFanOut,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: ctx.file.anyUsage > 0,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.9,
      safety: 0,
      priority: 0,
      predictedLabels: ['reduce-complexity', 'extract-function'],
    });
  }
  return out;
}

function detectDeadCode(ctx: DetectorContext): RefactoringSuggestion[] {
  // We cannot perform comprehensive reachability in browser; instead we
  // flag low-confidence soft signals and let the recommender score them
  // against test coverage.
  const out: RefactoringSuggestion[] = [];
  if (ctx.file.todoCount === 0 && ctx.file.consoleUsage === 0) return out;
  if (ctx.file.consoleUsage >= 3) {
    out.push({
      id: nextId('remove-dead-code', ctx.file.path, 1),
      kind: 'remove-dead-code',
      title: `Remove debug \`console.*\` statements`,
      description: `${ctx.file.consoleUsage} console calls detected. Production bundles leak diagnostic data and add noise.`,
      rationale:
        'Console statements are stripped in production but still ship in debug builds, leaking internal data and increasing bundle size.',
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.file.loc,
      preview: previewLines(ctx.file, 1, ctx.file.loc),
      severity: ctx.file.consoleUsage > 6 ? 'warning' : 'info',
      linesSaved: Math.min(20, ctx.file.consoleUsage * 2),
      complexityDelta: 0,
      maintainabilityDelta: 4,
      effortMinutes: ctx.file.consoleUsage * 2,
      coupling: ctx.coupling,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: false,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.95,
      safety: 0,
      priority: 0,
      predictedLabels: ['remove-dead-code'],
    });
  }
  if (ctx.file.todoCount > 0) {
    out.push({
      id: nextId('remove-dead-code', ctx.file.path, 2),
      kind: 'remove-dead-code',
      title: 'Resolve or remove outstanding TODO/FIXME markers',
      description: `${ctx.file.todoCount} TODO/FIXME markers present.`,
      rationale:
        'TODO markers are grey debt — they accumulate and obscure reliability. Either resolve them or convert them into actionable tickets.',
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.file.loc,
      preview: previewLines(ctx.file, 1, ctx.file.loc),
      severity: ctx.file.todoCount > 4 ? 'warning' : 'info',
      linesSaved: 0,
      complexityDelta: 0,
      maintainabilityDelta: 3,
      effortMinutes: ctx.file.todoCount * 8,
      coupling: ctx.coupling,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: false,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.7,
      safety: 0,
      priority: 0,
      predictedLabels: ['remove-dead-code'],
    });
  }
  return out;
}

function detectRenameIssues(ctx: DetectorContext): RefactoringSuggestion[] {
  const out: RefactoringSuggestion[] = [];
  for (const fn of ctx.file.functions) {
    const tooShort = fn.name.length <= 2 && fn.loc > 12;
    const hasUnderscore = /^_/.test(fn.name) && !/^__/.test(fn.name);
    if (!tooShort && !hasUnderscore) continue;
    out.push({
      id: nextId('rename-symbol', ctx.file.path, fn.startLine),
      kind: 'rename-symbol',
      title: `Rename \`${fn.name}\` for clarity`,
      description: tooShort
        ? 'Identifier is too short for a function with non-trivial body.'
        : 'Leading underscore convention conflicts with modern code style.',
      rationale:
        'Descriptive names reduce time-to-comprehension in code review by up to 40% in empirical studies.',
      file: ctx.file.path,
      startLine: fn.startLine,
      endLine: fn.endLine,
      preview: previewBlock(ctx.file, fn),
      severity: 'info',
      linesSaved: 0,
      complexityDelta: 0,
      maintainabilityDelta: 2,
      effortMinutes: 5,
      coupling: fn.identifierFanOut,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: false,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.6,
      safety: 0,
      priority: 0,
      predictedLabels: ['rename-symbol'],
    });
  }
  return out;
}

function detectReplaceAny(ctx: DetectorContext): RefactoringSuggestion[] {
  if (ctx.file.anyUsage === 0) return [];
  return [
    {
      id: nextId('replace-any', ctx.file.path, 1),
      kind: 'replace-any',
      title: `Replace \`any\` types in ${ctx.file.path}`,
      description: `${ctx.file.anyUsage} uses of \`: any\` detected. Disables most type-safety guarantees.`,
      rationale:
        'Each `any` eliminates static checking for that branch. Narrowing types cuts defect injection rates in ~27% of cases.',
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.file.loc,
      preview: previewLines(ctx.file, 1, ctx.file.loc),
      severity: ctx.file.anyUsage > 5 ? 'critical' : 'warning',
      linesSaved: 0,
      complexityDelta: 0,
      maintainabilityDelta: Math.min(8, ctx.file.anyUsage),
      effortMinutes: ctx.file.anyUsage * 6,
      coupling: ctx.coupling,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: true,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.95,
      safety: 0,
      priority: 0,
      predictedLabels: ['replace-any', 'add-type-annotation'],
    },
  ];
}

function detectSplitFile(ctx: DetectorContext): RefactoringSuggestion[] {
  const out: RefactoringSuggestion[] = [];
  if (ctx.file.loc < 400) return out;
  if (ctx.file.functions.length < 6) return out;
  out.push({
    id: nextId('split-file', ctx.file.path, 1),
    kind: 'split-file',
    title: `Split ${ctx.file.path} into cohesive modules`,
    description: `File is ${ctx.file.loc} LOC across ${ctx.file.functions.length} functions — likely more than one responsibility.`,
    rationale:
      'Files exceeding 400 LOC with many functions are correlated with above-average bug density (Halstead & McCabe data).',
    file: ctx.file.path,
    startLine: 1,
    endLine: ctx.file.loc,
    preview: previewLines(ctx.file, 1, ctx.file.loc),
    severity: ctx.file.loc > 800 ? 'critical' : 'warning',
    linesSaved: 0,
    complexityDelta: 0,
    maintainabilityDelta: ctx.file.loc > 800 ? 12 : 6,
    effortMinutes: ctx.file.loc / 8,
    coupling: ctx.coupling,
    coveredByTests: ctx.coveredByTests,
    hasAnyType: ctx.file.anyUsage > 0,
    isPublicApi: ctx.isPublicApi,
    confidence: 0.72,
    safety: 0,
    priority: 0,
    predictedLabels: ['split-file'],
  });
  return out;
}

function detectMemoize(ctx: DetectorContext): RefactoringSuggestion[] {
  const out: RefactoringSuggestion[] = [];
  for (const fn of ctx.file.functions) {
    const looksPure = !/(Math\.random|new Date|localStorage|fetch|console|document\.)/.test(
      fn.preview
    );
    const expensive = /\.(map|filter|reduce|find|sort|forEach)\b/.test(fn.preview);
    if (!looksPure || !expensive) continue;
    if (fn.loc < 8) continue;
    out.push({
      id: nextId('memoize', ctx.file.path, fn.startLine),
      kind: 'memoize',
      title: `Memoize \`${fn.name}\` for hot-path performance`,
      description: `Pure function with repeated collection operations — ideal candidate for memoization.`,
      rationale:
        'Memoizing deterministic functions eliminates redundant computation in React render loops. Average 2-5× savings for hot paths.',
      file: ctx.file.path,
      startLine: fn.startLine,
      endLine: fn.endLine,
      preview: previewBlock(ctx.file, fn),
      severity: 'info',
      linesSaved: Math.max(0, Math.round(fn.loc * 0.1)),
      complexityDelta: 0,
      maintainabilityDelta: 2,
      effortMinutes: 8,
      coupling: fn.identifierFanOut,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: false,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.6,
      safety: 0,
      priority: 0,
      predictedLabels: ['memoize'],
    });
  }
  return out;
}

function detectInlineTrivial(ctx: DetectorContext): RefactoringSuggestion[] {
  const out: RefactoringSuggestion[] = [];
  for (const fn of ctx.file.functions) {
    if (fn.loc > 6) continue;
    if (fn.loc === 0) continue;
    out.push({
      id: nextId('inline-trivial', ctx.file.path, fn.startLine),
      kind: 'inline-trivial',
      title: `Inline \`${fn.name}\``,
      description: `\`${fn.name}\` is only ${fn.loc} LOC — inlining simplifies call sites.`,
      rationale:
        'Trivial wrappers inflate call graphs without adding clarity. Inlining aids comprehension when the function adds no abstraction.',
      file: ctx.file.path,
      startLine: fn.startLine,
      endLine: fn.endLine,
      preview: previewBlock(ctx.file, fn),
      severity: 'info',
      linesSaved: Math.max(0, fn.loc + 3),
      complexityDelta: 0,
      maintainabilityDelta: 1,
      effortMinutes: 3,
      coupling: 0,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: false,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.5,
      safety: 0,
      priority: 0,
      predictedLabels: ['inline-trivial'],
    });
  }
  return out;
}

function detectConsolidateDuplicates(ctx: DetectorContext): RefactoringSuggestion[] {
  if (ctx.file.duplicateLiteralScore === 0) return [];
  return [
    {
      id: nextId('consolidate-duplicates', ctx.file.path, 1),
      kind: 'consolidate-duplicates',
      title: `Extract repeated string literals into constants`,
      description: `${ctx.file.duplicateLiteralScore} duplicated literal(s) detected.`,
      rationale:
        'Repeated literals invite copy-paste drift. Promote them to module-level constants for a single source of truth.',
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.file.loc,
      preview: previewLines(ctx.file, 1, ctx.file.loc),
      severity: ctx.file.duplicateLiteralScore > 3 ? 'warning' : 'info',
      linesSaved: 0,
      complexityDelta: 0,
      maintainabilityDelta: 4,
      effortMinutes: 10,
      coupling: ctx.coupling,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: false,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.7,
      safety: 0,
      priority: 0,
      predictedLabels: ['consolidate-duplicates'],
    },
  ];
}

function detectReduceParameters(ctx: DetectorContext): RefactoringSuggestion[] {
  const out: RefactoringSuggestion[] = [];
  for (const fn of ctx.file.functions) {
    if (fn.paramCount <= 4) continue;
    out.push({
      id: nextId('reduce-parameters', ctx.file.path, fn.startLine),
      kind: 'reduce-parameters',
      title: `Group parameters of \`${fn.name}\` into an options object`,
      description: `\`${fn.name}\` takes ${fn.paramCount} parameters. Consider an options bag.`,
      rationale:
        'More than 4 positional parameters encourage mistakes and hinder named-argument reasoning. Options objects are easier to extend.',
      file: ctx.file.path,
      startLine: fn.startLine,
      endLine: fn.endLine,
      preview: previewBlock(ctx.file, fn),
      severity: fn.paramCount > 6 ? 'warning' : 'info',
      linesSaved: 0,
      complexityDelta: 0,
      maintainabilityDelta: Math.min(6, fn.paramCount),
      effortMinutes: 15,
      coupling: fn.identifierFanOut,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: false,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.7,
      safety: 0,
      priority: 0,
      predictedLabels: ['reduce-parameters'],
    });
  }
  return out;
}

function detectModernizeSyntax(ctx: DetectorContext): RefactoringSuggestion[] {
  const source = ctx.source;
  if (!source) return [];
  const issues: string[] = [];
  // Count `var ` declared tokens (word-boundary aware). Conservative so we
  // only surface this when there is real evidence in the file.
  const varMatches = source.match(/\bvar\s+[A-Za-z_$]/g);
  if (varMatches && varMatches.length > 0) issues.push('use of `var` instead of `let`/`const`');
  const concatMatches = source.match(/['"][^'"]*['"]\s*\+\s*[A-Za-z_$]/g);
  if (concatMatches && concatMatches.length >= 3) issues.push('redundant string concatenations');
  if (issues.length === 0) return [];
  return [
    {
      id: nextId('modernize-syntax', ctx.file.path, 1),
      kind: 'modernize-syntax',
      title: 'Modernize legacy syntax',
      description: issues.join('; '),
      rationale: 'Modern constructs (const/let, template literals) make scopes explicit and prevent hoisting bugs.',
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.file.loc,
      preview: previewLines(ctx.file, 1, ctx.file.loc),
      severity: 'info',
      linesSaved: 0,
      complexityDelta: 0,
      maintainabilityDelta: 2,
      effortMinutes: 10,
      coupling: ctx.coupling,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: false,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.55,
      safety: 0,
      priority: 0,
      predictedLabels: ['modernize-syntax'],
    },
  ];
}

function detectAddTypeAnnotation(ctx: DetectorContext): RefactoringSuggestion[] {
  if (ctx.file.typeAnnotationRatio >= 0.05) return [];
  return [
    {
      id: nextId('add-type-annotation', ctx.file.path, 1),
      kind: 'add-type-annotation',
      title: 'Add explicit type annotations',
      description: `Low type-annotation density (${(ctx.file.typeAnnotationRatio * 100).toFixed(1)}% of lines).`,
      rationale:
        'Annotations are the contract between modules. They make refactoring safe and prevent regressions in IDE-driven rename operations.',
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.file.loc,
      preview: previewLines(ctx.file, 1, ctx.file.loc),
      severity: 'info',
      linesSaved: 0,
      complexityDelta: 0,
      maintainabilityDelta: 3,
      effortMinutes: 20,
      coupling: ctx.coupling,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: false,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.55,
      safety: 0,
      priority: 0,
      predictedLabels: ['add-type-annotation'],
    },
  ];
}

function detectFlattenNesting(ctx: DetectorContext): RefactoringSuggestion[] {
  const out: RefactoringSuggestion[] = [];
  for (const fn of ctx.file.functions) {
    if (fn.maxNestingDepth <= 3) continue;
    out.push({
      id: nextId('flatten-nesting', ctx.file.path, fn.startLine),
      kind: 'flatten-nesting',
      title: `Flatten nesting in \`${fn.name}\``,
      description: `Maximum nesting depth is ${fn.maxNestingDepth} (target ≤ 3).`,
      rationale:
        'Deep nesting forces readers to track more context. Guard clauses / early-return reduce cognitive load and bug rates.',
      file: ctx.file.path,
      startLine: fn.startLine,
      endLine: fn.endLine,
      preview: previewBlock(ctx.file, fn),
      severity: fn.maxNestingDepth >= 5 ? 'warning' : 'info',
      linesSaved: Math.max(2, Math.round(fn.loc * 0.1)),
      complexityDelta: 1,
      maintainabilityDelta: 4,
      effortMinutes: 10 + fn.maxNestingDepth,
      coupling: fn.identifierFanOut,
      coveredByTests: ctx.coveredByTests,
      hasAnyType: ctx.file.anyUsage > 0,
      isPublicApi: ctx.isPublicApi,
      confidence: 0.8,
      safety: 0,
      priority: 0,
      predictedLabels: ['flatten-nesting', 'simplify-conditional'],
    });
  }
  return out;
}

// (Modernization heuristics now run directly on the raw source passed
// through DetectorContext — see detectModernizeSyntax above.)
