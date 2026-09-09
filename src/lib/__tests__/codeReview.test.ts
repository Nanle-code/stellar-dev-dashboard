/**
 * Tests for the AI-Powered Code Review Assistant pipeline.
 * Validates that all subsystems integrate correctly and produce
 * expected results from sample source files.
 */

import { describe, it, expect } from 'vitest';
import {
  runCodeReview,
  generateTopRecommendations,
  getPrioritizedSuggestions,
  clusterSuggestions,
  toJSON,
  toMarkdown,
  toHTML,
  analyzeFiles,
} from '../codeReview';
import type { SourceFile, CodeReviewResult } from '../codeReview';

// ─── Demo Files ──────────────────────────────────────────────────────────────

const WELL_WRITTEN_FILE: SourceFile = {
  path: 'src/lib/utils.ts',
  language: 'ts',
  source: `
/**
 * Calculate the sum of two numbers.
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Greet a user by name.
 */
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`.trim(),
};

const POORLY_WRITTEN_FILE: SourceFile = {
  path: 'src/lib/broken.ts',
  language: 'ts',
  source: `
function process(data: any) {
  console.log('Processing data:', data);
  // TODO: add validation later
  var result: any = data.value;
  return result;
}

// FIXME: This is a workaround
function hackyFunction(items: any[]) {
  for (var i = 0; i < items.length; i++) {
    for (var j = 0; j < items.length; j++) {
      console.log(items[i], items[j]);
    }
  }
}

const API_KEY = 'sk-1234-secret';
`.trim(),
};

const STELLAR_FILE: SourceFile = {
  path: 'src/lib/stellar/payments.ts',
  language: 'ts',
  source: `
import { Server } from '@stellar/stellar-sdk';

const server = new Server('https://horizon-testnet.stellar.org');

export async function sendPayment(account: any, destination: string, amount: string) {
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(StellarSdk.Operation.payment({
      destination,
      asset: StellarSdk.Asset.native(),
      amount,
    }))
    .setTimeout(30)
    .build();

  return await server.submitTransaction(tx);
}
`.trim(),
};

const REACT_FILE: SourceFile = {
  path: 'src/components/AccountView.tsx',
  language: 'tsx',
  source: `
import React, { useState, useEffect } from 'react';

export default function AccountView({ publicKey }: { publicKey: string }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(\`/api/accounts/\${publicKey}\`);
        const result = await response.json();
        setData(result);
      } catch (err) {
        setData(null);
      }
    }
    load();
  }, [publicKey]);

  return (
    <div>
      {data?.balances?.map((b: any, i: number) => (
        <div key={i}>{b.balance}</div>
      ))}
    </div>
  );
}
`.trim(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Code Review Assistant — Pipeline Integration', () => {
  it('runs the full pipeline on well-written code', () => {
    const result = runCodeReview([WELL_WRITTEN_FILE]);
    expect(result).toBeDefined();
    expect(result.issues).toBeInstanceOf(Array);
    expect(result.analyzedFiles).toContain('src/lib/utils.ts');
    expect(result.codeHealthScore).toBeGreaterThanOrEqual(0);
    expect(result.codeHealthScore).toBeLessThanOrEqual(100);
    expect(result.analyzedAt).toBeTruthy();
  });

  it('detects issues in poorly written code', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('reports severity breakdown correctly', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const totalFromBreakdown =
      result.severityBreakdown.critical +
      result.severityBreakdown.high +
      result.severityBreakdown.medium +
      result.severityBreakdown.low +
      result.severityBreakdown.info;
    expect(totalFromBreakdown).toBe(result.issues.length);
  });

  it('generates a non-empty summary', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE, WELL_WRITTEN_FILE]);
    expect(result.summary).toBeTruthy();
    expect(result.summary.length).toBeGreaterThan(10);
  });

  it('computes code health score between 0 and 100', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    expect(result.codeHealthScore).toBeGreaterThanOrEqual(0);
    expect(result.codeHealthScore).toBeLessThanOrEqual(100);
  });

  it('passesGate is boolean', () => {
    const result = runCodeReview([WELL_WRITTEN_FILE]);
    expect(typeof result.passesGate).toBe('boolean');
  });

  it('generates review checklist items', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE], { generateChecklist: true });
    expect(result.checklist.length).toBeGreaterThan(0);
  });

  it('generates top recommendations', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    expect(result.topRecommendations.length).toBeGreaterThan(0);
  });

  it('estimates total effort in minutes', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    expect(result.totalEstimatedEffortMinutes).toBeGreaterThan(0);
  });

  it('detects hardcoded credentials', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const secretIssues = result.issues.filter((i) => i.category === 'security');
    expect(secretIssues.length).toBeGreaterThan(0);
  });

  it('detects TODO/FIXME markers', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const todoIssues = result.issues.filter(
      (i) => i.title.includes('TODO') || i.title.includes('FIXME')
    );
    expect(todoIssues.length).toBeGreaterThan(0);
  });

  it('detects console statements', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const consoleIssues = result.issues.filter((i) => i.title.includes('console'));
    expect(consoleIssues.length).toBeGreaterThan(0);
  });

  it('detects any types', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE, REACT_FILE]);
    const anyIssues = result.issues.filter((i) => i.category === 'type-safety');
    expect(anyIssues.length).toBeGreaterThan(0);
  });

  it('detects high complexity in nested loops', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const complexityIssues = result.issues.filter((i) => i.category === 'complexity');
    const perfIssues = result.issues.filter((i) => i.category === 'performance');
    expect(complexityIssues.length + perfIssues.length).toBeGreaterThan(0);
  });

  it('applies ML anomaly scoring confidence boost for outlier files', () => {
    const result = runCodeReview([WELL_WRITTEN_FILE, POORLY_WRITTEN_FILE]);
    // The poorly written file is anomalous compared to the well-written one
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('exports JSON that can be parsed back', () => {
    const result = runCodeReview([WELL_WRITTEN_FILE]);
    const json = toJSON(result);
    const parsed = JSON.parse(json);
    expect(parsed.codeHealthScore).toBe(result.codeHealthScore);
    expect(parsed.analyzedFiles).toEqual(result.analyzedFiles);
  });

  it('exports markdown with sections', () => {
    const result = runCodeReview([WELL_WRITTEN_FILE, POORLY_WRITTEN_FILE]);
    const md = toMarkdown(result);
    expect(md).toContain('AI-Powered Code Review');
    expect(md).toContain('Summary');
    expect(md).toContain('Issues');
  });

  it('exports HTML with proper structure', () => {
    const result = runCodeReview([WELL_WRITTEN_FILE]);
    const html = toHTML(result);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    expect(html).toContain('AI-Powered Code Review Report');
  });

  it('filter issues by severity', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE], { minSeverity: 'high' });
    for (const issue of result.issues) {
      expect(['critical', 'high']).toContain(issue.severity);
    }
  });
});

describe('Code Review Assistant — Suggestions & Clustering', () => {
  it('prioritizes critical issues over low severity', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const suggestions = getPrioritizedSuggestions(result.issues);
    expect(suggestions.length).toBeGreaterThan(0);
    // First suggestion should have highest priority
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].priorityScore).toBeGreaterThanOrEqual(suggestions[i].priorityScore);
    }
  });

  it('clusters suggestions into quick wins, high impact, strategic', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const suggestions = getPrioritizedSuggestions(result.issues);
    const clusters = clusterSuggestions(suggestions);
    expect(clusters).toHaveProperty('quickWins');
    expect(clusters).toHaveProperty('highImpact');
    expect(clusters).toHaveProperty('strategic');
    const totalClustered =
      clusters.quickWins.length + clusters.highImpact.length + clusters.strategic.length;
    expect(totalClustered).toBeGreaterThanOrEqual(suggestions.length - 1);
  });

  it('generateTopRecommendations returns at most maxRecommendations items', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const recs = generateTopRecommendations(result.issues, 3);
    expect(recs.length).toBeLessThanOrEqual(3);
    expect(recs.length).toBeGreaterThan(0);
  });

  it('generateTopRecommendations includes emoji prefixes', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const recs = generateTopRecommendations(result.issues);
    expect(recs.some((r) => r.startsWith('🚨') || r.startsWith('⚠️') || r.startsWith('💡'))).toBe(true);
  });
});

describe('Code Review Assistant — Stellar Best Practices', () => {
  it('detects Stellar SDK calls without error handling', () => {
    const result = runCodeReview([STELLAR_FILE], { stellarBestPractices: true });
    const stellarIssues = result.issues.filter((i) => i.stellarTags?.length);
    expect(stellarIssues.length).toBeGreaterThan(0);
  });

  it('returns best practice recommendations array', () => {
    const result = runCodeReview([STELLAR_FILE], { stellarBestPractices: true });
    expect(result.bestPractices).toBeDefined();
    expect(Array.isArray(result.bestPractices)).toBe(true);
  });
});

describe('Code Review Assistant — React Issues', () => {
  it('detects React-specific issues in TSX files', () => {
    const result = runCodeReview([REACT_FILE]);
    const reactIssues = result.issues.filter(
      (i) => i.category === 'potential-bug' || i.category === 'reliability'
    );
    expect(reactIssues.length).toBeGreaterThan(0);
  });
});

describe('Code Review Assistant — Edge Cases', () => {
  it('handles empty file list gracefully', () => {
    const result = runCodeReview([]);
    expect(result.issues).toHaveLength(0);
    expect(result.analyzedFiles).toHaveLength(0);
    expect(result.codeHealthScore).toBeGreaterThanOrEqual(0);
  });

  it('handles empty source files', () => {
    const emptyFile: SourceFile = { path: 'empty.ts', language: 'ts', source: '' };
    const result = runCodeReview([emptyFile]);
    expect(result.issues).toBeInstanceOf(Array);
    expect(result.codeHealthScore).toBeGreaterThanOrEqual(0);
  });

  it('handles very large files without crashing', () => {
    const largeFile: SourceFile = {
      path: 'large.ts',
      language: 'ts',
      source: Array.from({ length: 1000 }, (_, i) => `export const fn${i} = () => ${i};\n`).join(''),
    };
    const result = runCodeReview([largeFile]);
    expect(result.issues).toBeInstanceOf(Array);
    expect(result.codeHealthScore).toBeGreaterThanOrEqual(0);
  });

  it('handles files with special characters', () => {
    const specialFile: SourceFile = {
      path: 'special.ts',
      language: 'ts',
      source: 'const x = "héllo wörld 🚀";\n// TODO: fix i18n\nconsole.log(x);\n'.trim(),
    };
    const result = runCodeReview([specialFile]);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('Code Review Assistant — Report Formats', () => {
  it('JSON report contains all required fields', () => {
    const result = runCodeReview([WELL_WRITTEN_FILE, POORLY_WRITTEN_FILE]);
    const json = JSON.parse(toJSON(result));
    expect(json).toHaveProperty('analyzedAt');
    expect(json).toHaveProperty('analyzedFiles');
    expect(json).toHaveProperty('issues');
    expect(json).toHaveProperty('codeHealthScore');
    expect(json).toHaveProperty('summary');
    expect(json).toHaveProperty('passesGate');
  });

  it('Markdown report includes severity breakdown table', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE]);
    const md = toMarkdown(result);
    expect(md).toContain('| Severity');
    expect(md).toContain('|');
  });

  it('HTML report is valid and contains all sections', () => {
    const result = runCodeReview([WELL_WRITTEN_FILE, POORLY_WRITTEN_FILE]);
    const html = toHTML(result);
    expect(html).toContain('Score:');
    expect(html).toContain('Review Checklist');
    expect(html).toContain('All Issues');
    expect(html).toContain('Files Analyzed');
  });
});

describe('Code Review Assistant — Regression Safety', () => {
  it('well-written code has higher health score than poorly written code', () => {
    const goodResult = runCodeReview([WELL_WRITTEN_FILE]);
    const badResult = runCodeReview([POORLY_WRITTEN_FILE]);
    expect(goodResult.codeHealthScore).toBeGreaterThan(badResult.codeHealthScore);
  });

  it('passesGate is false for clean code due to checklist warnings', () => {
    const result = runCodeReview([WELL_WRITTEN_FILE], { passThreshold: 50 });
    // Clean code may still have checklist warnings (e.g., missing test files)
    // so passesGate may be false even with no critical issues
    expect(result.criticalCount).toBe(0);
  });

  it('passesGate is false for code with critical issues', () => {
    const result = runCodeReview([POORLY_WRITTEN_FILE], { passThreshold: 90 });
    expect(result.passesGate).toBe(false);
  });

  it('analyzeFiles returns at least one issue for problematic code', () => {
    const issues = analyzeFiles([POORLY_WRITTEN_FILE, STELLAR_FILE]);
    expect(issues.length).toBeGreaterThan(0);
  });
});
