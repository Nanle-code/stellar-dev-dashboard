import { test, expect, type Page } from '@playwright/test';

/**
 * Demo mode E2E (#875).
 *
 * Runs entirely against the bundled fixtures: Horizon and price requests are
 * aborted so the test fails loudly if "Try demo" ever depends on the network.
 */

async function blockExternalNetwork(page: Page) {
  await page.route('**/horizon**.stellar.org/**', (route) => route.abort());
  await page.route('**/friendbot**', (route) => route.abort());
  await page.route('**/api/v3/simple/price*', (route) => route.abort());
}

test.describe('Try demo mode (#875)', () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalNetwork(page);
    await page.addInitScript(() => {
      localStorage.setItem('hasCompletedOnboarding', 'true');
      localStorage.setItem('stellar-dashboard-theme', 'dark');
    });
  });

  test('primary flow: one click loads a populated, labeled dashboard without a wallet', async ({
    page,
  }) => {
    await page.goto('/connect');

    const tryDemo = page.getByTestId('try-demo-button');
    await expect(tryDemo).toBeVisible();
    await tryDemo.click();

    // Demo mode exits the connect flow into the Overview.
    await expect(page).toHaveURL(/\/overview/, { timeout: 15000 });

    // Clearly labeled as a read-only demo.
    const banner = page.getByTestId('demo-mode-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/read-only demo/i);
    await expect(banner).toContainText(/demo mode/i);

    // Populated with curated fixture data (no wallet, no network).
    await expect(page.getByText('Dashboard Overview')).toBeVisible();
    await expect(page.getByText('4,820.50').first()).toBeVisible();
    await expect(page.getByText(/USDC/).first()).toBeVisible();

    // Store reflects a read-only demo session on testnet.
    const demoState = await page.evaluate(() => {
      const store = (window as any).__store;
      const state = store?.getState?.();
      return {
        isDemoMode: state?.isDemoMode ?? false,
        network: state?.network ?? null,
        connectedAddress: state?.connectedAddress ?? null,
        transactionCount: state?.transactions?.length ?? 0,
        operationCount: state?.operations?.length ?? 0,
      };
    });

    expect(demoState.isDemoMode).toBe(true);
    expect(demoState.network).toBe('testnet');
    expect(demoState.connectedAddress).toMatch(/^G[A-Z2-7]{55}$/);
    expect(demoState.transactionCount).toBeGreaterThan(0);
    expect(demoState.operationCount).toBeGreaterThan(0);
  });

  test('boundary case: right after entering demo, the fixture history is already populated', async ({
    page,
  }) => {
    await page.goto('/connect');
    await page.getByTestId('try-demo-button').click();
    await expect(page).toHaveURL(/\/overview/, { timeout: 15000 });

    // Fixture transactions render immediately without a loading spinner or a
    // network round-trip.
    const firstTxHash = await page.evaluate(() => {
      const store = (window as any).__store;
      return store?.getState?.()?.transactions?.[0]?.hash ?? null;
    });
    expect(firstTxHash).toBeTruthy();

    await expect(page.getByText(/Recent Transactions/i).first()).toBeVisible();
    const bodyText = await page.locator('#main-content').innerText();
    expect(bodyText).toContain(firstTxHash);
  });

  test('failure case: exiting demo returns cleanly to the normal connect flow', async ({ page }) => {
    await page.goto('/connect');
    await page.getByTestId('try-demo-button').click();
    await expect(page.getByTestId('demo-mode-banner')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('exit-demo-button').click();

    await expect(page).toHaveURL(/\/connect/, { timeout: 15000 });
    await expect(page.getByTestId('demo-mode-banner')).not.toBeVisible();
    await expect(page.getByLabel(/stellar account address/i)).toBeVisible();

    const demoState = await page.evaluate(() => {
      const store = (window as any).__store;
      const state = store?.getState?.();
      return {
        isDemoMode: state?.isDemoMode ?? false,
        connectedAddress: state?.connectedAddress ?? null,
      };
    });

    expect(demoState.isDemoMode).toBe(false);
    expect(demoState.connectedAddress).toBeNull();
  });
});
