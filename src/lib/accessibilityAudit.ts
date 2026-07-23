import type { Result, NodeResult } from 'axe-core';

export interface AuditResult {
  violations: Result[];
  passes: Result[];
  incomplete: Result[];
  timestamp: number;
  url: string;
  score: number;
}

let axe: any = null;

export async function loadAxeCore(): Promise<void> {
  if (axe) return;
  
  try {
    const module = await import('axe-core');
    axe = module.default;
  } catch (error) {
    console.error('Failed to load axe-core', error);
    throw new Error('Accessibility auditing is not available');
  }
}

export async function runAccessibilityAudit(): Promise<AuditResult> {
  await loadAxeCore();

  const results = await axe.run(document, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
  });

  const totalTests = results.violations.length + results.passes.length;
  const score = totalTests > 0 
    ? Math.round((results.passes.length / totalTests) * 100)
    : 100;

  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
    timestamp: Date.now(),
    url: window.location.href,
    score,
  };
}

export function formatViolation(violation: Result): string {
  const nodeCount = violation.nodes.length;
  return `${violation.help} (${nodeCount} instance${nodeCount !== 1 ? 's' : ''})`;
}

export function getViolationSeverity(impact?: string): 'critical' | 'serious' | 'moderate' | 'minor' {
  return (impact as any) || 'minor';
}

export function generateAccessibilityReport(audit: AuditResult): string {
  let report = `# Accessibility Audit Report\n\n`;
  report += `**Score:** ${audit.score}/100\n`;
  report += `**Date:** ${new Date(audit.timestamp).toLocaleString()}\n`;
  report += `**URL:** ${audit.url}\n\n`;
  
  report += `## Summary\n\n`;
  report += `- Violations: ${audit.violations.length}\n`;
  report += `- Passes: ${audit.passes.length}\n`;
  report += `- Incomplete: ${audit.incomplete.length}\n\n`;
  
  if (audit.violations.length > 0) {
    report += `## Violations\n\n`;
    audit.violations.forEach((violation, idx) => {
      report += `### ${idx + 1}. ${violation.help}\n\n`;
      report += `**Impact:** ${violation.impact}\n`;
      report += `**Description:** ${violation.description}\n`;
      report += `**Help:** ${violation.helpUrl}\n\n`;
      report += `**Affected Elements:** ${violation.nodes.length}\n\n`;
    });
  }
  
  return report;
}
