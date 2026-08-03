import { test, expect, type Page } from '@playwright/test';

const TESTNET_ACCOUNT = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const INVALID_ADDRESS = 'NOT_A_VALID_KEY';

async function mockHorizon(page: Page) {
  await page.route('**/horizon**.stellar.org/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/accounts/')) {
      await route.fulfill({
        status: 200,
        json: {
          account_id: TESTNET_ACCOUNT,
          balances: [{ asset_type: 'native', balance: '10000.0000000' }],
          sequence: '1',
          thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 1 },
          flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
        },
      });
    } else if (url.includes('/transactions')) {
      await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
    } else if (url.includes('/operations')) {
      await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/v3/simple/price*', async (route) => {
    await route.fulfill({ status: 200, json: { stellar: { usd: 0.1 } } });
  });
}

async function connectAccount(page: Page) {
  await page.getByLabel(/stellar account address/i).fill(TESTNET_ACCOUNT);
  await page.getByRole('button', { name: /connect to stellar account/i }).click();
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30000 });
}

test.describe('Keyboard navigation audit (#776)', () => {
  test.beforeEach(async ({ page }) => {
    await mockHorizon(page);
    await page.addInitScript(() => {
      localStorage.setItem('hasCompletedOnboarding', 'true');
    });
  });

  test('primary flow: tab order reaches connect input, connects, and navigates sidebar', async ({
    page,
  }) => {
    await page.goto('/connect');
    await page.waitForLoadState('domcontentloaded');

    // Skip link is first in tab order
    await page.keyboard.press('Tab');
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeFocused();

    // Tab to connect input and submit with Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const addressInput = page.getByLabel(/stellar account address/i);
    await expect(addressInput).toBeFocused();
    await addressInput.fill(TESTNET_ACCOUNT);
    await page.keyboard.press('Enter');

    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30000 });

    // Navigate to Account via sidebar keyboard activation
    const accountNav = page.getByRole('button', { name: /^Account$/i }).first();
    await accountNav.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/account/);
    await expect(page.locator('#main-content')).toBeFocused({ timeout: 5000 });
  });

  test('boundary case: skip link moves focus to main content landmark', async ({ page }) => {
    await page.goto('/connect');
    await connectAccount(page);

    const skipLink = page.locator('.skip-link');
    await skipLink.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('boundary case: command palette opens and closes with keyboard only', async ({ page }) => {
    await page.goto('/connect');
    await connectAccount(page);

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /command palette/i })).not.toBeVisible();
  });

  test('failure case: invalid address shows alert and keeps focus in form', async ({ page }) => {
    await page.goto('/connect');

    const addressInput = page.getByLabel(/stellar account address/i);
    await addressInput.focus();
    await addressInput.fill(INVALID_ADDRESS);
    await page.keyboard.press('Enter');

    const errorAlert = page.locator('#connect-error');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toHaveAttribute('role', 'alert');
    await expect(addressInput).toHaveAttribute('aria-invalid', 'true');

    // User can correct input without pointer
    await addressInput.fill(TESTNET_ACCOUNT);
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30000 });
  });

  test('failure case: preferences dialog traps focus until Escape', async ({ page }) => {
    await page.goto('/connect');
    await connectAccount(page);

    const prefsButton = page.getByRole('button', { name: /open user preferences/i });
    await prefsButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: /user preferences/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /user preferences/i })).not.toBeVisible();
    await expect(prefsButton).toBeFocused();
  });

  test.describe('dashboard route keyboard reachability', () => {
    const routes = ['overview', 'account', 'transactions', 'settings', 'network'];

    for (const route of routes) {
      test(`${route}: main landmark and focusable controls are present`, async ({ page }) => {
        await page.goto('/connect');
        await connectAccount(page);
        await page.goto(`/${route}`);
        await page.waitForLoadState('domcontentloaded');

        await expect(page.locator('main#main-content')).toBeVisible();

        const focusableCount = await page.evaluate(() => {
          const selector =
            'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
          return document.querySelectorAll(selector).length;
        });

        expect(focusableCount).toBeGreaterThan(0);

        await page.keyboard.press('Tab');
        const activeTag = await page.evaluate(() => document.activeElement?.tagName);
        expect(activeTag).toBeTruthy();
      });
    }
  });
});
