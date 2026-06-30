import { test, expect } from '@playwright/test';

test.describe('Soroban Contract Interaction', () => {
  test('contract simulate returns result panel', async ({ page }) => {
    // Mock Soroban RPC
    await page.route('**/soroban/rpc', async route => {
      const request = route.request();
      if (request.method() !== 'POST') {
        return route.continue();
      }
      const postData = request.postDataJSON();
      if (postData && postData.method === 'simulateTransaction') {
        await route.fulfill({
          status: 200,
          json: {
            jsonrpc: "2.0",
            id: postData.id,
            result: {
              results: [{
                xdr: "AAAA...",
                auth: []
              }],
              events: [],
              cost: { cpuInsns: "1000", memBytes: "100" }
            }
          }
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
    
    // Navigate to Contracts tab
    await page.click('text="Contracts"');
    
    // Fill out interaction form
    await page.fill('input[placeholder*="contract address"]', 'CCABCD123');
    await page.fill('input[placeholder*="increment"]', 'increment');
    
    // Click Simulate
    await page.click('button:has-text("Simulate")');
    
    // Expect Result Panel
    await expect(page.locator('text="Simulation Result"').first()).toBeVisible();
  });
});
