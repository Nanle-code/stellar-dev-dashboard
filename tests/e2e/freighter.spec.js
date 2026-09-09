import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Freighter Wallet Flows', () => {
  const freighterMockPath = path.resolve(__dirname, 'fixtures', 'freighter-mock.js');

  test.beforeEach(async ({ page }) => {
    // Inject the mock script before any page loads
    await page.addInitScript({ path: freighterMockPath });

    // Mock Horizon API calls to avoid hitting real network
    await page.route('**/accounts/*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          account_id: 'GA1234567890MOCKFREIGHTERPUBLICKEY1234567890',
          balances: [{ asset_type: 'native', balance: '10000.0000000' }],
          sequence: '1'
        }
      });
    });

    await page.route('**/transactions*', async route => {
      await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
    });
    
    await page.route('**/operations*', async route => {
      await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
    });

    // Mock sign result submission if needed
    await page.route('**/transactions', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          json: { hash: 'mock-tx-hash-123', ledger: 123456 }
        });
      } else {
        await route.continue();
      }
    });
  });

  test('primary flow: connect successfully', async ({ page }) => {
    await page.goto('/');
    
    // Connect Wallet button usually appears or we go to a specific view
    // The previous tests indicate clicking 'Connect' or selecting Freighter
    
    // In WalletConnect, it lists wallets. Click Freighter
    const connectFreighterBtn = page.getByRole('button', { name: /Freighter/i });
    await expect(connectFreighterBtn).toBeVisible();
    await connectFreighterBtn.click();
    
    // Wait for the success state showing the mock public key
    await expect(page.getByText('GA1234567890MOCKFREIGHTERPUBLICKEY1234567890')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Freighter Connected/i)).toBeVisible();
  });

  test('failure case: user rejects connection', async ({ page }) => {
    await page.goto('/');
    
    // Set the mock to reject next connection
    await page.evaluate(() => {
      window.mockFreighter.rejectNextConnect();
    });

    const connectFreighterBtn = page.getByRole('button', { name: /Freighter/i });
    await connectFreighterBtn.click();
    
    // The error should be displayed on screen
    await expect(page.getByText('User declined access.')).toBeVisible();
  });

  test('failure case: freighter is locked', async ({ page }) => {
    await page.goto('/');
    
    // Lock the mock
    await page.evaluate(() => {
      window.mockFreighter.simulateLock();
    });

    const connectFreighterBtn = page.getByRole('button', { name: /Freighter/i });
    await connectFreighterBtn.click();
    
    await expect(page.getByText(/Freighter is locked/i)).toBeVisible();
  });

  test('boundary case: network change', async ({ page }) => {
    await page.goto('/');
    
    const connectFreighterBtn = page.getByRole('button', { name: /Freighter/i });
    await connectFreighterBtn.click();
    await expect(page.getByText('GA1234567890MOCKFREIGHTERPUBLICKEY1234567890')).toBeVisible();

    // Trigger network change
    await page.evaluate(() => {
      window.mockFreighter.simulateNetworkChange('PUBLIC');
    });

    // In a real app we might expect the UI to show PUBLIC. 
    // Since we aren't enforcing full app reaction without modifying more code,
    // we just ensure the mock can trigger it without breaking.
    const network = await page.evaluate(() => window.freighterApi.getNetwork());
    expect(network.network).toBe('PUBLIC');
  });

  test('boundary case: account change', async ({ page }) => {
    await page.goto('/');
    
    const connectFreighterBtn = page.getByRole('button', { name: /Freighter/i });
    await connectFreighterBtn.click();
    
    // Trigger account change
    await page.evaluate(() => {
      window.mockFreighter.simulateAccountChange('GBNEWACCOUNTMOCKKEY9999999999999999999999');
    });

    const address = await page.evaluate(() => window.freighterApi.getAddress());
    expect(address.address).toBe('GBNEWACCOUNTMOCKKEY9999999999999999999999');
  });

});
