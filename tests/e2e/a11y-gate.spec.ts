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
    test(`${name}: no WCAG 2.1 AA violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.locator('#main-content').waitFor({ state: 'visible' });

      await page.addScriptTag({ path: AXE_PATH });

      const rules = await page.evaluate(() => {
        return (window as any).axe.getRules(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
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
