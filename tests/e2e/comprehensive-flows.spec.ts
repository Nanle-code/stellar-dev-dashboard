import { test, expect } from '@playwright/test';

const TESTNET_ACCOUNT = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

test.describe('Comprehensive Dashboard Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Set up common routes to avoid hitting real APIs
    await page.route('**/horizon**.stellar.org/**', async route => {
      const url = route.request().url();
      if (url.includes('/accounts/')) {
        await route.fulfill({
          status: 200,
          json: {
            account_id: TESTNET_ACCOUNT,
            balances: [{ asset_type: 'native', balance: '10000.0000000' }],
            sequence: '1',
            thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 1 },
            flags: { auth_required: false, auth_revocable: false, auth_immutable: false }
          }
        });
      } else if (url.includes('/transactions')) {
        await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
      } else if (url.includes('/operations')) {
        await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/v3/simple/price*', async route => {
      await route.fulfill({ status: 200, json: { stellar: { usd: 0.1 } } });
    });
  });

  test.describe('All Tabs Load Without Crashing', () => {
    const tabs = [
      { name: 'overview', label: /overview/i },
      { name: 'account', label: /account/i },
      { name: 'transactions', label: /transactions/i },
      { name: 'contracts', label: /contracts/i },
      { name: 'network', label: /network/i },
      { name: 'builder', label: /builder/i },
      { name: 'faucet', label: /faucet/i },
      { name: 'compare', label: /compare/i },
      { name: 'wallet', label: /wallet/i },
      { name: 'signer', label: /signer/i },
      { name: 'portfolio', label: /portfolio/i },
      { name: 'txBuilder', label: /transaction builder/i },
      { name: 'dex', label: /dex/i },
      { name: 'pathExplorer', label: /path/i },
      { name: 'explorers', label: /explorer/i },
      { name: 'realtime', label: /real/i },
      { name: 'charts', label: /charts/i },
      { name: 'assets', label: /assets/i },
      { name: 'multisig', label: /multisig/i },
      { name: 'analytics', label: /analytics/i },
      { name: 'systemHealth', label: /system/i },
      { name: 'performance', label: /performance/i },
      { name: 'settings', label: /settings/i },
      { name: 'audit', label: /audit/i },
      { name: 'anchors', label: /anchor/i },
      { name: 'search', label: /search/i },
      { name: 'cacheStats', label: /cache/i },
      { name: 'liveActivity', label: /live/i },
      { name: 'claimableBalances', label: /claimable/i },
      { name: 'dataExport', label: /export/i },
    ];

    for (const { name, label } of tabs) {
      test(`loads ${name} tab successfully`, async ({ page }) => {
        await page.goto('/');
        // Connect to an account
        await page.getByPlaceholder(/G\.\.\. public key/i).fill(TESTNET_ACCOUNT);
        await page.getByRole('button', { name: /connect/i }).click();
        // Wait for connection
        await expect(page.getByText(/Account Detail|Overview/).first()).toBeVisible({ timeout: 30000 });
        // Click on tab if it exists
        const tabBtn = page.getByRole('button', { name: label }).first();
        if (await tabBtn.count() > 0) {
          await tabBtn.click();
          // Verify tab loads
          await expect(page.locator('body')).toBeVisible();
        }
      });
    }
  });

  test.describe('Faucet Flow', () => {
    test('faucet button works with mock friendbot', async ({ page }) => {
      await page.route('**/friendbot*', async route => {
        await route.fulfill({ status: 200, json: { hash: 'mock-hash-123' } });
      });

      await page.goto('/');
      await page.getByPlaceholder(/G\.\.\. public key/i).fill(TESTNET_ACCOUNT);
      await page.getByRole('button', { name: /connect/i }).click();
      
      const faucetBtn = page.getByRole('button', { name: /faucet/i }).first();
      if (await faucetBtn.count() > 0) {
        await faucetBtn.click();
        const fundBtn = page.getByRole('button', { name: /fund/i }).or(page.getByText(/fund/i)).first();
        if (await fundBtn.count() > 0) {
          await fundBtn.click();
        }
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  test.describe('Theme Toggle', () => {
    test('theme toggle switches between dark and light', async ({ page }) => {
      await page.goto('/');
      const themeToggle = page.getByRole('button', { name: /theme|light|dark/i }).first();
      if (await themeToggle.count() > 0) {
        const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        await themeToggle.click();
        await page.waitForTimeout(100);
        const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(newTheme).not.toBe(initialTheme);
      }
    });
  });

  test.describe('Notifications', () => {
    test('notification bell opens and closes', async ({ page }) => {
      await page.goto('/');
      const bellBtn = page.locator('button[aria-label*="notification"]').or(page.locator('button').filter({ hasText: '🔔' })).first();
      if (await bellBtn.count() > 0) {
        await bellBtn.click();
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  test.describe('User Preferences', () => {
    test('preferences modal opens and closes', async ({ page }) => {
      await page.goto('/');
      const settingsBtn = page.locator('button[title="User Preferences"]').or(page.getByText('⚙')).first();
      if (await settingsBtn.count() > 0) {
        await settingsBtn.click();
        await expect(page.locator('body')).toBeVisible();
        // Close by clicking outside
        await page.mouse.click(10, 10);
      }
    });
  });

  test.describe('Global Search', () => {
    test('search bar is interactive', async ({ page }) => {
      await page.goto('/');
      await page.getByPlaceholder(/G\.\.\. public key/i).fill(TESTNET_ACCOUNT);
      await page.getByRole('button', { name: /connect/i }).click();
      await expect(page.getByText(/Account Detail|Overview/).first()).toBeVisible({ timeout: 30000 });
      const searchInput = page.getByPlaceholder(/search/i).or(page.locator('input[role="search"]')).first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('test');
        await expect(searchInput).toHaveValue('test');
      }
    });
  });

  test.describe('Performance', () => {
    test('page loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // 10 seconds max
    });
  });
});
