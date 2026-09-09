import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DASHBOARD_ROUTES,
  auditRouteKeyboardNavigation,
  auditTabOrder,
  detectKeyboardTraps,
  getFocusableElements,
  getNextFocusableElement,
  isKeyboardNavigationSupported,
  validateRouteName,
} from '../../../src/lib/keyboardNavigationAudit';

function buildDom(html: string) {
  document.body.innerHTML = html;
}

describe('keyboardNavigationAudit', () => {
  beforeEach(() => {
    buildDom('');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('isKeyboardNavigationSupported', () => {
    it('reports supported in jsdom', () => {
      expect(isKeyboardNavigationSupported()).toEqual({ supported: true });
    });
  });

  describe('validateRouteName', () => {
    it('accepts known dashboard routes', () => {
      expect(validateRouteName('overview')).toBe(true);
      expect(validateRouteName('settings')).toBe(true);
    });

    it('rejects invalid route names', () => {
      expect(validateRouteName('not-a-route')).toBe(false);
      expect(validateRouteName('')).toBe(false);
    });
  });

  describe('getFocusableElements', () => {
    it('finds visible interactive elements in logical DOM order', () => {
      buildDom(`
        <main id="main-content">
          <a href="#main-content" class="skip-link">Skip to content</a>
          <button aria-label="Overview">Overview</button>
          <input aria-label="Search" type="text" />
        </main>
      `);

      const elements = getFocusableElements(document);
      expect(elements.length).toBeGreaterThanOrEqual(3);
      expect(elements[0]?.tagName).toBe('a');
    });
  });

  describe('auditTabOrder', () => {
    it('flags icon-only buttons missing accessible names', () => {
      buildDom(`
        <main>
          <button></button>
          <button aria-label="Settings">⚙</button>
        </main>
      `);

      const issues = auditTabOrder(document);
      expect(issues.some((i) => i.reason === 'no-accessible-name')).toBe(true);
    });
  });

  describe('detectKeyboardTraps', () => {
    it('identifies modal containers with focusable content', () => {
      buildDom(`
        <div role="dialog" aria-modal="true" id="prefs-modal">
          <button aria-label="Close">Close</button>
          <input aria-label="Username" type="text" />
        </div>
      `);

      const traps = detectKeyboardTraps(document);
      expect(traps).toHaveLength(1);
      expect(traps[0]?.focusableCount).toBe(2);
      expect(traps[0]?.canEscape).toBe(true);
    });
  });

  describe('auditRouteKeyboardNavigation', () => {
    it('passes a well-formed dashboard layout', () => {
      buildDom(`
        <a href="#main-content" class="skip-link">Skip to main content</a>
        <nav aria-label="Main navigation">
          <button aria-label="Overview">Overview</button>
        </nav>
        <main id="main-content" tabindex="-1">
          <button aria-label="Connect account">Connect</button>
        </main>
      `);

      const result = auditRouteKeyboardNavigation('connect', document);
      expect(result.supported).toBe(true);
      expect(result.hasSkipLink).toBe(true);
      expect(result.hasMainLandmark).toBe(true);
      expect(result.passed).toBe(true);
    });

    it('fails for invalid empty route input', () => {
      const result = auditRouteKeyboardNavigation('   ', document);
      expect(result.supported).toBe(false);
      expect(result.unsupportedReason).toMatch(/invalid/i);
      expect(result.passed).toBe(false);
    });

    it('fails when main landmark is missing', () => {
      buildDom(`<button aria-label="Only control">Go</button>`);
      const result = auditRouteKeyboardNavigation('overview', document);
      expect(result.hasMainLandmark).toBe(false);
      expect(result.passed).toBe(false);
    });
  });

  describe('getNextFocusableElement', () => {
    it('cycles forward through focusable elements', () => {
      buildDom(`
        <main>
          <button id="first" aria-label="First">First</button>
          <button id="second" aria-label="Second">Second</button>
        </main>
      `);

      const first = document.getElementById('first') as HTMLButtonElement;
      first.focus();

      const next = getNextFocusableElement(document);
      expect(next?.id).toBe('second');
    });
  });

  describe('DASHBOARD_ROUTES', () => {
    it('includes connect and core dashboard tabs', () => {
      expect(DASHBOARD_ROUTES).toContain('connect');
      expect(DASHBOARD_ROUTES).toContain('overview');
      expect(DASHBOARD_ROUTES).toContain('settings');
      expect(DASHBOARD_ROUTES.length).toBeGreaterThan(30);
    });
  });
});
