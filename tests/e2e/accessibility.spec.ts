import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('homepage should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/');
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag21aa'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
  
  test('keyboard navigation works properly', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const activeElement = await page.evaluate(() => document.activeElement);
    expect(activeElement).not.toBeNull();
  });
});
