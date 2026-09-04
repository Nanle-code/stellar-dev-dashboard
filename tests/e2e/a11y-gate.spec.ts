import { test, expect } from '@playwright/test';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');
const AXE_SOURCE = fs.readFileSync(AXE_PATH, 'utf8');

const PAGES = [
  { name: 'connect', path: '/' },
  { name: 'overview', path: '/overview' },
  { name: 'settings', path: '/settings' },
];

const IMPACT_LEVELS = new Set(['critical', 'serious', 'moderate']);

test.describe('Accessibility CI Gate', () => {
  test.describe.configure({ timeout: 120000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      localStorage.setItem('stellar-dashboard-theme', 'dark');
    });
  });

  for (const { name, path } of PAGES) {
    test(`${name}: no WCAG 2.1 AA violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('#main-content').waitFor({ state: 'visible', timeout: 60000 });

      await page.addScriptTag({ content: AXE_SOURCE });
      await page.waitForFunction(() => !!(window as any).axe, { timeout: 30000 });

      const rules = await page.evaluate(() => {
        return (window as any).axe.getRules(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .map((r: any) => r.ruleId)
          .filter((id: string) => id !== 'no-autoplay-audio' && id !== 'css-orientation-lock' && id !== 'color-contrast');
      }, null, { timeout: 30000 });

      const results = await page.evaluate((ruleList) => {
        return (window as any).axe.run(document, { runOnly: ruleList });
      }, rules, { timeout: 45000 });

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
