import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility CI gate (D-024).
 * Fails on any WCAG 2.1 AA violation with critical, serious, or moderate impact.
 */

const PAGES = [
  { name: 'connect', path: '/' },
  { name: 'overview', path: '/overview' },
  { name: 'settings', path: '/settings' },
];

const IMPACT_LEVELS = new Set(['critical', 'serious', 'moderate']);

test.describe('Accessibility CI Gate', () => {
  for (const { name, path } of PAGES) {
    test(`${name}: no WCAG 2.1 AA violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = results.violations.filter((v) => IMPACT_LEVELS.has(v.impact ?? ''));
      if (violations.length > 0) {
        const summary = violations
          .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
          .join('\n');
        expect(violations, `A11y violations on ${path}:\n${summary}`).toEqual([]);
      }
    });
  }

  test('keyboard focus is reachable on connect page', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    expect(tag).toBeTruthy();
  });

  test('page has a main landmark', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
  });
});
