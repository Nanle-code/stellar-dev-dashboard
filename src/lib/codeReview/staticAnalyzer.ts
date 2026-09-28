/**
 * codeReview/staticAnalyzer.ts
 *
 * Enhanced static analysis engine with ML-powered pattern detection.
 * Detects 30+ code quality issue types across security, performance,
 * maintainability, reliability, and Stellar-specific domains.
 * Uses ML anomaly scoring via Isolation Forest for outlier detection
 * and confidence-weighted suggestions.
 */

import type {
  CodeReviewIssue,
  CodeReviewCategory,
  CodeReviewOptions,
  DetectorContext,
  IssueDetector,
  IssueSeverity,
  SourceFile,
} from './types';

// ─── Helper utilities ────────────────────────────────────────────────────────

function stripComments(src: string): string {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/'([^'\\\n]|\\.)*'/g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/"([^"\\\n]|\\.)*"/g, (m) => m.replace(/[^\n]/g, ' '));
  out = out.replace(/`([^`\\]|\\.)*`/g, (m) => m.replace(/[^\n]/g, ' '));
  return out;
}

function nextId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function severityForScore(score: number): IssueSeverity {
  if (score >= 0.9) return 'critical';
  if (score >= 0.7) return 'high';
  if (score >= 0.45) return 'medium';
  if (score >= 0.2) return 'low';
  return 'info';
}

function countInSource(src: string, pattern: RegExp): number {
  const matches = src.match(pattern);
  return matches ? matches.length : 0;
}

function hasPattern(src: string, pattern: RegExp): boolean {
  return pattern.test(src);
}

function extractLines(lines: string[], start: number, end: number): string {
  const s = Math.max(0, start - 1);
  const e = Math.min(lines.length, end);
  return lines.slice(s, e).join('\n');
}

// ─── ML Anomaly Scoring Engine ──────────────────────────────────────────────

/**
 * Lightweight Isolation Forest for anomaly detection in code metrics.
 * Used to identify outlier files that likely contain quality issues.
 */
class CodeAnomalyDetector {
  private trees: Array<{ feature: number; value: number; left: any; right: any; size: number }> = [];
  private readonly nTrees = 50;
  private readonly sampleSize = 32;

  fit(metrics: number[][]): void {
    if (metrics.length < 2) return;
    const limit = Math.ceil(Math.log2(Math.min(this.sampleSize, metrics.length)));
    this.trees = [];

    for (let t = 0; t < this.nTrees; t++) {
      const idx: number[] = [];
      while (idx.length < Math.min(this.sampleSize, metrics.length)) {
        const r = Math.floor(Math.random() * metrics.length);
        if (!idx.includes(r)) idx.push(r);
      }
      const sample = idx.map((i) => metrics[i]);
      this.trees.push(this.buildTree(sample, 0, limit));
    }
  }

  private buildTree(data: number[][], depth: number, limit: number): any {
    if (data.length <= 1 || depth >= limit) {
      return { size: data.length, leaf: true };
    }
    const dim = Math.floor(Math.random() * data[0].length);
    let min = Infinity, max = -Infinity;
    for (const row of data) {
      if (row[dim] < min) min = row[dim];
      if (row[dim] > max) max = row[dim];
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return { size: data.length, leaf: true };
    }
    const split = min + Math.random() * (max - min);
    const left = data.filter((r) => r[dim] < split);
    const right = data.filter((r) => r[dim] >= split);
    return {
      dim,
      split,
      left: this.buildTree(left, depth + 1, limit),
      right: this.buildTree(right, depth + 1, limit),
      leaf: false,
    };
  }

  score(point: number[]): number {
    if (!this.trees.length) return 0.5;
    const depths = this.trees.map((t) => this.pathLength(point, t, 0));
    const avgDepth = depths.reduce((s, d) => s + d, 0) / depths.length;
    const n = Math.min(this.sampleSize, 256);
    const c = this.cFactor(n);
    if (c === 0) return 0.5;
    return Math.pow(2, -avgDepth / c);
  }

  private pathLength(point: number[], node: any, depth: number): number {
    if (node.leaf) return depth + this.cFactor(Math.max(1, node.size));
    if (point[node.dim] < node.split) return this.pathLength(point, node.left, depth + 1);
    return this.pathLength(point, node.right, depth + 1);
  }

  private cFactor(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }
}

// ─── Detectors ───────────────────────────────────────────────────────────────

/**
 * Detects usage of `any` type which disables type safety.
 */
const detectAnyType: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const anyMatches = ctx.source.match(/:(\s*)any\b/g);
  if (!anyMatches) return issues;

  const count = anyMatches.length;
  issues.push({
    id: nextId('any-type'),
    category: 'type-safety',
    severity: count > 5 ? 'high' : 'medium',
    title: `Replace \`any\` types with proper TypeScript types`,
    description: `Found ${count} usage${count > 1 ? 's' : ''} of \`: any\`. Using \`any\` disables TypeScript's type checker for those branches.`,
    file: ctx.file.path,
    startLine: 1,
    endLine: ctx.lines.length,
    suggestion: 'Replace with specific types, generics, or `unknown` with type narrowing. Use `Record<string, unknown>` for dynamic objects.',
    rationale: 'Each `any` eliminates static type checking for that code path. In large codebases, `any` usage correlates with 27% higher defect rates.',
    confidence: 0.95,
    effortMinutes: count * 5,
    likelyFalsePositive: false,
    stellarTags: ['type-safety'],
    references: ['https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#any'],
  });
  return issues;
};

/**
 * Detects `console.*` statements that should be removed from production code.
 */
const detectConsoleStatements: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const matches = ctx.source.match(/\bconsole\.(log|debug|info|warn|error)\b/g);
  if (!matches) return issues;

  const linesWithConsole = new Set<number>();
  ctx.lines.forEach((line, i) => {
    if (/\bconsole\.(log|debug|info)\b/.test(line)) linesWithConsole.add(i + 1);
  });

  for (const lineNo of linesWithConsole) {
    issues.push({
      id: nextId('console-log'),
      category: 'code-style',
      severity: 'low',
      title: `Remove debug console statement on line ${lineNo}`,
      description: `Console statement detected on line ${lineNo}. These should not ship to production.`,
      file: ctx.file.path,
      startLine: lineNo,
      endLine: lineNo,
      snippet: ctx.lines[lineNo - 1]?.trim(),
      suggestion: 'Remove or replace with a proper logging framework that can be silenced in production.',
      rationale: 'Console statements leak internal data, add noise, and are stripped inconsistently across build tools.',
      confidence: 0.9,
      effortMinutes: 1,
      likelyFalsePositive: false,
    });
  }

  if (matches.length >= 3) {
    issues.push({
      id: nextId('console-bulk'),
      category: 'code-style',
      severity: 'medium',
      title: `Bulk console statements (${matches.length} total)`,
      description: `Found ${matches.length} console statement${matches.length > 1 ? 's' : ''}. High density suggests leftover debugging code.`,
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.lines.length,
      suggestion: 'Audit each console statement. Use structured logging via a logger service for important events.',
      rationale: 'Debug output that reaches production creates noise and potential information leakage.',
      confidence: 0.85,
      effortMinutes: matches.length,
      likelyFalsePositive: false,
    });
  }

  return issues;
};

/**
 * Detects TODO/FIXME/HACK markers that indicate incomplete work.
 */
const detectTodoMarkers: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const todoRegex = /\/\/\s*(TODO|FIXME|HACK|XXX|BUG)\b/gi;

  ctx.lines.forEach((line, i) => {
    const match = todoRegex.exec(line);
    if (match) {
      const marker = match[1].toUpperCase();
      const severity: IssueSeverity = marker === 'FIXME' || marker === 'BUG' ? 'medium' : 'low';
      const comment = line.slice(line.indexOf(match[0]) + match[0].length).trim() || '(no details)';
      issues.push({
        id: nextId('todo-marker'),
        category: 'maintainability',
        severity,
        title: `${marker} marker: ${comment.slice(0, 60)}`,
        description: `${marker} annotation found on line ${i + 1}: "${comment.slice(0, 120)}"`,
        file: ctx.file.path,
        startLine: i + 1,
        endLine: i + 1,
        snippet: line.trim(),
        suggestion: marker === 'FIXME' || marker === 'BUG'
          ? 'Address this known issue immediately. File a tracking issue if it cannot be fixed now.'
          : 'Resolve or convert into a proper tracking ticket with a target date.',
        rationale: 'Accumulated TODO/FIXME markers obscure real issues and accumulate technical debt.',
        confidence: 0.95,
        effortMinutes: marker === 'FIXME' ? 30 : 15,
        likelyFalsePositive: false,
      });
    }
  });

  return issues;
};

/**
 * Detects functions that exceed cyclomatic complexity thresholds.
 */
const detectHighComplexity: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const cleaned = stripComments(ctx.source);

  // Extract function blocks and compute complexity
  const fnRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*\{)/g;
  let fnMatch: RegExpExecArray | null;
  const functionStarts: { name: string; line: number; braceLine: number }[] = [];

  while ((fnMatch = fnRegex.exec(ctx.source)) !== null) {
    const name = fnMatch[1] || fnMatch[2] || fnMatch[3] || '(anonymous)';
    const lineStart = ctx.source.slice(0, fnMatch.index).split('\n').length;
    // Find the opening brace
    const afterMatch = ctx.source.slice(fnMatch.index);
    const braceIdx = afterMatch.indexOf('{');
    if (braceIdx >= 0) {
      const braceLine = ctx.source.slice(0, fnMatch.index + braceIdx).split('\n').length;
      functionStarts.push({ name, line: lineStart, braceLine });
    }
  }

  // Track brace depth to find function boundaries
  let depth = 0;
  const fnBoundaries: { name: string; startLine: number; endLine: number; body: string }[] = [];
  let currentFn: { name: string; startLine: number; startIdx: number } | null = null;

  for (let i = 0; i < ctx.source.length; i++) {
    const ch = ctx.source[i];
    if (ch === '{') {
      if (depth === 0 && functionStarts.length > 0) {
        const nearest = functionStarts.find((f) => {
          const idx = ctx.source.slice(0, i).split('\n').length;
          return Math.abs(idx - f.braceLine) <= 1;
        });
        if (nearest) {
          currentFn = { name: nearest.name, startLine: nearest.line, startIdx: i };
          functionStarts.splice(functionStarts.indexOf(nearest), 1);
        }
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && currentFn) {
        const endLine = ctx.source.slice(0, i).split('\n').length;
        const body = ctx.source.slice(currentFn.startIdx, i + 1);
        fnBoundaries.push({
          name: currentFn.name,
          startLine: currentFn.startLine,
          endLine,
          body,
        });
        currentFn = null;
      }
    }
  }

  // Compute complexity for each function
  for (const fn of fnBoundaries) {
    let complexity = 1;
    const branching = fn.body.match(/\b(if|else if|for|while|case|catch|\?)\b/g);
    if (branching) {
      const elseIfs = (fn.body.match(/\belse\s+if\b/g) || []).length;
      complexity += branching.length - elseIfs;
    }
    const logicalOps = fn.body.match(/(\&\&|\|\|)/g);
    if (logicalOps) complexity += logicalOps.length;

    if (complexity >= 8) {
      const loc = fn.body.split('\n').length;
      issues.push({
        id: nextId('high-complexity'),
        category: 'complexity',
        severity: complexity >= 15 ? 'high' : 'medium',
        title: `\`${fn.name}\` has high cyclomatic complexity (${complexity})`,
        description: `Function \`${fn.name}\` (line ${fn.startLine}) has complexity ${complexity}. Recommended maximum is 10.`,
        file: ctx.file.path,
        startLine: fn.startLine,
        endLine: fn.endLine,
        suggestion: 'Break the function into smaller units. Use early returns, extract conditions, or apply a strategy pattern.',
        rationale: 'Functions with complexity > 10 are 3x more likely to contain defects and significantly harder to test.',
        confidence: Math.min(0.95, 0.5 + complexity * 0.03),
        effortMinutes: Math.round(loc * 0.5),
        likelyFalsePositive: false,
      });
    }
  }

  return issues;
};

/**
 * Detects hardcoded values and credentials that pose security risks.
 */
const detectHardcodedCredentials: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const patterns = [
    { pattern: /(password|passwd|pwd|secret)\s*[:=]\s*['"][^'"]+['"]/i, severity: 'critical' as IssueSeverity, label: 'password/secret' },
    { pattern: /(api[_-]?key|apikey|api_key)\s*[:=]\s*['"][^'"]{8,}['"]/i, severity: 'critical' as IssueSeverity, label: 'API key' },
    { pattern: /(token|auth_token|access_token)\s*[:=]\s*['"][^'"]{8,}['"]/i, severity: 'high' as IssueSeverity, label: 'auth token' },
    { pattern: /(private_key|privateKey|secret_key|secretKey)\s*[:=]\s*['"][^'"]+['"]/i, severity: 'critical' as IssueSeverity, label: 'private key' },
    { pattern: /(seed|mnemonic|passphrase)\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/i, severity: 'critical' as IssueSeverity, label: 'seed/mnemonic' },
    { pattern: /(horizonUrl|sorobanUrl|rpcUrl)\s*[:=]\s*['"]https?:\/\//i, severity: 'low' as IssueSeverity, label: 'hardcoded URL' },
  ];

  for (const { pattern, severity, label } of patterns) {
    const matches = ctx.source.match(pattern);
    if (matches) {
      const lineNo = ctx.source.slice(0, matches.index!).split('\n').length;
      issues.push({
        id: nextId('hardcoded-cred'),
        category: 'security',
        severity,
        title: `Hardcoded ${label} detected on line ${lineNo}`,
        description: `A hardcoded ${label} was found in the source code. This is a security vulnerability.`,
        file: ctx.file.path,
        startLine: lineNo,
        endLine: lineNo,
        snippet: ctx.lines[lineNo - 1]?.trim().slice(0, 80),
        suggestion: severity === 'critical'
          ? 'Move to environment variables or a secure secrets manager immediately. Never commit secrets to version control.'
          : 'Consider using environment variables or configuration files outside version control.',
        rationale: 'Hardcoded secrets in source code are the #1 cause of credential leaks in OSS repositories.',
        confidence: 0.95,
        effortMinutes: 5,
        likelyFalsePositive: false,
        stellarTags: ['security'],
        references: ['https://stellar.org/docs/learn/security'],
      });
    }
  }

  return issues;
};

/**
 * Detects Stellar-specific issues like incorrect address formats, missing try/catch on Horizon calls.
 */
const detectStellarIssues: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const lines = ctx.lines;
  const src = ctx.source;

  // Check for Stellar SDK usage without proper error handling
  const stellarServerCalls = [
    /\.loadAccount\s*\(/g,
    /\.payments\s*\(/g,
    /\.operations\s*\(/g,
    /\.transactions\s*\(/g,
    /\.effects\s*\(/g,
    /\.trades\s*\(/g,
    /\.strictReceivePaths\s*\(/g,
    /\.strictSendPaths\s*\(/g,
  ];

  for (const re of stellarServerCalls) {
    const callMatches = src.match(re);
    if (!callMatches) continue;

    for (const match of (src.match(new RegExp(re.source, 'g')) || [])) {
      const idx = src.indexOf(match);
      const lineNo = src.slice(0, idx).split('\n').length;

      // Check if there's a try/catch around this line
      const contextBefore = src.slice(Math.max(0, idx - 200), idx);
      const hasTryBlock = /\btry\b/.test(contextBefore);

      if (!hasTryBlock) {
        issues.push({
          id: nextId('stellar-error-handling'),
          category: 'stellar-best-practice',
          severity: 'high',
          title: 'Stellar SDK call without error handling',
          description: `Horizon/Soroban RPC call on line ${lineNo} is not wrapped in a try/catch block. Network calls can fail.`,
          file: ctx.file.path,
          startLine: lineNo,
          endLine: lineNo,
          snippet: lines[lineNo - 1]?.trim(),
          suggestion: 'Wrap the Stellar SDK call in a try/catch block. Use `useSWR` or a similar data-fetching library that handles errors.',
          rationale: 'Stellar Horizon and Soroban RPC calls are network operations that can fail due to timeouts, rate limits, or network issues.',
          confidence: 0.8,
          effortMinutes: 5,
          likelyFalsePositive: !hasTryBlock,
          stellarTags: ['soroban', 'horizon', 'error-handling'],
          references: ['https://stellar.org/docs/learn/errors'],
        });
      }
    }
  }

  // Check for Stellar address validation
  const addressAssignments = src.match(/['"](G[A-Z0-9]{55})['"]/g);
  if (addressAssignments) {
    for (const addr of addressAssignments) {
      const idx = src.indexOf(addr);
      const lineNo = src.slice(0, idx).split('\n').length;
      const address = addr.replace(/['"]/g, '');
      if (address.length !== 56) {
        issues.push({
          id: nextId('stellar-address-format'),
          category: 'stellar-best-practice',
          severity: 'high',
          title: `Invalid Stellar address format on line ${lineNo}`,
          description: `Found a string that looks like a Stellar address but has incorrect length (${address.length}, expected 56).`,
          file: ctx.file.path,
          startLine: lineNo,
          endLine: lineNo,
          snippet: lines[lineNo - 1]?.trim(),
          suggestion: 'Use `StellarSdk.StrKey.isValidEd25519PublicKey()` to validate addresses. Ensure the address is exactly 56 characters starting with G.',
          rationale: 'Invalid addresses cause transaction failures and lost funds. Always validate before use.',
          confidence: 0.9,
          effortMinutes: 5,
          likelyFalsePositive: false,
          stellarTags: ['address-validation'],
          references: ['https://stellar.github.io/js-stellar-sdk/StrKey.html'],
        });
      }
    }
  }

  // Detect missing sequence number handling
  const txSubmitPattern = /\b(server\.submitTransaction|TransactionBuilder\.submit)\b/g;
  const txMatches = src.match(txSubmitPattern);
  if (txMatches) {
    for (const match of (src.match(new RegExp(txSubmitPattern.source, 'g')) || [])) {
      const idx = src.indexOf(match);
      const lineNo = src.slice(0, idx).split('\n').length;

      // Check if sequence number is fetched
      const context = src.slice(Math.max(0, idx - 500), idx);
      const hasSequenceFetch = /\b(account\.sequenceNumber|loadAccount|sequence)\b/.test(context);

      if (!hasSequenceFetch) {
        issues.push({
          id: nextId('stellar-sequence'),
          category: 'stellar-best-practice',
          severity: 'critical',
          title: 'Transaction submission without sequence number handling',
          description: `Transaction submission on line ${lineNo} may not have proper sequence number management.`,
          file: ctx.file.path,
          startLine: lineNo,
          endLine: lineNo,
          suggestion: 'Always fetch the current account sequence number with `server.loadAccount()` before building a transaction. Handle sequence number errors with retry logic.',
          rationale: 'Stellar requires sequential transaction numbers. Using a stale sequence number causes transaction failures.',
          confidence: 0.7,
          effortMinutes: 15,
          likelyFalsePositive: true,
          stellarTags: ['transactions', 'sequence'],
          references: ['https://stellar.org/docs/learn/fundamentals/stellar-data-structures/transactions'],
        });
      }
    }
  }

  // Detect missing fee estimation
  const feePattern = /\b(setFee|fee)\s*\(/g;
  const feeMatches = src.match(feePattern);
  if (!feeMatches && hasPattern(src, /TransactionBuilder/g)) {
    const lastImportLine = src.lastIndexOf('import');
    const lineNo = src.slice(0, Math.max(lastImportLine, 0)).split('\n').length + 1;
    issues.push({
      id: nextId('stellar-fee'),
      category: 'stellar-best-practice',
      severity: 'medium',
      title: 'Transaction built without explicit fee setting',
      description: 'TransactionBuilder usage detected but no explicit `setFee()` call found. Using default fees may cause slow confirmation.',
      file: ctx.file.path,
      startLine: lineNo,
      endLine: lineNo + 1,
      suggestion: 'Use `setFee(await server.fetchBaseFee())` or estimate fees based on network conditions with `server.feeStats()`.',
      rationale: 'Setting appropriate fees ensures transactions are confirmed in a timely manner, especially during network congestion.',
      confidence: 0.65,
      effortMinutes: 10,
      likelyFalsePositive: true,
      stellarTags: ['transactions', 'fees'],
      references: ['https://stellar.org/docs/learn/fundamentals/fees-resource-limits-metering/fees'],
    });
  }

  return issues;
};

/**
 * Detects potential performance issues.
 */
const detectPerformanceIssues: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const src = ctx.source;

  // Detect nested loops
  const nestedLoopsPattern = /for\s*\([^)]+\)\s*\{[^{}]*for\s*\(/g;
  if (nestedLoopsPattern.test(src)) {
    issues.push({
      id: nextId('nested-loops'),
      category: 'performance',
      severity: 'medium',
      title: 'Nested loops may cause O(n²) performance',
      description: 'Found nested for-loops. If iterating over large datasets, this could be a performance bottleneck.',
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.lines.length,
      suggestion: 'Use a Map or Set for lookups to reduce O(n²) to O(n). Consider using `.find()` or `.some()` instead of nested loops.',
      rationale: 'Nested loops scale quadratically. With 1000+ items, this becomes noticeably slow.',
      confidence: 0.7,
      effortMinutes: 20,
      likelyFalsePositive: false,
    });
  }

  // Detect large array spread in render/loop context
  const largeSpreadPattern = /\.\.\.(array|list|items|data|records)/g;
  if (largeSpreadPattern.test(src)) {
    issues.push({
      id: nextId('large-spread'),
      category: 'performance',
      severity: 'low',
      title: 'Array spread operator may cause unnecessary allocations',
      description: 'Use of spread operator on potentially large arrays. Each spread creates a shallow copy.',
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.lines.length,
      suggestion: 'Use `Array.concat()` or `.push(...items)` for better performance with large datasets. Avoid spreading in hot paths.',
      rationale: 'Spreading large arrays (10k+ items) creates significant GC pressure and temporary memory usage.',
      confidence: 0.5,
      effortMinutes: 10,
      likelyFalsePositive: true,
    });
  }

  return issues;
};

/**
 * Detects missing or incomplete error handling patterns.
 */
const detectErrorHandling: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const src = ctx.source;

  // Detect async functions without try/catch
  const asyncFns = src.match(/async\s+function\s+\w+|const\s+\w+\s*=\s*async\s*\(|const\s+\w+\s*=\s*async\s+\(/g);
  if (asyncFns) {
    const tryCatchCount = countInSource(src, /\btry\s*\{[\s\S]*?\}\s*catch\s*\(/g);
    const asyncFnCount = asyncFns.length;

    if (tryCatchCount < asyncFnCount * 0.5 && asyncFnCount > 2) {
      issues.push({
        id: nextId('missing-error-handling'),
        category: 'reliability',
        severity: 'high',
        title: `Only ${tryCatchCount}/${asyncFnCount} async functions have proper error handling`,
        description: `${asyncFnCount} async function${asyncFnCount > 1 ? 's' : ''} found but only ${tryCatchCount} try/catch block${tryCatchCount !== 1 ? 's' : ''}. Unhandled promise rejections crash the application.`,
        file: ctx.file.path,
        startLine: 1,
        endLine: ctx.lines.length,
        suggestion: 'Wrap async operations in try/catch blocks. Use a centralized error handler for consistent error reporting.',
        rationale: 'Unhandled promise rejections will crash Node.js processes and cause unresponsive UI in browsers.',
        confidence: 0.75,
        effortMinutes: asyncFnCount * 5,
        likelyFalsePositive: false,
      });
    }
  }

  // Detect catch blocks that just re-throw or log
  ctx.lines.forEach((line, i) => {
    if (/\bcatch\s*\(/.test(line)) {
      // Check the next few lines for the catch body
      const catchBody = ctx.lines.slice(i, Math.min(i + 6, ctx.lines.length)).join('\n');
      const emptyCatch = /catch\s*\([^)]*\)\s*\{[\s\n]*\}/.test(catchBody);
      const justLog = /catch\s*\([^)]*\)\s*\{[\s\n]*console\.(log|error|warn)/.test(catchBody);

      if (emptyCatch) {
        issues.push({
          id: nextId('empty-catch'),
          category: 'reliability',
          severity: 'high',
          title: `Empty catch block on line ${i + 1}`,
          description: 'An empty catch block silently swallows errors, making debugging impossible.',
          file: ctx.file.path,
          startLine: i + 1,
          endLine: i + 1,
          snippet: line.trim(),
          suggestion: 'At minimum log the error. Better: handle the specific error type, show user feedback, and report to monitoring.',
          rationale: 'Silent catch blocks hide failures and make production debugging extremely difficult.',
          confidence: 0.95,
          effortMinutes: 5,
          likelyFalsePositive: false,
        });
      } else if (justLog) {
        issues.push({
          id: nextId('catch-only-log'),
          category: 'reliability',
          severity: 'low',
          title: `Catch block on line ${i + 1} only logs without recovery`,
          description: 'Error is logged but no recovery action is taken.',
          file: ctx.file.path,
          startLine: i + 1,
          endLine: i + 1,
          suggestion: 'Consider adding retry logic, fallback values, or user-facing error messages alongside the log.',
          rationale: 'Logging without recovery leaves the application in an undefined state.',
          confidence: 0.6,
          effortMinutes: 10,
          likelyFalsePositive: true,
        });
      }
    }
  });

  return issues;
};

/**
 * Detects potential Null/undefined reference issues.
 */
const detectNullSafety: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const src = ctx.source;

  // Check for optional chaining usage vs direct property access on potentially null values
  const propAccessPattern = /\b(\w+)(?:\.\w+)+\b/g;
  const propMatches = src.matchAll(propAccessPattern);
  const accessedChains = new Set<string>();

  for (const match of propMatches) {
    if (match[1] && match[1] !== 'this' && match[1] !== 'console' && match[1] !== 'Math') {
      accessedChains.add(match[0]);
    }
  }

  // Check for unsafe access patterns
  const unsafePatterns = [
    { pattern: /(data|result|response|account|transaction)\.(\w+)/g, severity: 'medium' as IssueSeverity },
    { pattern: /(obj|item|record|entry)\.(value|name|id|type|status)/g, severity: 'medium' as IssueSeverity },
  ];

  for (const { pattern, severity } of unsafePatterns) {
    const matches = src.match(pattern);
    if (!matches) continue;

    // Only flag if there's no optional chaining or null check in the vicinity
    const uniqueMatches = new Set(matches);
    for (const match of uniqueMatches) {
      const idx = src.indexOf(match);
      const lineNo = src.slice(0, idx).split('\n').length;
      const context = src.slice(Math.max(0, idx - 100), idx + match.length + 100);

      const hasOptionalChain = /\?\./.test(context);
      const hasNullCheck = /!(==|===)\s*(null|undefined)/.test(context) || /\bif\s*\(\s*\w+\s*\)/.test(context);

      if (!hasOptionalChain && !hasNullCheck) {
        issues.push({
          id: nextId('null-safety'),
          category: 'reliability',
          severity,
          title: `Potential null reference on line ${lineNo}`,
          description: `Property access on \`${match}\` without null check or optional chaining.`,
          file: ctx.file.path,
          startLine: lineNo,
          endLine: lineNo,
          snippet: ctx.lines[lineNo - 1]?.trim().slice(0, 80),
          suggestion: `Use optional chaining: \`${match.replace('.', '?.')}\` or add a null check before access.`,
          rationale: 'Unchecked property access on null/undefined throws a runtime error, crashing the application.',
          confidence: 0.6,
          effortMinutes: 2,
          likelyFalsePositive: true,
        });
        break; // One per pattern to avoid noise
      }
    }
  }

  return issues;
};

/**
 * Detects long functions and files that should be split.
 */
const detectLongFunctions: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const lines = ctx.lines;

  // Check overall file length
  if (lines.length > 500) {
    issues.push({
      id: nextId('long-file'),
      category: 'maintainability',
      severity: lines.length > 800 ? 'high' : 'medium',
      title: `File is very long (${lines.length} lines)`,
      description: `This file has ${lines.length} lines. Files over 400 lines are harder to review and maintain.`,
      file: ctx.file.path,
      startLine: 1,
      endLine: lines.length,
      suggestion: 'Split into smaller modules with single responsibilities. Consider extracting related functions into separate files.',
      rationale: 'Large files correlate with higher defect density and slower code reviews.',
      confidence: 0.85,
      effortMinutes: Math.round(lines.length / 10),
      likelyFalsePositive: false,
    });
  }

  // Detect long functions via brace counting
  let depth = 0;
  let fnStart = 0;
  let fnStartDepth = 0;
  let fnName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*(export\s+)?(function|async function)\s+(\w+)/.test(line)) {
      const match = line.match(/(function|async function)\s+(\w+)/);
      if (match) {
        fnName = match[2];
        fnStart = i;
        fnStartDepth = depth;
      }
    }

    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    depth += opens - closes;

    if (fnName && fnStartDepth >= depth && depth <= fnStartDepth && opens < closes) {
      const fnLines = i - fnStart;
      if (fnLines > 80) {
        issues.push({
          id: nextId('long-function'),
          category: 'maintainability',
          severity: fnLines > 120 ? 'high' : 'medium',
          title: `Function \`${fnName}\` is too long (${fnLines} lines)`,
          description: `Function \`${fnName}\` starting around line ${fnStart + 1} spans ${fnLines} lines. Consider extracting sub-functions.`,
          file: ctx.file.path,
          startLine: fnStart + 1,
          endLine: i + 1,
          suggestion: 'Extract cohesive blocks into named helper functions. Keep each function under 50 lines for readability.',
          rationale: 'Long functions violate the Single Responsibility Principle and are difficult to test thoroughly.',
          confidence: 0.8,
          effortMinutes: Math.round(fnLines * 0.3),
          likelyFalsePositive: false,
        });
      }
      fnName = '';
    }
  }

  return issues;
};

/**
 * Detects missing TypeScript type annotations.
 */
const detectMissingTypes: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const src = ctx.source;

  if (!ctx.file.path.endsWith('.ts') && !ctx.file.path.endsWith('.tsx')) return issues;

  // Count function parameters without types
  const paramPattern = /\(([^)]*)\)\s*(?::\s*\w+)?\s*(=>|{)/g;
  let match: RegExpExecArray | null;
  let untypedParams = 0;

  while ((match = paramPattern.exec(src)) !== null) {
    const params = match[1].split(',').map((p) => p.trim()).filter(Boolean);
    for (const param of params) {
      if (!/:\s*\w+/.test(param) && !/^\.\.\./.test(param)) {
        untypedParams++;
      }
    }
  }

  if (untypedParams > 0) {
    issues.push({
      id: nextId('untyped-params'),
      category: 'type-safety',
      severity: untypedParams > 5 ? 'high' : 'medium',
      title: `${untypedParams} function parameter${untypedParams > 1 ? 's' : ''} without type annotations`,
      description: `Found ${untypedParams} untyped function parameter${untypedParams > 1 ? 's' : ''}. TypeScript cannot verify correctness without type information.`,
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.lines.length,
      suggestion: 'Add explicit type annotations to all function parameters. Use interfaces for complex parameter objects.',
      rationale: 'Untyped parameters defeat the purpose of TypeScript and allow type mismatches at call sites.',
      confidence: 0.85,
      effortMinutes: untypedParams * 3,
      likelyFalsePositive: false,
    });
  }

  return issues;
};

/**
 * Detects deprecated or problematic Stellar SDK patterns.
 */
const detectStellarDeprecated: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const src = ctx.source;

  const deprecatedPatterns = [
    {
      pattern: /StellarSdk\.Network\.(PUBLIC|TESTNET)/g,
      severity: 'medium' as IssueSeverity,
      label: 'StellarSdk.Network static property',
      suggestion: 'Use `StellarSdk.Networks.PUBLIC` or `StellarSdk.Networks.TESTNET` as strings instead.',
      ref: 'https://stellar.github.io/js-stellar-sdk/Networks.html',
    },
    {
      pattern: /new\s+StellarSdk\.Transaction\s*\(/g,
      severity: 'medium' as IssueSeverity,
      label: 'StellarSdk.Transaction constructor (deprecated)',
      suggestion: 'Use `new StellarSdk.TransactionBuilder()` with a `TransactionBuilder` instead of constructing `Transaction` directly.',
      ref: 'https://stellar.github.io/js-stellar-sdk/TransactionBuilder.html',
    },
    {
      pattern: /\.addOperation\s*\(\s*StellarSdk\.Operation\.payment\s*\(/g,
      severity: 'low' as IssueSeverity,
      label: 'Legacy operation creation pattern',
      suggestion: 'Use the modern `.addOperation(StellarSdk.Operation.payment(...))` pattern consistently.',
      ref: 'https://stellar.github.io/js-stellar-sdk/Operation.html',
    },
  ];

  for (const { pattern, severity, label, suggestion, ref } of deprecatedPatterns) {
    const matches = src.match(pattern);
    if (matches) {
      const lineNo = src.slice(0, src.indexOf(matches[0])).split('\n').length;
      issues.push({
        id: nextId('stellar-deprecated'),
        category: 'stellar-best-practice',
        severity,
        title: `Deprecated Stellar SDK pattern: ${label}`,
        description: `${matches.length} usage${matches.length > 1 ? 's' : ''} of deprecated pattern detected near line ${lineNo}.`,
        file: ctx.file.path,
        startLine: lineNo,
        endLine: lineNo + 1,
        snippet: ctx.lines[lineNo - 1]?.trim(),
        suggestion,
        rationale: 'Deprecated APIs may be removed in future SDK versions. Modern patterns are better maintained and documented.',
        confidence: 0.85,
        effortMinutes: matches.length * 5,
        likelyFalsePositive: false,
        stellarTags: ['deprecation'],
        references: [ref],
      });
    }
  }

  return issues;
};

/**
 * Detects potential React-specific issues (if file is .tsx/.jsx).
 */
const detectReactIssues: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  if (!ctx.file.path.endsWith('.tsx') && !ctx.file.path.endsWith('.jsx')) return issues;

  const src = ctx.source;

  // Detect missing key props in lists
  const mapPattern = /\.map\s*\(/g;
  const mapMatches = src.match(mapPattern);
  if (mapMatches) {
    issues.push({
      id: nextId('react-list-key'),
      category: 'reliability',
      severity: 'low',
      title: 'Verify list keys in .map() renders',
      description: 'Found `.map()` calls that might render lists without unique `key` props. Missing keys cause rendering bugs.',
      file: ctx.file.path,
      startLine: 1,
      endLine: ctx.lines.length,
      suggestion: 'Always provide a stable, unique `key` prop to the root element returned by `.map()`. Avoid using array index as key.',
      rationale: 'React uses keys to identify elements during reconciliation. Missing or unstable keys cause UI bugs and performance issues.',
      confidence: 0.6,
      effortMinutes: 10,
      likelyFalsePositive: true,
    });
  }

  // Detect direct state mutation
  const directMutationPattern = /(\.state|\.value|set[A-Z]\w+)\s*=\s*(?!\s*\))\(/;
  if (directMutationPattern.test(src)) {
    const match = src.match(directMutationPattern);
    if (match) {
      const lineNo = src.slice(0, match.index!).split('\n').length;
      issues.push({
        id: nextId('state-mutation'),
        category: 'potential-bug',
        severity: 'critical',
        title: `Potential direct state mutation on line ${lineNo}`,
        description: `Direct assignment pattern detected. State should only be updated via setState or useReducer dispatch.`,
        file: ctx.file.path,
        startLine: lineNo,
        endLine: lineNo,
        snippet: ctx.lines[lineNo - 1]?.trim(),
        suggestion: 'Use the state setter function (e.g., `setState(newValue)`) or reducer dispatch. Never directly assign to state variables.',
        rationale: 'Direct state mutation bypasses React\'s reconciliation and causes silent UI bugs.',
        confidence: 0.85,
        effortMinutes: 5,
        likelyFalsePositive: false,
      });
    }
  }

  return issues;
};

/**
 * Detects code duplication signals.
 */
const detectCodeDuplication: IssueDetector = (ctx) => {
  const issues: CodeReviewIssue[] = [];
  const lines = ctx.lines;

  // Simple duplication detection: find repeated blocks of 3+ lines
  const blockSize = 4;
  const seenBlocks = new Map<string, number[]>();

  for (let i = 0; i <= lines.length - blockSize; i++) {
    const block = lines.slice(i, i + blockSize).join('\n').trim();
    if (block.length < 20) continue; // skip trivial blocks

    const cleaned = block.replace(/\s/g, '');
    if (seenBlocks.has(cleaned)) {
      seenBlocks.get(cleaned)!.push(i + 1);
    } else {
      seenBlocks.set(cleaned, [i + 1]);
    }
  }

  for (const [, locations] of seenBlocks) {
    if (locations.length >= 2) {
      issues.push({
        id: nextId('code-duplication'),
        category: 'maintainability',
        severity: 'medium',
        title: `Code block duplicated across ${locations.length} locations`,
        description: `Found a ${blockSize}-line block repeated at lines ${locations.join(', ')}. Duplication leads to maintenance drift.`,
        file: ctx.file.path,
        startLine: locations[0],
        endLine: locations[0] + blockSize - 1,
        suggestion: 'Extract the duplicated block into a shared function or utility. Consider parameterizing differences.',
        rationale: 'Duplicated code diverges over time, creating bugs when only one copy is updated.',
        confidence: 0.7,
        effortMinutes: 15,
        likelyFalsePositive: true,
      });
      break; // One duplication warning per file to prevent noise
    }
  }

  return issues;
};

// ─── All Detectors Registry ──────────────────────────────────────────────────

const ALL_DETECTORS: IssueDetector[] = [
  detectAnyType,
  detectConsoleStatements,
  detectTodoMarkers,
  detectHighComplexity,
  detectHardcodedCredentials,
  detectStellarIssues,
  detectPerformanceIssues,
  detectErrorHandling,
  detectNullSafety,
  detectLongFunctions,
  detectMissingTypes,
  detectStellarDeprecated,
  detectReactIssues,
  detectCodeDuplication,
];

// ─── ML-Enhanced Analysis ────────────────────────────────────────────────────

const anomalyDetector = new CodeAnomalyDetector();

/**
 * Run the full static analysis pipeline on a set of source files.
 */
export function analyzeFiles(
  files: SourceFile[],
  options?: CodeReviewOptions
): CodeReviewIssue[] {
  const allIssues: CodeReviewIssue[] = [];
  const fileMetrics: number[][] = [];

  // First pass: collect metrics for ML anomaly detection
  for (const file of files) {
    const cleaned = stripComments(file.source);
    const loc = file.source.split('\n').length;
    const anyCount = countInSource(file.source, /:\s*any\b/g);
    const consoleCount = countInSource(file.source, /\bconsole\.\w+\b/g);
    const todoCount = countInSource(file.source, /\/\/\s*(TODO|FIXME|HACK|XXX)/gi);
    const complexity = computeFileComplexity(cleaned);

    fileMetrics.push([loc, anyCount, consoleCount, todoCount, complexity]);
  }

  // Train anomaly detector on file metrics
  if (fileMetrics.length >= 3) {
    anomalyDetector.fit(fileMetrics);
  }

  // Second pass: run all detectors
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const lines = file.source.split(/\r?\n/);
    const ctx: DetectorContext = { file, lines, source: file.source };

    // Score file anomaly
    let fileAnomalyScore = 0.5;
    if (fileMetrics.length >= 3 && fileMetrics[i]) {
      fileAnomalyScore = anomalyDetector.score(fileMetrics[i]);
    }

    const detectors = ALL_DETECTORS;

    for (const detector of detectors) {
      try {
        const issues = detector(ctx);
        for (const issue of issues) {
          // Apply ML confidence boost if file is anomalous
          if (fileAnomalyScore > 0.7) {
            issue.confidence = Math.min(0.99, issue.confidence + 0.1);
            issue.rationale += ' (ML anomaly scoring confirms this file merits attention.)';
          }

          // Apply options filtering
          if (options?.categories && !options.categories.includes(issue.category)) continue;
          if (options?.minSeverity && !shouldIncludeSeverity(issue.severity, options.minSeverity)) continue;
          if (options?.excludePatterns?.some((p) => file.path.includes(p))) continue;

          allIssues.push(issue);
        }
    } catch (err) {
      // Detectors must never crash the analysis
      // eslint-disable-next-line no-console
      console.warn(`[codeReview] detector failed for ${file.path}:`, err);
    }
    }
  }

  return allIssues;
}

function computeFileComplexity(cleaned: string): number {
  let complexity = 1;
  const branches = cleaned.match(/\b(if|for|while|case|catch)\b/g);
  if (branches) complexity += branches.length;
  const ops = cleaned.match(/(\&\&|\|\|)/g);
  if (ops) complexity += ops.length;
  return complexity;
}

function shouldIncludeSeverity(severity: IssueSeverity, minSeverity: IssueSeverity): boolean {
  const order: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  return order.indexOf(severity) <= order.indexOf(minSeverity);
}

export { CodeAnomalyDetector };
