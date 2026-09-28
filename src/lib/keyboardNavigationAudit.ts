/**
 * Keyboard navigation audit utilities for dashboard routes.
 * Validates focus order, detect traps, and reports unsupported environments.
 */

import { ROUTES } from '../routes/routes';

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

export type OverlayTrapIssueCode =
  | 'no-escape-control'
  | 'no-focusable-content'
  | 'background-not-inert'
  | 'focus-restoration-unhinted';

export interface OverlayTrapIssue {
  code: OverlayTrapIssueCode;
  message: string;
  severity: 'error' | 'warning';
}

export interface OverlayStackEntry {
  containerSelector: string;
  /** `dialog`, `alertdialog`, or the value of `data-overlay`. */
  role: string;
  /** Number of overlay ancestors; 0 for the bottom of the stack. */
  depth: number;
  /** Selectors from the outermost ancestor overlay down to this one. */
  stackPath: string[];
  focusableCount: number;
  /** True when the container exposes an Escape affordance (close control). */
  hasEscapeControl: boolean;
  canEscape: boolean;
  trapRisk: 'none' | 'low' | 'high';
  issues: OverlayTrapIssue[];
}

export interface OverlayStackAudit {
  supported: boolean;
  unsupportedReason?: string;
  containerCount: number;
  /** Number of nesting levels actually in use (1 = single overlay). */
  stackDepth: number;
  /** Outermost → innermost. */
  entries: OverlayStackEntry[];
  topmost: OverlayStackEntry | null;
  errorCount: number;
  warningCount: number;
  passed: boolean;
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
  /** Nested modal/drawer stack audit (#874). Present when the DOM is auditable. */
  overlayStack?: OverlayStackAudit;
}

export interface KeyboardAuditSummary {
  timestamp: number;
  environmentSupported: boolean;
  unsupportedReason?: string;
  routes: RouteKeyboardAuditResult[];
  totalIssues: number;
  passed: boolean;
}

/**
 * Dashboard routes that must support keyboard-only navigation.
 *
 * Derived from the route registry (#959) so the audit list can never drift
 * from the views that actually render. `connect` is not a registry view, so it
 * is prepended explicitly.
 */
export const DASHBOARD_ROUTES = ['connect', ...ROUTES.map((route) => route.id)] as const;

export type DashboardRoute = (typeof DASHBOARD_ROUTES)[number];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Containers that participate in an overlay (modal / drawer) stack.
 *
 * Drawers are detected via explicit markers (`data-overlay="drawer"`,
 * `data-drawer`) or the standard dialog roles — class-name sniffing is
 * intentionally avoided because backdrop elements often carry `drawer` in
 * their class name (e.g. `mobile-drawer-backdrop`) without being overlays.
 */
export const OVERLAY_CONTAINER_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [data-overlay="drawer"], [data-drawer="true"], [data-drawer=""]';

const ESCAPE_NAME_PATTERN = /^(close|cancel|dismiss|exit|back|done|ok|accept|\u00d7|\u2715|x)$/i;

function describeContainer(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const role = el.getAttribute('role') || el.getAttribute('data-overlay') || 'dialog';
  return role;
}

/** True when the element plausibly dismisses its overlay (close affordance). */
function isEscapeControl(el: Element): boolean {
  if (el.hasAttribute('data-dismiss') || el.hasAttribute('data-close')) return true;
  const shortcuts = el.getAttribute('aria-keyshortcuts');
  if (shortcuts && /escape/i.test(shortcuts)) return true;
  if (el.classList.contains('close')) return true;
  const label =
    el.getAttribute('aria-label')?.trim() ||
    el.textContent?.trim() ||
    '';
  return label !== '' && ESCAPE_NAME_PATTERN.test(label);
}

function findEscapeControl(container: HTMLElement): HTMLElement | null {
  const candidates = container.querySelectorAll<HTMLElement>(
    '[data-dismiss], [data-close], button, [role="button"], a[href]',
  );
  for (const candidate of candidates) {
    if (isEscapeControl(candidate)) return candidate;
  }
  return null;
}

function isBackgroundInert(el: HTMLElement): boolean {
  if (el.hasAttribute('inert') || el.closest('[inert]')) return true;
  return Boolean(el.closest('[aria-hidden="true"]'));
}

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
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  if (parseFloat(style.opacity) === 0) return false;

  // Layout-less environments (jsdom, SSR) report no client rects even for
  // visible elements, so an empty rect list is only meaningful when the DOM
  // exposes `checkVisibility`, which signals a real layout engine.
  const element = el as HTMLElement & { checkVisibility?: () => boolean };
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility();
  }
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
  const modalRoots = root.querySelectorAll<HTMLElement>(OVERLAY_CONTAINER_SELECTOR);

  modalRoots.forEach((modal) => {
    const focusable = modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    traps.push({
      containerSelector: describeContainer(modal),
      focusableCount: focusable.length,
      canEscape: findEscapeControl(modal) !== null,
    });
  });

  return traps;
}

/**
 * Audit nested modal / drawer overlay stacks (#874).
 *
 * Reports every overlay container in the document from outermost to
 * innermost with its nesting depth, whether it can be dismissed with Escape,
 * and concrete issues that would trap keyboard users:
 *
 * - `no-escape-control` (error): no close/cancel affordance, so Escape (and
 *   therefore focus recovery) is blocked.
 * - `no-focusable-content` (error): focus can enter an empty overlay and
 *   cannot Tab anywhere.
 * - `background-not-inert` (warning): an `aria-modal` overlay is open while
 *   background content is still tabbable, so Tab leaks out of the dialog.
 * - `focus-restoration-unhinted` (warning): no `data-return-focus` marker,
 *   so closing the overlay may strand focus (not statically verifiable).
 *
 * Invalid input (missing root, non-DOM object) yields a descriptive
 * unsupported result instead of throwing.
 */
export function auditOverlayStacks(root: ParentNode = document): OverlayStackAudit {
  const env = isKeyboardNavigationSupported();
  if (!env.supported) {
    return {
      supported: false,
      unsupportedReason: env.reason,
      containerCount: 0,
      stackDepth: 0,
      entries: [],
      topmost: null,
      errorCount: 0,
      warningCount: 0,
      passed: false,
    };
  }
  if (root === null || root === undefined || typeof (root as ParentNode).querySelectorAll !== 'function') {
    return {
      supported: false,
      unsupportedReason: 'Audit root is missing or does not support querySelectorAll',
      containerCount: 0,
      stackDepth: 0,
      entries: [],
      topmost: null,
      errorCount: 0,
      warningCount: 0,
      passed: false,
    };
  }

  const containers = Array.from(root.querySelectorAll<HTMLElement>(OVERLAY_CONTAINER_SELECTOR));

  const entries: OverlayStackEntry[] = containers.map((container) => {
    const stackPath: string[] = [];
    let depth = 0;
    let ancestor: HTMLElement | null = container.parentElement
      ? (container.parentElement.closest<HTMLElement>(OVERLAY_CONTAINER_SELECTOR))
      : null;
    while (ancestor) {
      stackPath.unshift(describeContainer(ancestor));
      depth += 1;
      ancestor = ancestor.parentElement
        ? (ancestor.parentElement.closest<HTMLElement>(OVERLAY_CONTAINER_SELECTOR))
        : null;
    }
    stackPath.push(describeContainer(container));

    const focusableCount = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR).length;
    const escapeControl = findEscapeControl(container);
    const issues: OverlayTrapIssue[] = [];

    if (focusableCount === 0) {
      issues.push({
        code: 'no-focusable-content',
        message: `Overlay ${describeContainer(container)} contains no focusable elements; keyboard focus can enter but cannot Tab anywhere.`,
        severity: 'error',
      });
    }
    if (!escapeControl) {
      issues.push({
        code: 'no-escape-control',
        message: `Overlay ${describeContainer(container)} has no close/cancel affordance; Escape is blocked for keyboard users.`,
        severity: 'error',
      });
    }
    if (!container.hasAttribute('data-return-focus')) {
      issues.push({
        code: 'focus-restoration-unhinted',
        message: `Overlay ${describeContainer(container)} has no data-return-focus marker; focus restoration after close could not be verified.`,
        severity: 'warning',
      });
    }

    const role =
      container.getAttribute('role') ||
      (container.getAttribute('data-overlay') === 'drawer' || container.hasAttribute('data-drawer')
        ? 'drawer'
        : 'dialog');

    return {
      containerSelector: describeContainer(container),
      role,
      depth,
      stackPath,
      focusableCount,
      hasEscapeControl: escapeControl !== null,
      canEscape: escapeControl !== null,
      trapRisk: 'none',
      issues,
    };
  });

  // Background leak check: when an aria-modal overlay is open, background
  // focusable content should be inert or aria-hidden.
  const topmost = entries.length > 0 ? entries[entries.length - 1] : null;
  const topmostContainer = containers[entries.length - 1] ?? null;
  if (topmost && topmostContainer && topmostContainer.getAttribute('aria-modal') === 'true') {
    const overlaySet = new Set(containers);
    const background = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => {
        const owner = el.closest<HTMLElement>(OVERLAY_CONTAINER_SELECTOR);
        return !owner || !overlaySet.has(owner);
      },
    );
    if (background.length > 0 && background.some((el) => !isBackgroundInert(el))) {
      topmost.issues.push({
        code: 'background-not-inert',
        message: 'A modal overlay is open but background content is still tabbable; apply inert or aria-hidden to page content behind the stack.',
        severity: 'warning',
      });
    }
  }

  let errorCount = 0;
  let warningCount = 0;
  for (const entry of entries) {
    for (const issue of entry.issues) {
      if (issue.severity === 'error') errorCount += 1;
      else warningCount += 1;
    }
    entry.trapRisk = entry.issues.some((i) => i.severity === 'error')
      ? 'high'
      : entry.issues.length > 0
        ? 'low'
        : 'none';
  }

  const stackDepth = entries.reduce((max, entry) => Math.max(max, entry.depth + 1), 0);

  return {
    supported: true,
    containerCount: entries.length,
    stackDepth,
    entries,
    topmost,
    errorCount,
    warningCount,
    passed: errorCount === 0,
  };
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
  const overlayStack = auditOverlayStacks(root);
  const hasSkipLink = Boolean(root.querySelector('.skip-link, [href="#main-content"]'));
  const hasMainLandmark = Boolean(root.querySelector('main, [role="main"], #main-content'));

  const errors = tabOrderIssues.filter((i) => i.severity === 'error');

  return {
    route,
    supported: true,
    focusableCount: focusable.filter((f) => f.isVisible).length,
    tabOrderIssues,
    traps,
    overlayStack,
    hasSkipLink,
    hasMainLandmark,
    passed:
      errors.length === 0 &&
      hasMainLandmark &&
      focusable.filter((f) => f.isVisible).length > 0 &&
      overlayStack.passed,
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
  const totalIssues =
    result.tabOrderIssues.filter((i) => i.severity === 'error').length +
    (result.overlayStack?.errorCount ?? 0);

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
