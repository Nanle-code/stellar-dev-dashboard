import { test, expect } from '@playwright/test';

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads the dashboard and shows sidebar', async ({ page }) => {
    await expect(page.locator('text=STELLAR')).toBeVisible();
    await expect(page.locator('text=DEV DASHBOARD')).toBeVisible();
  });

  test('network toggle switches between testnet and mainnet', async ({ page }) => {
    const mainBtn = page.locator('button', { hasText: 'Main' });
    await mainBtn.click();
    await expect(mainBtn).toHaveCSS('color', /0, 229, 255/);
  });

  test('unauthenticated user visiting /transactions is redirected to /connect', async ({ page }) => {
    await page.goto('/transactions');
    await expect(page).toHaveURL(/\/connect/);
  });

  test('unauthenticated user visiting /overview is redirected to /connect', async ({ page }) => {
    await page.goto('/overview');
    await expect(page).toHaveURL(/\/connect/);
  });

  test('unauthenticated user visiting /contracts is redirected to /connect', async ({ page }) => {
    await page.goto('/contracts');
    await expect(page).toHaveURL(/\/connect/);
  });
});

test.describe('Authenticated navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const store = window.__store;
      if (store) {
        store.getState().setConnectedAddress('GA2C5W4Q5X5Q5X5Q5X5Q5X5Q5X5Q5X5Q5X5Q5X5Q5X5Q5X5Q5X5Q5X5');
      }
    });
  });

  test('sidebar click on Transactions updates URL to /transactions', async ({ page }) => {
    await page.locator('aside button', { hasText: 'Transactions' }).click();
    await expect(page).toHaveURL(/\/transactions/);
  });

  test('sidebar click on Overview updates URL to /overview', async ({ page }) => {
    await page.locator('aside button', { hasText: 'Overview' }).click();
    await expect(page).toHaveURL(/\/overview/);
  });

  test('sidebar click on Contracts updates URL to /contracts', async ({ page }) => {
    await page.locator('aside button', { hasText: 'Contracts' }).click();
    await expect(page).toHaveURL(/\/contracts/);
  });

  test('sidebar click on Assets updates URL to /assets', async ({ page }) => {
    await page.locator('aside button', { hasText: 'Assets' }).click();
    await expect(page).toHaveURL(/\/assets/);
  });

  test('sidebar click on Charts updates URL to /charts', async ({ page }) => {
    await page.locator('aside button', { hasText: 'Charts' }).click();
    await expect(page).toHaveURL(/\/charts/);
  });

  test('browser back/forward updates active tab', async ({ page }) => {
    await page.locator('aside button', { hasText: 'Contracts' }).click();
    await expect(page).toHaveURL(/\/contracts/);

    await page.locator('aside button', { hasText: 'Assets' }).click();
    await expect(page).toHaveURL(/\/assets/);

    await page.goBack();
    await expect(page).toHaveURL(/\/contracts/);

    await page.goBack();
    await expect(page).toHaveURL(/\/overview/);

    await page.goForward();
    await expect(page).toHaveURL(/\/contracts/);
  });

  test('direct navigation to /contracts renders contracts panel when connected', async ({ page }) => {
    await page.goto('/contracts');
    await expect(page).toHaveURL(/\/contracts/);
    await expect(page.locator('text=Contracts')).toBeVisible();
  });

  test('direct navigation to /search renders search panel when connected', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveURL(/\/search/);
  });
});
