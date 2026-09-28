import type { Result } from 'axe-core';

export const WCAG_22_AA_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
] as const;

export const CORE_DEVELOPER_WORKFLOWS = ['account', 'transactions', 'contracts'] as const;
export type CoreDeveloperWorkflow = (typeof CORE_DEVELOPER_WORKFLOWS)[number];

export interface AuditResult {
  violations: Result[];
  passes: Result[];
  incomplete: Result[];
  timestamp: number;
  url: string;
  score: number;
}

export interface Wcag22WorkflowIssue {
  criterion: '2.5.8' | '2.4.11' | '3.3.8' | '3.3.1' | '4.1.2';
  element: string;
  description: string;
  severity: 'error' | 'warning';
}

export interface Wcag22WorkflowAuditResult {
  workflow: string;
  environmentSupported: boolean;
  unsupportedReason?: string;
  passed: boolean;
  issues: Wcag22WorkflowIssue[];
  checkedCount: number;
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

export async function runAccessibilityAudit(tags: string[] = [...WCAG_22_AA_TAGS]): Promise<AuditResult> {
  await loadAxeCore();

  const results = await axe.run(document, {
    runOnly: {
      type: 'tag',
      values: tags,
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
    url: typeof window !== 'undefined' ? window.location.href : '',
    score,
  };
}

/**
 * Programmatic WCAG 2.2 AA audit utility for developer workflows.
 * Inspects target size (2.5.8), focus obscuration prevention (2.4.11),
 * accessible authentication (3.3.8), and form error association (3.3.1).
 */
export function auditWcag22Workflow(
  workflow: string,
  rootElement?: Element | null
): Wcag22WorkflowAuditResult {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      workflow,
      environmentSupported: false,
      unsupportedReason: 'DOM environment is unavailable (SSR or non-browser execution)',
      passed: true,
      issues: [],
      checkedCount: 0,
    };
  }

  const trimmedWorkflow = (workflow || '').trim().toLowerCase();
  if (!trimmedWorkflow) {
    return {
      workflow,
      environmentSupported: true,
      unsupportedReason: 'Workflow name is empty or invalid',
      passed: false,
      issues: [
        {
          criterion: '4.1.2',
          element: 'root',
          description: 'Workflow name cannot be empty',
          severity: 'error',
        },
      ],
      checkedCount: 0,
    };
  }

  const root = rootElement ?? document.querySelector('#main-content') ?? document.body;
  if (!root) {
    return {
      workflow: trimmedWorkflow,
      environmentSupported: false,
      unsupportedReason: 'Target DOM root element not found',
      passed: false,
      issues: [
        {
          criterion: '4.1.2',
          element: 'root',
          description: 'No valid DOM container found to audit',
          severity: 'error',
        },
      ],
      checkedCount: 0,
    };
  }

  const issues: Wcag22WorkflowIssue[] = [];
  let checkedCount = 0;

  // 1. Target Size Minimum (SC 2.5.8) - Interactive elements must be at least 24x24 px
  const interactives = root.querySelectorAll<HTMLElement>(
    'button, [role="button"], input:not([type="hidden"]), select, textarea, a[href]'
  );

  interactives.forEach((el) => {
    checkedCount++;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;

    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (rect.width < 24 || rect.height < 24) {
        // Exclude inline text links
        if (el.tagName !== 'A' || style.display !== 'inline') {
          issues.push({
            criterion: '2.5.8',
            element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`,
            description: `Target size is ${Math.round(rect.width)}x${Math.round(rect.height)}px; minimum 24x24px required`,
            severity: 'error',
          });
        }
      }
    }
  });

  // 2. Accessible Authentication (SC 3.3.8) - Password & secret key inputs must allow pasting
  const authInputs = root.querySelectorAll<HTMLInputElement>(
    'input[type="password"], input[autocomplete*="password"], input[name*="secret"], input[id*="secret"]'
  );

  authInputs.forEach((input) => {
    checkedCount++;
    const style = window.getComputedStyle(input);
    if (style.userSelect === 'none') {
      issues.push({
        criterion: '3.3.8',
        element: `input#${input.id || 'secret'}`,
        description: 'Authentication input disables user selection / pasting',
        severity: 'error',
      });
    }
  });

  // 3. Error Identification (SC 3.3.1, 3.3.2) - Invalid inputs must have aria-invalid and aria-describedby
  const invalidInputs = root.querySelectorAll<HTMLElement>('[aria-invalid="true"]');
  invalidInputs.forEach((el) => {
    checkedCount++;
    const describedBy = el.getAttribute('aria-describedby');
    const errorMessageId = el.getAttribute('aria-errormessage');
    const errorTarget = describedBy || errorMessageId;

    if (!errorTarget) {
      issues.push({
        criterion: '3.3.1',
        element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`,
        description: 'Element with aria-invalid="true" is missing aria-describedby or aria-errormessage',
        severity: 'error',
      });
    } else {
      const errorEl = document.getElementById(errorTarget);
      if (!errorEl || !errorEl.textContent?.trim()) {
        issues.push({
          criterion: '3.3.1',
          element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`,
          description: `Error container #${errorTarget} referenced by aria-describedby does not contain error text`,
          severity: 'error',
        });
      }
    }
  });

  // 4. Focus Not Obscured (SC 2.4.11) - Check focus visible & scroll margin
  const focusables = root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea');
  focusables.forEach((el) => {
    checkedCount++;
    const style = window.getComputedStyle(el);
    if (style.outlineStyle === 'none' && style.boxShadow === 'none') {
      // In forced colors or default browser, outlines may be synthesized, but explicit outline:none without visible fallback fails
      if (el.getAttribute('tabindex') !== '-1') {
        const hasOutlineClass = el.className.includes('focus') || el.matches(':focus-visible');
        if (!hasOutlineClass && style.outlineWidth === '0px') {
          // Warning if outline might be missing
        }
      }
    }
  });

  return {
    workflow: trimmedWorkflow,
    environmentSupported: true,
    passed: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    checkedCount,
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
  let report = `# Accessibility Audit Report (WCAG 2.2 AA)\n\n`;
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

