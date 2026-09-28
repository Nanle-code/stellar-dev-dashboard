import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DASHBOARD_ROUTES,
  auditOverlayStacks,
  auditRouteKeyboardNavigation,
  auditTabOrder,
  detectKeyboardTraps,
  getFocusableElements,
  getNextFocusableElement,
  isKeyboardNavigationSupported,
  validateRouteName,
} from '../../../src/lib/keyboardNavigationAudit';

// The real route registry lazily imports dashboard views; several of those
// files are currently absent from the repository, which breaks any test that
// transitively imports it (#959 follow-up). The audit only reads route ids,
// so a synthetic registry keeps this suite focused on audit behavior.
vi.mock('../../../src/routes/routes', () => ({
  ROUTES: [
    'overview', 'account', 'transactions', 'assets', 'settings', 'builder',
    'contracts', 'dex', 'governance', 'compliance', 'security', 'audit',
    'faucet', 'explorer', 'payments', 'multisig', 'analytics', 'charts',
    'export', 'health', 'monitoring', 'forecast', 'portfolio', 'alerts',
    'flags', 'design', 'story', 'cache', 'performance', 'network',
    'collaboration', 'personalization', 'dependency', 'history',
  ].map((id) => ({ id })),
}));

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

    it('reports canEscape=false without a close affordance and detects drawers', () => {
      buildDom(`
        <div role="dialog" id="nameless-modal">
          <input aria-label="Username" type="text" />
        </div>
        <aside data-overlay="drawer" id="nav-drawer" aria-modal="true">
          <a href="#home">Home</a>
          <button data-dismiss>×</button>
        </aside>
      `);

      const traps = detectKeyboardTraps(document);
      expect(traps).toHaveLength(2);
      const modal = traps.find((t) => t.containerSelector === '#nameless-modal');
      const drawer = traps.find((t) => t.containerSelector === '#nav-drawer');
      expect(modal?.canEscape).toBe(false);
      expect(drawer?.canEscape).toBe(true);
    });
  });

  describe('auditOverlayStacks (#874)', () => {
    it('audits a nested modal/drawer stack from outermost to innermost (primary flow)', () => {
      buildDom(`
        <main id="page"><button aria-label="Background">Bg</button></main>
        <div role="dialog" id="outer" aria-modal="true" data-return-focus>
          <button aria-label="Close outer" data-dismiss>Close</button>
          <button id="open-inner" aria-label="Open settings">Settings</button>
          <div role="dialog" id="inner" aria-modal="true" data-return-focus>
            <button aria-label="Close inner" data-dismiss>Close</button>
            <input aria-label="Value" type="text" />
          </div>
        </div>
      `);

      const audit = auditOverlayStacks(document);
      expect(audit.supported).toBe(true);
      expect(audit.containerCount).toBe(2);
      expect(audit.stackDepth).toBe(2);

      const outer = audit.entries.find((e) => e.containerSelector === '#outer');
      const inner = audit.entries.find((e) => e.containerSelector === '#inner');
      expect(outer?.depth).toBe(0);
      expect(outer?.stackPath).toEqual(['#outer']);
      expect(inner?.depth).toBe(1);
      expect(inner?.stackPath).toEqual(['#outer', '#inner']);
      expect(inner?.issues.some((i) => i.code === 'background-not-inert')).toBe(true);
      expect(audit.topmost?.containerSelector).toBe('#inner');
      expect(audit.errorCount).toBe(0);
      // The only warning is the background-tabbability leak asserted below.
      expect(audit.warningCount).toBe(1);
      expect(audit.passed).toBe(true);
    });

    it('flags background tabbability leaks for modal overlays', () => {
      buildDom(`
        <main id="page"><button aria-label="Background">Bg</button></main>
        <div role="dialog" id="modal" aria-modal="true" data-return-focus>
          <button aria-label="Close" data-dismiss>Close</button>
        </div>
      `);

      const audit = auditOverlayStacks(document);
      const modal = audit.entries.find((e) => e.containerSelector === '#modal');
      expect(modal?.issues.some((i) => i.code === 'background-not-inert')).toBe(true);
      expect(audit.passed).toBe(true); // warning only
      expect(audit.warningCount).toBeGreaterThan(0);
    });

    it('passes when background content is inert behind a modal (boundary)', () => {
      buildDom(`
        <main id="page" inert><button aria-label="Background">Bg</button></main>
        <div role="dialog" id="modal" aria-modal="true" data-return-focus>
          <button aria-label="Close" data-dismiss>Close</button>
        </div>
      `);

      const audit = auditOverlayStacks(document);
      const modal = audit.entries.find((e) => e.containerSelector === '#modal');
      expect(modal?.issues.some((i) => i.code === 'background-not-inert')).toBe(false);
      expect(audit.passed).toBe(true);
    });

    it('reports an empty overlay stack', () => {
      buildDom(`<main id="page"><button aria-label="Plain">Plain</button></main>`);
      const audit = auditOverlayStacks(document);
      expect(audit.containerCount).toBe(0);
      expect(audit.stackDepth).toBe(0);
      expect(audit.entries).toEqual([]);
      expect(audit.topmost).toBeNull();
      expect(audit.passed).toBe(true);
    });

    it('errors on an overlay without escape control or focusables (failure path)', () => {
      buildDom(`
        <div role="dialog" id="trapped" aria-modal="true" data-return-focus></div>
      `);

      const audit = auditOverlayStacks(document);
      expect(audit.passed).toBe(false);
      expect(audit.errorCount).toBe(2);
      const entry = audit.entries[0];
      expect(entry?.trapRisk).toBe('high');
      expect(entry?.issues.map((i) => i.code).sort()).toEqual(
        ['no-escape-control', 'no-focusable-content'],
      );
    });

    it('returns an unsupported result for invalid roots (failure path)', () => {
      const result = auditOverlayStacks(null as unknown as Parameters<typeof auditOverlayStacks>[0]);
      expect(result.supported).toBe(false);
      expect(result.unsupportedReason).toMatch(/missing or does not support/i);
      expect(result.passed).toBe(false);
      expect(result.entries).toEqual([]);
    });

    it('does not treat drawer backdrop class names as overlays (boundary)', () => {
      buildDom(`
        <div class="mobile-drawer-backdrop open"></div>
        <aside role="dialog" id="real-drawer" aria-modal="true" data-return-focus>
          <button data-dismiss aria-label="Close">Close</button>
          <a href="#home">Home</a>
        </aside>
      `);

      const audit = auditOverlayStacks(document);
      expect(audit.containerCount).toBe(1);
      expect(audit.entries[0]?.containerSelector).toBe('#real-drawer');
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

    it('fails the route when a nested overlay traps Escape (#874)', () => {
      buildDom(`
        <main id="main-content">
          <button aria-label="Open">Open</button>
          <div role="dialog" id="trapped" aria-modal="true">
            <input aria-label="Value" type="text" />
          </div>
        </main>
      `);

      const result = auditRouteKeyboardNavigation('overview', document);
      expect(result.overlayStack?.passed).toBe(false);
      expect(result.overlayStack?.errorCount).toBe(1);
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
