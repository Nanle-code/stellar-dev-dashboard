import { test, expect } from '@playwright/test';

test.describe('Wallet Connection', () => {
  test('should show connect button and handle successful connection', async ({ page }) => {
    await page.goto('/');

    const connectBtn = page.getByRole('button', { name: /connect wallet/i });
    await expect(connectBtn).toBeVisible();

    // Mocking a wallet response if using an extension-based flow
    // This is a simplified check for UI state change
    await connectBtn.click();

    // Assuming the app displays the truncated public key upon connection
    // e.g., G...ABCD
    const accountInfo = page.locator('#account-identity');
    await expect(accountInfo).toContainText(/^G[A-Z0-9]{3}...[A-Z0-9]{4}$/);
  });

  test('should persist connection on page reload', async ({ page }) => {
    await page.goto('/');
    // Implementation for session/localstorage check
  });
});