import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  auditWcag22Workflow,
  WCAG_22_AA_TAGS,
  CORE_DEVELOPER_WORKFLOWS,
} from '../../src/lib/accessibilityAudit';

describe('WCAG 2.2 AA Workflow Accessibility Tests', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-workflow-root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  describe('Primary Flows', () => {
    it('defines WCAG 2.2 AA tags including wcag22a and wcag22aa', () => {
      expect(WCAG_22_AA_TAGS).toContain('wcag22a');
      expect(WCAG_22_AA_TAGS).toContain('wcag22aa');
      expect(CORE_DEVELOPER_WORKFLOWS).toEqual(['account', 'transactions', 'contracts']);
    });

    it('passes audit for compliant account workflow DOM', () => {
      container.innerHTML = `
        <main id="main-content">
          <h1>Account Overview</h1>
          <form>
            <label for="account-address-input">Stellar Account Address</label>
            <input id="account-address-input" style="min-width: 200px; min-height: 38px;" />
            <button type="submit" style="min-width: 44px; min-height: 36px;">Load Account</button>
          </form>
        </main>
      `;

      // Mock getBoundingClientRect for interactive elements
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 44,
        height: 36,
        top: 0,
        left: 0,
        bottom: 36,
        right: 44,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const result = auditWcag22Workflow('account', container);
      expect(result.environmentSupported).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.checkedCount).toBeGreaterThan(0);
    });

    it('passes audit for compliant transactions workflow DOM with tablist and filters', () => {
      container.innerHTML = `
        <div>
          <h1>Transactions & Operations</h1>
          <div role="tablist" aria-label="Views">
            <button role="tab" id="tab-tx" aria-selected="true" aria-controls="panel-tx" style="min-height: 36px; min-width: 44px;">Transactions</button>
            <button role="tab" id="tab-ops" aria-selected="false" aria-controls="panel-ops" style="min-height: 36px; min-width: 44px;">Operations</button>
          </div>
          <div role="tabpanel" id="panel-tx" aria-labelledby="tab-tx">
            <label for="search-tx" class="sr-only">Search</label>
            <input id="search-tx" style="min-height: 38px; min-width: 100px;" />
          </div>
        </div>
      `;

      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 50,
        height: 38,
        top: 0,
        left: 0,
        bottom: 38,
        right: 50,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const result = auditWcag22Workflow('transactions', container);
      expect(result.environmentSupported).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('passes audit for compliant contracts workflow with accessible authentication paste support', () => {
      container.innerHTML = `
        <div>
          <h1>Soroban Contracts</h1>
          <label for="inspect-contract-input">Contract Address</label>
          <input id="inspect-contract-input" style="min-height: 38px; min-width: 280px;" />
          <label for="invoke-secret-key">Secret Key</label>
          <input id="invoke-secret-key" type="password" autocomplete="current-password" style="min-height: 38px; user-select: text;" />
          <button style="min-height: 36px; min-width: 44px;">Simulate</button>
        </div>
      `;

      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 100,
        height: 38,
        top: 0,
        left: 0,
        bottom: 38,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const result = auditWcag22Workflow('contracts', container);
      expect(result.environmentSupported).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe('Boundary Cases (WCAG 2.2 Specific)', () => {
    it('boundary SC 2.5.8: allows target size exactly 24x24 px', () => {
      container.innerHTML = `<button id="btn-exact" style="width: 24px; height: 24px;">✓</button>`;
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 24,
        height: 24,
        top: 0,
        left: 0,
        bottom: 24,
        right: 24,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const result = auditWcag22Workflow('contracts', container);
      expect(result.passed).toBe(true);
      expect(result.issues.filter(i => i.criterion === '2.5.8')).toHaveLength(0);
    });

    it('boundary SC 2.5.8: flags interactive target below 24x24 px (e.g. 23x23 px)', () => {
      container.innerHTML = `<button id="btn-too-small" style="width: 23px; height: 23px;">x</button>`;
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 23,
        height: 23,
        top: 0,
        left: 0,
        bottom: 23,
        right: 23,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const result = auditWcag22Workflow('contracts', container);
      expect(result.passed).toBe(false);
      const targetSizeIssue = result.issues.find(i => i.criterion === '2.5.8');
      expect(targetSizeIssue).toBeDefined();
      expect(targetSizeIssue?.description).toContain('minimum 24x24px required');
    });

    it('boundary SC 3.3.8: accessible authentication flags input blocking user-select / paste', () => {
      container.innerHTML = `
        <label for="secret-blocked">Secret</label>
        <input id="secret-blocked" type="password" style="user-select: none;" />
      `;

      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 40,
        top: 0,
        left: 0,
        bottom: 40,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      // Mock getComputedStyle for userSelect: none
      vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
        const defaultStyle = {
          display: 'block',
          visibility: 'visible',
          userSelect: el.id === 'secret-blocked' ? 'none' : 'text',
          outlineStyle: 'solid',
          outlineWidth: '2px',
        };
        return defaultStyle as any;
      });

      const result = auditWcag22Workflow('contracts', container);
      expect(result.passed).toBe(false);
      const authIssue = result.issues.find(i => i.criterion === '3.3.8');
      expect(authIssue).toBeDefined();
      expect(authIssue?.description).toContain('disables user selection / pasting');
    });
  });

  describe('Failure Paths & Invalid Input Handling', () => {
    it('failure SC 3.3.1: flags aria-invalid="true" without aria-describedby', () => {
      container.innerHTML = `
        <label for="account-error-input">Account</label>
        <input id="account-error-input" aria-invalid="true" style="width: 200px; height: 40px;" />
      `;

      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 40,
        top: 0,
        left: 0,
        bottom: 40,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const result = auditWcag22Workflow('account', container);
      expect(result.passed).toBe(false);
      const errorIssue = result.issues.find(i => i.criterion === '3.3.1');
      expect(errorIssue).toBeDefined();
      expect(errorIssue?.description).toContain('missing aria-describedby');
    });

    it('failure SC 3.3.1: flags aria-describedby pointing to missing or empty error element', () => {
      container.innerHTML = `
        <label for="contract-input">Contract</label>
        <input id="contract-input" aria-invalid="true" aria-describedby="non-existent-error" style="width: 200px; height: 40px;" />
      `;

      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 40,
        top: 0,
        left: 0,
        bottom: 40,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const result = auditWcag22Workflow('contracts', container);
      expect(result.passed).toBe(false);
      const errorIssue = result.issues.find(i => i.criterion === '3.3.1');
      expect(errorIssue).toBeDefined();
      expect(errorIssue?.description).toContain('does not contain error text');
    });

    it('handles invalid workflow names gracefully', () => {
      const result = auditWcag22Workflow('', container);
      expect(result.passed).toBe(false);
      expect(result.unsupportedReason).toContain('empty or invalid');
    });

    it('handles missing root container gracefully', () => {
      const result = auditWcag22Workflow('account', null);
      // Fallback to #main-content or document.body if present in jsdom
      expect(result.environmentSupported).toBe(true);
    });
  });
});
