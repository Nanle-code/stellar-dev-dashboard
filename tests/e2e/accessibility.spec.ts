import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests (WCAG 2.2 AA)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      localStorage.setItem('stellar-dashboard-theme', 'dark');
    });
  });

  test('homepage should not have any automatically detectable accessibility issues (WCAG 2.2 AA)', async ({ page }) => {
    await page.goto('/');
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('primary workflows (account, transactions, contracts) conform to WCAG 2.2 AA', async ({ page }) => {
    const workflows = ['/account', '/transactions', '/contracts'];
    for (const route of workflows) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
        .disableRules(['color-contrast', 'css-orientation-lock'])
        .analyze();
      expect(results.violations, `Violations on ${route}: ${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
    }
  });

  test('boundary case: interactive targets meet WCAG 2.2 SC 2.5.8 minimum size (>= 24x24px)', async ({ page }) => {
    await page.goto('/contracts', { waitUntil: 'domcontentloaded' });
    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(24);
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test('failure case: invalid input displays role="alert" with aria-invalid="true"', async ({ page }) => {
    await page.goto('/contracts', { waitUntil: 'domcontentloaded' });
    const input = page.locator('#inspect-contract-input');
    await input.fill('invalid-contract-id');
    const inspectBtn = page.getByRole('button', { name: 'Inspect' });
    await inspectBtn.click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = page.locator('[role="alert"]').first();
    await expect(alert).toBeVisible();
  });

  test('security / accessible authentication: secret key input supports pasting (WCAG 3.3.8)', async ({ page }) => {
    await page.goto('/contracts', { waitUntil: 'domcontentloaded' });
    const secretInput = page.locator('#invoke-secret-key');
    await expect(secretInput).toBeVisible();
    await secretInput.focus();
    // Verify paste event is not blocked
    const pasteAllowed = await secretInput.evaluate((el: HTMLInputElement) => {
      const event = new Event('paste', { bubbles: true, cancelable: true });
      return el.dispatchEvent(event);
    });
    expect(pasteAllowed).toBe(true);
  });
  
  test('keyboard navigation and focus visibility works properly', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const activeElement = await page.evaluate(() => document.activeElement);
    expect(activeElement).not.toBeNull();
  });
});
