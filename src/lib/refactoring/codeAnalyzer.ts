/**
 * refactoring/codeAnalyzer.ts
 *
 * Pure-JS source analyzer that extracts code-quality metrics without
 * requiring TypeScript in the browser bundle. The implementation uses a
 * resilient tokenizer + structural pass that works across JS, JSX, TS and
 * TSX source.
 *
 * The analyzer intentionally favours speed and stability over absolute
 * precision. Where ambiguity is unavoidable it over-reports so that the
 * recommender surface area is conservative.
 */

import type {
  FileMetrics,
  FileTarget,
  FunctionBlock,
} from './types.js';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function analyzeFile(target: FileTarget): FileMetrics {
  const cleaned = stripComments(target.source);
  const lines = target.source.split(/\r?\n/);
  const cleanLines = cleaned.split(/\r?\n/);

  const functions = extractFunctions(cleaned, lines);
  const overallCyclomaticComplexity = functions.reduce(
    (sum, fn) => sum + fn.cyclomaticComplexity,
    0
  );

  const averageFunctionComplexity = functions.length
    ? overallCyclomaticComplexity / functions.length
    : 0;
  const averageParameters = functions.length
    ? functions.reduce((s, f) => s + f.paramCount, 0) / functions.length
    : 0;

  const longestFn = functions
    .slice()
    .sort((a, b) => b.loc - a.loc)[0] ?? null;

  const logicalLoc = cleanLines.filter(isLogicalLine).length;
  // nonCodeRatio: lines occupied by blanks or comments (proxy for non-executable noise).
  const nonCodeLines = lines.length - logicalLoc;
  const nonCodeRatio = lines.length === 0 ? 0 : nonCodeLines / lines.length;

  const longLines = lines.map((l) => l.length);
  const averageLineLength =
    longLines.length === 0
      ? 0
      : longLines.reduce((s, l) => s + l, 0) / longLines.length;
  const maxLineLength = longLines.reduce((m, l) => Math.max(m, l), 0);

  return {
    path: target.path,
    language: target.language,
    loc: lines.length,
    logicalLoc,
    nonCodeRatio: Number(nonCodeRatio.toFixed(3)),
    averageLineLength: Math.round(averageLineLength),
    maxLineLength,
    consoleUsage: countConsoleUsage(target.source),
    anyUsage: countAnyUsage(target.source),
    todoCount: countTodos(target.source),
    duplicateLiteralScore: countDuplicateLiterals(target.source),
    typeAnnotationRatio: countTypeAnnotationRatio(target.source, lines.length),
    functions,
    overallCyclomaticComplexity,
    averageFunctionComplexity: Number(averageFunctionComplexity.toFixed(2)),
    averageParameters: Number(averageParameters.toFixed(2)),
    longestFunction: longestFn
      ? { name: longestFn.name, loc: longestFn.loc, line: longestFn.startLine }
      : { name: '—', loc: 0, line: 0 },
  };
}

export function analyzeFiles(targets: FileTarget[]): FileMetrics[] {
  return targets.map(analyzeFile);
}

// ---------------------------------------------------------------------------
// Function extraction
// ---------------------------------------------------------------------------

const FUNCTION_KEYWORDS = ['function', 'async function'];
const ARROW_FN = (s: string): boolean => /=>\s*[{(]/.test(s) || /=>\s*[A-Za-z_$]/.test(s);

function extractFunctions(cleaned: string, lines: string[]): FunctionBlock[] {
  const blocks: FunctionBlock[] = [];
  const stack: { name: string; startLine: number; braceDepth: number; parenDepth: number; bracketDepth: number; paramCount: number; identifierFanOut: number; identifiers: Set<string> }[] = [];
  const identifierRefs = new Set<string>();

  // Token-aware scan.
  const tokens = tokenize(cleaned);
  let lineNo = 1;
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let parenStartLine = 0;
  let parenEndLine = 0;
  let pendingFnName: string | null = null;
  let pendingFnStart: number | null = null;
  let pendingFnParamCount = 0;
  let pendingFnIdentifiers: Set<string> | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === '\n') {
      lineNo += 1;
      continue;
    }

    // Function declarations + exports.
    if (
      tok === 'function' ||
      tok === 'async' ||
      tok === 'export'
    ) {
      const next = tokens[i + 1];
      const looksLikeNamed = next && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(next);
      if (tok !== 'async' && looksLikeNamed) {
        pendingFnName = next;
        pendingFnStart = lineNo;
        pendingFnParamCount = 0;
        pendingFnIdentifiers = new Set<string>();
        i += 1; // skip identifier
      }
      continue;
    }

    // Arrow & function expressions bound to identifiers.
    if (
      tok === '(' &&
      stack.length === 0 &&
      pendingFnName === null
    ) {
      parenStartLine = lineNo;
    }

    if (tok === '(') {
      parenDepth += 1;
      if (pendingFnName && pendingFnStart === lineNo) {
        pendingFnParamCount = countTopLevelCommas(sliceBetween(tokens, i, ')'));
      }
      continue;
    }

    if (tok === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      parenEndLine = lineNo;
      // If we just closed a parameter list and the next token denotes a body, push.
      if (
        pendingFnName &&
        pendingFnStart !== null &&
        pendingFnName !== null &&
        braceDepth === stack.length &&
        parenDepth === 0
      ) {
        const peek = tokens[i + 1];
        if (peek === '{') {
          stack.push({
            name: pendingFnName,
            startLine: pendingFnStart,
            braceDepth: 0,
            parenDepth: 0,
            bracketDepth: 0,
            paramCount: pendingFnParamCount,
            identifierFanOut: pendingFnIdentifiers ? pendingFnIdentifiers.size : 0,
            identifiers: pendingFnIdentifiers ?? new Set(),
          });
          pendingFnName = null;
          pendingFnStart = null;
          pendingFnParamCount = 0;
          pendingFnIdentifiers = null;
        } else if (peek && ARROW_FN(peek)) {
          // Arrow assigned; treat as inline function. Skip detection.
          pendingFnName = null;
          pendingFnStart = null;
          pendingFnParamCount = 0;
          pendingFnIdentifiers = null;
        }
      }
      continue;
    }

    if (tok === '{') {
      braceDepth += 1;
      continue;
    }
    if (tok === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      if (stack.length && braceDepth === stack.length - 1) {
        const fnBlock = stack.pop()!;
        blocks.push(finalizeFunction(fnBlock, lineNo, cleaned));
      }
      continue;
    }
    if (tok === '[') {
      bracketDepth += 1;
      continue;
    }
    if (tok === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    // Identifiers: add to current function fan-out
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(tok) && stack.length > 0) {
      const top = stack[stack.length - 1];
      top.identifiers.add(tok);
      identifierRefs.add(tok);
    }
  }

  // Finish any open block (assuming file ended cleanly)
  if (stack.length) {
    while (stack.length) {
      const fnBlock = stack.pop()!;
      blocks.push(finalizeFunction(fnBlock, lineNo, cleaned));
    }
  }

  // Filter to entries that look like real functions (require braces to have been opened)
  return blocks
    .filter((b) => b.loc > 0)
    .map((b) => ({
      ...b,
      identifierFanOut: b.identifierFanOut ?? b.preview.split(/[^A-Za-z0-9_$]+/).filter(Boolean).length,
      // Keep the preview within ~600 chars centered on the body
      preview: trimPreview(b.preview),
    }));
}

function finalizeFunction(
  block: {
    name: string;
    startLine: number;
    braceDepth: number;
    parenDepth: number;
    bracketDepth: number;
    paramCount: number;
    identifierFanOut: number;
    identifiers: Set<string>;
  },
  endLine: number,
  cleaned: string
): FunctionBlock {
  const cleanedLines = cleaned.split(/\r?\n/);
  const slice = cleanedLines.slice(block.startLine - 1, endLine).join('\n');
  const complexity = computeCyclomatic(slice);
  const maxNesting = computeMaxNesting(slice);
  const loc = slice.split(/\n/).filter(isLogicalLine).length;

  return {
    name: block.name,
    startLine: block.startLine,
    endLine,
    loc,
    cyclomaticComplexity: complexity,
    maxNestingDepth: maxNesting,
    paramCount: block.paramCount,
    identifierFanOut: block.identifiers.size,
    preview: slice,
  };
}

// ---------------------------------------------------------------------------
// Metrics helpers
// ---------------------------------------------------------------------------

function stripComments(src: string): string {
  // Remove block comments (non-greedy, multiline)
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  // Remove line comments (preserve newlines for line counts)
  out = out.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
  // Remove JS string literals (single quote)
  out = out.replace(/'([^'\\\n]|\\.)*'/g, (m) => m.replace(/[^\n]/g, ' '));
  // Remove JS string literals (double quote)
  out = out.replace(/"([^"\\\n]|\\.)*"/g, (m) => m.replace(/[^\n]/g, ' '));
  // Remove template literals
  out = out.replace(/`([^`\\]|\\.)*`/g, (m) => m.replace(/[^\n]/g, ' '));
  return out;
}

function isLogicalLine(line: string): boolean {
  return line.trim().length > 0;
}

function countConsoleUsage(src: string): number {
  const matches = src.match(/\bconsole\.(log|debug|info|warn|error)\b/g);
  return matches ? matches.length : 0;
}

function countAnyUsage(src: string): number {
  const matches = src.match(/:\s*any\b/g);
  return matches ? matches.length : 0;
}

function countTodos(src: string): number {
  const matches = src.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi);
  return matches ? matches.length : 0;
}

function countDuplicateLiterals(src: string): number {
  const literals = src.match(/"([A-Za-z0-9_\-\.]{4,})"/g) ?? [];
  const seen: Record<string, number> = {};
  for (const lit of literals) {
    seen[lit] = (seen[lit] ?? 0) + 1;
  }
  return Object.values(seen).filter((c) => c > 1).length;
}

function countTypeAnnotationRatio(src: string, totalLines: number): number {
  if (totalLines === 0) return 0;
  const annotations = src.match(/:\s*[A-Za-z_$][A-Za-z0-9_$<>\[\]\|\s,&]*\s*[=,;)\]]/g) ?? [];
  return Number((annotations.length / totalLines).toFixed(3));
}

function computeCyclomatic(fnSlice: string): number {
  // Base complexity for a function is 1.
  let complexity = 1;
  const keywordMatches = fnSlice.match(/\b(if|else if|for|while|case|catch|\?)\b/g);
  if (keywordMatches) {
    // `else if` is counted as a single branching point, so we deduct to keep
    // the McCabe analogy accurate. Each `?` ternary is a 1-branch decision.
    const elseIfCount = (fnSlice.match(/\belse\s+if\b/g) ?? []).length;
    complexity += keywordMatches.length - elseIfCount;
  }
  // Logical operators split flow similarly.
  const ops = fnSlice.match(/(\&\&|\|\|)/g);
  if (ops) complexity += ops.length;
  return complexity;
}

function computeMaxNesting(fnSlice: string): number {
  let depth = 0;
  let max = 0;
  for (const ch of fnSlice) {
    if (ch === '{') {
      depth += 1;
      max = Math.max(max, depth);
    } else if (ch === '}') {
      depth -= 1;
    }
  }
  return max;
}

function countTopLevelCommas(paramsSlice: string): number {
  let depth = 0;
  let count = 0;
  for (const ch of paramsSlice) {
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) break;
    } else if (ch === ',' && depth === 0) {
      count += 1;
    }
  }
  return count + 1; // n args = commas + 1
}

function trimPreview(preview: string): string {
  if (preview.length <= 600) return preview;
  return preview.slice(0, 280) + '\n…\n' + preview.slice(-280);
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/**
 * Lightweight tokenizer that returns meaningful syntactic tokens we use
 * to track brace/paren depth, identifier names, and line numbers.
 */
function tokenize(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') {
      out.push('\n');
      i += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '}' || ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === ',') {
      out.push(ch);
      i += 1;
      continue;
    }
    if (ch === '/') {
      // Skip line / block comments because we already stripped them
      if (src[i + 1] === '/' || src[i + 1] === '*') {
        while (i < src.length && src[i] !== '\n') i += 1;
        continue;
      }
    }
    // Multi-char operators
    if (src.startsWith('=>', i) || src.startsWith('===', i) || src.startsWith('!==', i) || src.startsWith('&&', i) || src.startsWith('||', i)) {
      out.push(src.slice(i, i + 2));
      i += 2;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j += 1;
      out.push(src.slice(i, j));
      i = j;
      continue;
    }
    // All other punctuation falls through
    out.push(ch);
    i += 1;
  }
  return out;
}

function sliceBetween(tokens: string[], openIdx: number, close: string): string {
  let depth = 0;
  const slice: string[] = [];
  for (let k = openIdx; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok === '(') depth += 1;
    if (tok === ')') {
      depth -= 1;
      if (depth === 0) return slice.join('');
      if (close !== ')') continue;
    }
    slice.push(tok);
  }
  return slice.join('');
}
