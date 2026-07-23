import { test, expect } from '@playwright/test';

test.describe('Connect and Faucet Flow', () => {
  test('connects to account, funds via faucet, and shows balance', async ({ page }) => {
    // Intercept Friendbot
    await page.route('**/friendbot*', async route => {
      await route.fulfill({ status: 200, json: { hash: 'mock-hash' } });
    });
    
    // Intercept Horizon account fetch
    await page.route('**/accounts/*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          account_id: 'GA1234567890',
          balances: [{ asset_type: 'native', balance: '10000.0000000' }],
          sequence: '1'
        }
      });
    });

    // Intercept operations and txs to not block UI
    await page.route('**/operations*', async route => {
      await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
    });
    await page.route('**/transactions*', async route => {
      await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
    });
    // Intercept offers and prices
    await page.route('**/offers*', async route => {
      await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
    });
    await page.route('**/api/v3/simple/price*', async route => {
      await route.fulfill({ status: 200, json: { stellar: { usd: 0.1 } } });
    });

    await page.goto('/');
    
    // Connect Panel interaction
    const input = page.locator('input[placeholder*="public key"]');
    await expect(input).toBeVisible();
    await input.fill('GA1234567890');
    
    const connectBtn = page.locator('button:has-text("Connect")');
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();
    
    // Navigate to Faucet Tab
    const faucetTab = page.locator('text="Faucet"');
    await faucetTab.click();
    
    // Interact with Faucet
    const fundBtn = page.locator('button:has-text("FUND ACCOUNT")');
    await expect(fundBtn).toBeVisible();
    await fundBtn.click();
    
    // Verify Success
    await expect(page.locator('text="Account Funded!"')).toBeVisible();
  });
});
