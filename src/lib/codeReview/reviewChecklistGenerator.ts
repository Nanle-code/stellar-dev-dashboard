/**
 * codeReview/reviewChecklistGenerator.ts
 *
 * Generates comprehensive code review checklists with auto-detected
 * status for each item based on source code analysis. Covers security,
 * Stellar-specific, code quality, testing, performance, documentation,
 * accessibility, and error handling dimensions.
 */

import type {
  ChecklistCategory,
  CodeReviewIssue,
  CodeReviewOptions,
  ReviewChecklistItem,
  SourceFile,
} from './types';

// ─── Base Checklist Templates ────────────────────────────────────────────────

interface ChecklistTemplate {
  id: string;
  category: ChecklistCategory;
  prompt: string;
  details: string;
  isStellarSpecific: boolean;
  /** Heuristic function that analyzes source and returns auto-status */
  detect: (files: SourceFile[], issues: CodeReviewIssue[]) => {
    status: ReviewChecklistItem['autoStatus'];
    evidence?: string;
  };
}

const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [

  // ── Security ────────────────────────────────────────────────────────────────
  {
    id: 'sec-1',
    category: 'security',
    prompt: 'No hardcoded secrets, API keys, or credentials in source code',
    details: 'Check for hardcoded passwords, tokens, private keys, seed phrases, and API keys. These should use environment variables or a secrets manager.',
    isStellarSpecific: false,
    detect: (_, issues) => {
      const credIssues = issues.filter((i) => i.category === 'security' && i.severity === 'critical');
      if (credIssues.length > 0) {
        return {
          status: 'fail',
          evidence: `${credIssues.length} hardcoded credential${credIssues.length > 1 ? 's' : ''} detected (${credIssues.map((i) => i.title).join('; ')})`,
        };
      }
      return { status: 'pass', evidence: 'No hardcoded secrets detected.' };
    },
  },
  {
    id: 'sec-2',
    category: 'security',
    prompt: 'Input validation and sanitization is implemented',
    details: 'All user inputs, especially Stellar addresses and amount strings, should be validated. Check for SQL injection, XSS, and command injection prevention.',
    isStellarSpecific: true,
    detect: (files) => {
      const allSource = files.map((f) => f.source).join('\n');
      if (/StrKey\.isValidEd25519PublicKey/.test(allSource)) {
        return { status: 'pass', evidence: 'StrKey validation found in codebase.' };
      }
      if (/['"](G[A-Z0-9]{55})['"]/.test(allSource)) {
        return { status: 'warning', evidence: 'Stellar addresses used but no StrKey validation detected.' };
      }
      return { status: 'unknown', evidence: 'No user input patterns detected for validation check.' };
    },
  },

  // ── Stellar-Specific ────────────────────────────────────────────────────────
  {
    id: 'stel-1',
    category: 'stellar-specific',
    prompt: 'Transactions include proper sequence number management',
    details: 'Each transaction must use the current account sequence number. Always call `server.loadAccount()` before building a transaction.',
    isStellarSpecific: true,
    detect: (files) => {
      const allSource = files.map((f) => f.source).join('\n');
      const hasTransactionBuilder = /TransactionBuilder/.test(allSource);
      const hasLoadAccount = /\.loadAccount\s*\(/.test(allSource);
      if (hasTransactionBuilder && !hasLoadAccount) {
        return { status: 'fail', evidence: 'TransactionBuilder used without loadAccount — sequence numbers may be stale.' };
      }
      if (hasTransactionBuilder && hasLoadAccount) {
        return { status: 'pass', evidence: 'loadAccount + TransactionBuilder pattern detected.' };
      }
      return { status: 'unknown', evidence: 'No transaction building patterns detected.' };
    },
  },
  {
    id: 'stel-2',
    category: 'stellar-specific',
    prompt: 'Soroban contract calls have proper resource estimation',
    details: 'Soroban contract invocations should use `simulateTransaction` to estimate resource fees and set appropriate limits before submission.',
    isStellarSpecific: true,
    detect: (files) => {
      const allSource = files.map((f) => f.source).join('\n');
      const hasSorobanCalls = /SorobanServer|sendTransaction|simulateTransaction/.test(allSource);
      const hasSimulation = /simulateTransaction/.test(allSource);
      if (hasSorobanCalls && !hasSimulation) {
        return { status: 'warning', evidence: 'Soroban calls detected without simulation — consider resource estimation.' };
      }
      if (hasSorobanCalls && hasSimulation) {
        return { status: 'pass', evidence: 'Soroban resource estimation via simulateTransaction detected.' };
      }
      return { status: 'unknown', evidence: 'No Soroban patterns detected.' };
    },
  },
  {
    id: 'stel-3',
    category: 'stellar-specific',
    prompt: 'Network passphrase is explicitly set during transaction building',
    details: 'Always explicitly set `networkPassphrase` in TransactionBuilder. Using defaults can lead to cross-network transaction submission.',
    isStellarSpecific: true,
    detect: (files) => {
      const allSource = files.map((f) => f.source).join('\n');
      const hasBuilder = /TransactionBuilder/.test(allSource);
      const hasPassphrase = /networkPassphrase/.test(allSource);
      if (hasBuilder && !hasPassphrase) {
        return { status: 'fail', evidence: 'TransactionBuilder used without explicit networkPassphrase.' };
      }
      if (hasBuilder && hasPassphrase) {
        return { status: 'pass', evidence: 'networkPassphrase explicitly configured.' };
      }
      return { status: 'unknown', evidence: 'No transaction building patterns detected.' };
    },
  },
  {
    id: 'stel-4',
    category: 'stellar-specific',
    prompt: 'Error handling covers Stellar-specific error codes',
    details: 'Stellar SDK errors contain specific result codes in the response. Check that code handles `tx_bad_seq`, `op_no_trust`, `op_underfunded`, etc.',
    isStellarSpecific: true,
    detect: (_, issues) => {
      const stellarErrIssues = issues.filter((i) => i.stellarTags?.includes('error-handling'));
      if (stellarErrIssues.length > 0) {
        return { status: 'fail', evidence: `${stellarErrIssues.length} Stellar SDK call${stellarErrIssues.length > 1 ? 's' : ''} without error handling.` };
      }
      return { status: 'pass', evidence: 'Stellar error handling patterns look adequate.' };
    },
  },
  {
    id: 'stel-5',
    category: 'stellar-specific',
    prompt: 'Streaming (SSE) is preferred over polling for real-time data',
    details: 'Use `.stream()` for payments, operations, and transactions instead of polling `.call()` at intervals.',
    isStellarSpecific: true,
    detect: (files) => {
      const allSource = files.map((f) => f.source).join('\n');
      const hasPolling = /\.payments\(\)\.call\(/.test(allSource) || /\.operations\(\)\.call\(/.test(allSource);
      const hasStreaming = /\.stream\(\s*\{/.test(allSource);
      if (hasPolling && !hasStreaming) {
        return { status: 'warning', evidence: 'Polling detected without streaming. Consider SSE for efficiency.' };
      }
      if (hasStreaming) {
        return { status: 'pass', evidence: 'Streaming (SSE) pattern detected.' };
      }
      return { status: 'unknown', evidence: 'No real-time data fetch patterns detected.' };
    },
  },

  // ── Code Quality ───────────────────────────────────────────────────────────
  {
    id: 'cq-1',
    category: 'code-quality',
    prompt: 'No `any` types used — strict TypeScript mode is enforced',
    details: 'TypeScript `any` disables type checking. Use specific types, generics, or `unknown` with narrowing.',
    isStellarSpecific: false,
    detect: (_, issues) => {
      const anyIssues = issues.filter((i) => i.category === 'type-safety');
      if (anyIssues.length > 0) {
        return { status: 'fail', evidence: `${anyIssues.length} type safety issue${anyIssues.length > 1 ? 's' : ''} detected.` };
      }
      return { status: 'pass', evidence: 'No type safety issues detected.' };
    },
  },
  {
    id: 'cq-2',
    category: 'code-quality',
    prompt: 'Cyclomatic complexity is within acceptable limits (< 10)',
    details: 'Functions with high cyclomatic complexity are harder to test and more likely to contain defects.',
    isStellarSpecific: false,
    detect: (_, issues) => {
      const complexityIssues = issues.filter((i) => i.category === 'complexity');
      if (complexityIssues.length > 0) {
        return {
          status: 'fail',
          evidence: `${complexityIssues.length} function${complexityIssues.length > 1 ? 's' : ''} exceed${complexityIssues.length === 1 ? 's' : ''} complexity threshold.`,
        };
      }
      return { status: 'pass', evidence: 'All functions within complexity limits.' };
    },
  },
  {
    id: 'cq-3',
    category: 'code-quality',
    prompt: 'No TODO/FIXME markers remain in code',
    details: 'Outstanding TODO/FIXME markers should be resolved or converted to tracking tickets with target dates.',
    isStellarSpecific: false,
    detect: (_, issues) => {
      const todoIssues = issues.filter((i) => i.title.includes('TODO') || i.title.includes('FIXME'));
      if (todoIssues.length > 0) {
        return { status: 'fail', evidence: `${todoIssues.length} TODO/FIXME marker${todoIssues.length > 1 ? 's' : ''} remaining.` };
      }
      return { status: 'pass', evidence: 'No outstanding TODO/FIXME markers.' };
    },
  },
  {
    id: 'cq-4',
    category: 'code-quality',
    prompt: 'Files are under 400 lines (modular design)',
    details: 'Large files with multiple responsibilities are harder to maintain and review. Aim for single-responsibility modules.',
    isStellarSpecific: false,
    detect: (_, issues) => {
      const longFiles = issues.filter((i) => i.category === 'maintainability' && i.title.includes('File is very long'));
      if (longFiles.length > 0) {
        return { status: 'fail', evidence: `${longFiles.length} file${longFiles.length > 1 ? 's' : ''} exceed recommended length.` };
      }
      return { status: 'pass', evidence: 'All files within recommended length limits.' };
    },
  },

  // ── Testing ─────────────────────────────────────────────────────────────────
  {
    id: 'test-1',
    category: 'testing',
    prompt: 'Critical business logic has unit tests',
    details: 'Core Stellar operations (transaction building, account management, asset operations) should have thorough unit test coverage.',
    isStellarSpecific: false,
    detect: (files) => {
      const hasTestFiles = files.some((f) => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f.path));
      if (hasTestFiles) {
        return { status: 'pass', evidence: 'Test files found in the codebase.' };
      }
      return { status: 'warning', evidence: 'No test files detected in the analyzed files.' };
    },
  },
  {
    id: 'test-2',
    category: 'testing',
    prompt: 'Stellar integration tests are present for critical flows',
    details: 'Integration tests should cover Stellar SDK interactions: account loading, transaction submission, Soroban contract calls, and error scenarios.',
    isStellarSpecific: true,
    detect: (files) => {
      const allSource = files.map((f) => f.source).join('\n');
      const hasStellarTests = /StellarSdk|Horizon|Soroban|testnet|Testnet/.test(allSource) &&
        files.some((f) => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f.path));
      if (hasStellarTests) {
        return { status: 'pass', evidence: 'Stellar-specific test files detected.' };
      }
      return { status: 'warning', evidence: 'No Stellar-specific test files found.' };
    },
  },

  // ── Performance ─────────────────────────────────────────────────────────────
  {
    id: 'perf-1',
    category: 'performance',
    prompt: 'No nested loops operating on large datasets',
    details: 'Nested loops create O(n²) performance characteristics. Use Maps, Sets, or indexing for lookups.',
    isStellarSpecific: false,
    detect: (_, issues) => {
      const perfIssues = issues.filter((i) => i.category === 'performance');
      if (perfIssues.length > 0) {
        return { status: 'fail', evidence: `${perfIssues.length} performance issue${perfIssues.length > 1 ? 's' : ''} detected.` };
      }
      return { status: 'pass', evidence: 'No performance issues detected.' };
    },
  },
  {
    id: 'perf-2',
    category: 'performance',
    prompt: 'Stellar Horizon responses are cached appropriately',
    details: 'Frequently accessed Horizon data (account details, offers, trades) should be cached with appropriate TTLs to reduce API calls.',
    isStellarSpecific: true,
    detect: (files) => {
      const allSource = files.map((f) => f.source).join('\n');
      if (/cache|Cache|useSWR|ReactQuery/.test(allSource) && /(loadAccount|payments|operations)/.test(allSource)) {
        return { status: 'pass', evidence: 'Caching patterns detected alongside SDK calls.' };
      }
      return { status: 'unknown', evidence: 'Unable to verify caching configuration.' };
    },
  },

  // ── Documentation ──────────────────────────────────────────────────────────
  {
    id: 'doc-1',
    category: 'documentation',
    prompt: 'Public API functions have JSDoc/TSDoc comments',
    details: 'All exported functions, interfaces, and types should have documentation explaining their purpose, parameters, and return values.',
    isStellarSpecific: false,
    detect: (files) => {
      const exports = files.filter((f) => /export\s+(function|class|interface|type|const)/.test(f.source));
      const documented = files.filter((f) => /\/\*\*[\s\S]*?\*\//.test(f.source));
      if (exports.length > 0 && documented.length > 0) {
        return { status: 'pass', evidence: `${documented.length}/${exports.length} file${exports.length > 1 ? 's' : ''} with JSDoc comments.` };
      }
      return { status: 'warning', evidence: 'Export files without JSDoc detected.' };
    },
  },

  // ── Error Handling ──────────────────────────────────────────────────────────
  {
    id: 'err-1',
    category: 'error-handling',
    prompt: 'Async operations are wrapped in try/catch blocks',
    details: 'All asynchronous Stellar SDK operations must have proper error handling. Unhandled promise rejections crash the application.',
    isStellarSpecific: false,
    detect: (_, issues) => {
      const errIssues = issues.filter((i) => i.category === 'reliability' && i.title.includes('error handling'));
      if (errIssues.length > 0) {
        return { status: 'fail', evidence: `${errIssues.length} error handling issue${errIssues.length > 1 ? 's' : ''} detected.` };
      }
      return { status: 'pass', evidence: 'Error handling patterns look sufficient.' };
    },
  },
  {
    id: 'err-2',
    category: 'error-handling',
    prompt: 'Catch blocks provide meaningful recovery or user feedback',
    details: 'Empty catch blocks that silently swallow errors should be avoided. Log, retry, or show user-facing error messages.',
    isStellarSpecific: false,
    detect: (_, issues) => {
      const emptyCatches = issues.filter((i) => i.title.includes('Empty catch'));
      if (emptyCatches.length > 0) {
        return { status: 'fail', evidence: `${emptyCatches.length} empty catch block${emptyCatches.length > 1 ? 's' : ''} detected.` };
      }
      return { status: 'pass', evidence: 'No empty catch blocks detected.' };
    },
  },

  // ── Accessibility ──────────────────────────────────────────────────────────
  {
    id: 'a11y-1',
    category: 'accessibility',
    prompt: 'Interactive elements have accessible labels and keyboard support',
    details: 'Buttons, inputs, and other interactive elements should have aria-labels, keyboard handlers, and visible focus states.',
    isStellarSpecific: false,
    detect: (files) => {
      const jsxFiles = files.filter((f) => f.path.endsWith('.tsx') || f.path.endsWith('.jsx'));
      const allJsxSource = jsxFiles.map((f) => f.source).join('\n');

      const buttonsWithoutLabel = (allJsxSource.match(/<button[^>]*>/g) || []).filter(
        (b) => !/aria-label/.test(b) && !/title=/.test(b)
      );
      const inputsWithoutLabel = (allJsxSource.match(/<input[^>]*>/g) || []).filter(
        (i) => !/aria-label/.test(i) && !/aria-labelledby/.test(i)
      );

      if (buttonsWithoutLabel.length > 3 || inputsWithoutLabel.length > 3) {
        return {
          status: 'fail',
          evidence: `${buttonsWithoutLabel.length} button${buttonsWithoutLabel.length > 1 ? 's' : ''} and ${inputsWithoutLabel.length} input${inputsWithoutLabel.length > 1 ? 's' : ''} without accessible labels.`,
        };
      }
      if (jsxFiles.length > 0) {
        return { status: 'pass', evidence: 'Interactive elements have adequate labeling.' };
      }
      return { status: 'unknown', evidence: 'No JSX/TSX files in analysis.' };
    },
  },
];

// ─── Category Map for Filtering ──────────────────────────────────────────────

const CATEGORY_FILTER_MAP: Record<string, ChecklistCategory> = {
  security: 'security',
  'stellar-best-practice': 'stellar-specific',
  'code-style': 'code-quality',
  maintainability: 'code-quality',
  complexity: 'code-quality',
  'type-safety': 'code-quality',
  testing: 'testing',
  performance: 'performance',
  documentation: 'documentation',
  reliability: 'error-handling',
  'potential-bug': 'code-quality',
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a comprehensive review checklist for a set of files.
 * Each item includes an auto-detected status based on source analysis.
 */
export function generateReviewChecklist(
  files: SourceFile[],
  issues: CodeReviewIssue[],
  options?: CodeReviewOptions
): ReviewChecklistItem[] {
  const checklist: ReviewChecklistItem[] = [];

  for (const template of CHECKLIST_TEMPLATES) {
    const result = template.detect(files, issues);
    const item: ReviewChecklistItem = {
      id: template.id,
      category: template.category,
      prompt: template.prompt,
      details: template.details,
      isStellarSpecific: template.isStellarSpecific,
      autoStatus: result.status,
      evidence: result.evidence,
    };
    checklist.push(item);
  }

  // Apply category filter if specified
  if (options?.categories) {
    return checklist.filter((item) => {
      return options.categories!.some((c) => CATEGORY_FILTER_MAP[c] === item.category);
    });
  }

  return checklist;
}

/**
 * Get review checklist statistics: pass/fail/warning counts.
 */
export function getChecklistStats(checklist: ReviewChecklistItem[]) {
  const stats = {
    pass: 0,
    fail: 0,
    warning: 0,
    unknown: 0,
    total: checklist.length,
    stellarSpecific: {
      pass: 0,
      fail: 0,
      warning: 0,
      total: 0,
    },
  };

  for (const item of checklist) {
    stats[item.autoStatus]++;
    if (item.isStellarSpecific) {
      stats.stellarSpecific[item.autoStatus]++;
      stats.stellarSpecific.total++;
    }
  }

  stats.stellarSpecific.total = checklist.filter((i) => i.isStellarSpecific).length;

  return stats;
}
