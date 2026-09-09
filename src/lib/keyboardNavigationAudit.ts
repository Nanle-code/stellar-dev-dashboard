/**
 * Keyboard navigation audit utilities for dashboard routes.
 * Validates focus order, detect traps, and reports unsupported environments.
 */

export interface FocusableElementInfo {
  tagName: string;
  id: string;
  role: string | null;
  ariaLabel: string | null;
  tabIndex: number;
  isVisible: boolean;
  rect: { top: number; left: number; width: number; height: number } | null;
}

export interface TabOrderIssue {
  element: FocusableElementInfo;
  reason: 'hidden' | 'negative-tabindex' | 'no-accessible-name' | 'out-of-viewport';
  severity: 'error' | 'warning';
}

export interface KeyboardTrapInfo {
  containerSelector: string;
  focusableCount: number;
  canEscape: boolean;
}

export interface RouteKeyboardAuditResult {
  route: string;
  supported: boolean;
  unsupportedReason?: string;
  focusableCount: number;
  tabOrderIssues: TabOrderIssue[];
  traps: KeyboardTrapInfo[];
  hasSkipLink: boolean;
  hasMainLandmark: boolean;
  passed: boolean;
}

export interface KeyboardAuditSummary {
  timestamp: number;
  environmentSupported: boolean;
  unsupportedReason?: string;
  routes: RouteKeyboardAuditResult[];
  totalIssues: number;
  passed: boolean;
}

/** Dashboard routes that must support keyboard-only navigation. */
export const DASHBOARD_ROUTES = [
  'connect',
  'overview',
  'account',
  'transactions',
  'contracts',
  'network',
  'builder',
  'faucet',
  'compare',
  'wallet',
  'signer',
  'portfolio',
  'txBuilder',
  'contractInteraction',
  'contractABI',
  'dex',
  'liquidityPrediction',
  'pathExplorer',
  'explorers',
  'realtime',
  'charts',
  'assets',
  'multisig',
  'analytics',
  'designSystem',
  'featureFlags',
  'systemHealth',
  'performance',
  'logAnalyzer',
  'settings',
  'collaboration',
  'audit',
  'anchors',
  'search',
  'cacheStats',
  'liveActivity',
  'claimableBalances',
  'dataExport',
  'governance',
  'monitoringDashboards',
  'compliance',
  'security',
  'dependencyManagement',
  'txAnalytics',
  'anomalyViz',
] as const;

export type DashboardRoute = (typeof DASHBOARD_ROUTES)[number];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function isKeyboardNavigationSupported(): { supported: boolean; reason?: string } {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { supported: false, reason: 'DOM APIs are unavailable (SSR or non-browser environment)' };
  }
  if (typeof document.querySelector !== 'function') {
    return { supported: false, reason: 'document.querySelector is unavailable' };
  }
  return { supported: true };
}

function isElementVisible(el: HTMLElement): boolean {
  if (!el.getClientRects().length) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (parseFloat(style.opacity) === 0) return false;
  return true;
}

function getAccessibleName(el: HTMLElement): string | null {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl?.textContent?.trim()) return labelEl.textContent.trim();
  }

  if (el.tagName === 'INPUT') {
    const id = el.id;
    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label?.textContent?.trim()) return label.textContent.trim();
    }
    const placeholder = el.getAttribute('placeholder');
    if (placeholder?.trim()) return placeholder.trim();
  }

  const text = el.textContent?.trim();
  return text || null;
}

export function getFocusableElements(root: ParentNode = document): FocusableElementInfo[] {
  const env = isKeyboardNavigationSupported();
  if (!env.supported) return [];

  const elements = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

  return elements.map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      role: el.getAttribute('role'),
      ariaLabel: getAccessibleName(el),
      tabIndex: el.tabIndex,
      isVisible: isElementVisible(el),
      rect: rect.width || rect.height ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
    };
  });
}

export function auditTabOrder(root: ParentNode = document): TabOrderIssue[] {
  const env = isKeyboardNavigationSupported();
  if (!env.supported) return [];

  const issues: TabOrderIssue[] = [];
  const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

  focusable.forEach((el) => {
    const info: FocusableElementInfo = {
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      role: el.getAttribute('role'),
      ariaLabel: getAccessibleName(el),
      tabIndex: el.tabIndex,
      isVisible: isElementVisible(el),
      rect: null,
    };

    if (!info.isVisible) {
      issues.push({ element: info, reason: 'hidden', severity: 'warning' });
      return;
    }

    if (el.tabIndex < 0 && el.tagName !== 'BODY') {
      // tabindex="-1" is valid for programmatic focus targets
      if (el.getAttribute('tabindex') === '-1') return;
      issues.push({ element: info, reason: 'negative-tabindex', severity: 'warning' });
    }

    const needsName =
      el.tagName === 'BUTTON' ||
      el.tagName === 'A' ||
      el.getAttribute('role') === 'button' ||
      el.getAttribute('role') === 'link';

    if (needsName && !info.ariaLabel) {
      issues.push({ element: info, reason: 'no-accessible-name', severity: 'error' });
    }

    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      issues.push({ element: info, reason: 'out-of-viewport', severity: 'warning' });
    }
  });

  return issues;
}

export function detectKeyboardTraps(root: ParentNode = document): KeyboardTrapInfo[] {
  const env = isKeyboardNavigationSupported();
  if (!env.supported) return [];

  const traps: KeyboardTrapInfo[] = [];
  const modalRoots = root.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]');

  modalRoots.forEach((modal) => {
    const focusable = modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const selector = modal.id ? `#${modal.id}` : modal.getAttribute('role') || 'dialog';
    traps.push({
      containerSelector: selector,
      focusableCount: focusable.length,
      canEscape: focusable.length > 0,
    });
  });

  return traps;
}

export function auditRouteKeyboardNavigation(
  route: string,
  root: ParentNode = document,
): RouteKeyboardAuditResult {
  const env = isKeyboardNavigationSupported();
  if (!env.supported) {
    return {
      route,
      supported: false,
      unsupportedReason: env.reason,
      focusableCount: 0,
      tabOrderIssues: [],
      traps: [],
      hasSkipLink: false,
      hasMainLandmark: false,
      passed: false,
    };
  }

  if (!route.trim()) {
    return {
      route,
      supported: false,
      unsupportedReason: 'Route path is empty or invalid',
      focusableCount: 0,
      tabOrderIssues: [],
      traps: [],
      hasSkipLink: false,
      hasMainLandmark: false,
      passed: false,
    };
  }

  const focusable = getFocusableElements(root);
  const tabOrderIssues = auditTabOrder(root);
  const traps = detectKeyboardTraps(root);
  const hasSkipLink = Boolean(root.querySelector('.skip-link, [href="#main-content"]'));
  const hasMainLandmark = Boolean(root.querySelector('main, [role="main"], #main-content'));

  const errors = tabOrderIssues.filter((i) => i.severity === 'error');

  return {
    route,
    supported: true,
    focusableCount: focusable.filter((f) => f.isVisible).length,
    tabOrderIssues,
    traps,
    hasSkipLink,
    hasMainLandmark,
    passed: errors.length === 0 && hasMainLandmark && focusable.filter((f) => f.isVisible).length > 0,
  };
}

export function auditAllDashboardRoutes(root: ParentNode = document): KeyboardAuditSummary {
  const env = isKeyboardNavigationSupported();
  if (!env.supported) {
    return {
      timestamp: Date.now(),
      environmentSupported: false,
      unsupportedReason: env.reason,
      routes: [],
      totalIssues: 0,
      passed: false,
    };
  }

  const currentRoute = window.location.pathname.replace(/^\//, '') || 'connect';
  const result = auditRouteKeyboardNavigation(currentRoute, root);
  const totalIssues = result.tabOrderIssues.filter((i) => i.severity === 'error').length;

  return {
    timestamp: Date.now(),
    environmentSupported: true,
    routes: [result],
    totalIssues,
    passed: result.passed,
  };
}

export function validateRouteName(route: string): route is DashboardRoute {
  return (DASHBOARD_ROUTES as readonly string[]).includes(route);
}

/** Returns the next focusable element after the current active element. */
export function getNextFocusableElement(
  root: ParentNode = document,
  reverse = false,
): HTMLElement | null {
  const env = isKeyboardNavigationSupported();
  if (!env.supported) return null;

  const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => isElementVisible(el) && !el.hasAttribute('disabled'),
  );

  if (focusable.length === 0) return null;

  const active = document.activeElement as HTMLElement | null;
  const currentIndex = active ? focusable.indexOf(active) : -1;

  if (reverse) {
    const nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
    return focusable[nextIndex] ?? null;
  }

  const nextIndex = currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
  return focusable[nextIndex] ?? null;
}
