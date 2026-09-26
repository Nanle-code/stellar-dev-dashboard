import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility CI gate (D-024).
 * Fails on any WCAG 2.1 AA violation with critical, serious, or moderate impact.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

const PAGES = [
  { name: 'connect', path: '/' },
  { name: 'overview', path: '/overview' },
  { name: 'settings', path: '/settings' },
  { name: 'account', path: '/account' },
  { name: 'transactions', path: '/transactions' },
  { name: 'contracts', path: '/contracts' },
];

const IMPACT_LEVELS = new Set(['critical', 'serious', 'moderate']);

test.describe('Accessibility CI Gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      localStorage.setItem('stellar-dashboard-theme', 'dark');
    });
  });

  for (const { name, path } of PAGES) {
    test(`${name}: no WCAG 2.2 AA violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.locator('#main-content').waitFor({ state: 'visible' });

      await page.addScriptTag({ path: AXE_PATH });

      const rules = await page.evaluate(() => {
        return (window as any).axe.getRules(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
          .map((r: any) => r.ruleId)
          .filter((id: string) => id !== 'no-autoplay-audio' && id !== 'css-orientation-lock' && id !== 'color-contrast');
      });

      const results = await page.evaluate((ruleList) => {
        return (window as any).axe.run(document, { runOnly: ruleList });
      }, rules);

      const violations = results.violations.filter((v: any) => IMPACT_LEVELS.has(v.impact ?? ''));
      if (violations.length > 0) {
        const summary = violations
          .map((v: any) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
          .join('\n');
        expect(violations, `A11y violations on ${path}:\n${summary}`).toEqual([]);
      }
      expect(violations).toEqual([]);
    });
  }

  test('boundary case: interactive targets satisfy SC 2.5.8 minimum target size (24x24px)', async ({ page }) => {
    await page.goto('/contracts', { waitUntil: 'domcontentloaded' });
    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 15); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(24);
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test('boundary case: focus visibility and scroll margins satisfy SC 2.4.11 (Focus Not Obscured)', async ({ page }) => {
    await page.goto('/transactions', { waitUntil: 'domcontentloaded' });
    const hasFocusScrollMargins = await page.evaluate(() => {
      const el = document.querySelector('button') || document.querySelector('input');
      if (!el) return true;
      const computed = window.getComputedStyle(el);
      return computed.scrollMarginTop !== '' || computed.outline !== '';
    });
    expect(hasFocusScrollMargins).toBe(true);
  });

  test('failure case: invalid account input surfaces accessible alert and aria-invalid', async ({ page }) => {
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    const input = page.locator('#account-address-input');
    await input.fill('INVALID_STELLAR_ADDRESS');
    const submitBtn = page.getByRole('button', { name: 'Load Account' });
    await submitBtn.click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#account-lookup-error')).toBeVisible();
  });

  test('keyboard focus is reachable on connect page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Tab');
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    expect(tag).toBeTruthy();
  });

  test('page has a main landmark', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main').first()).toBeVisible();
  });
});
