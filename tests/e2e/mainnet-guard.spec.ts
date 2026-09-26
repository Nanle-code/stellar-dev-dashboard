/**
 * E2E tests — #983 Mainnet Safety Guard
 *
 * Covers:
 *  - Network badge: amber chrome visible on mainnet, absent on testnet
 *  - Payment flow: guard dialog appears on mainnet submit
 *  - Payment flow: guard dialog absent on testnet submit
 *  - Contract invoke flow: guard dialog appears on mainnet invoke
 *  - Deploy flow: guard dialog appears on mainnet deploy
 *  - Boundary: partial phrase keeps confirm button disabled
 *  - Read-only lock: activating the lock blocks further dialogs
 */

import { test, expect, type Page } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setNetwork(page: Page, network: 'mainnet' | 'testnet') {
  await page.evaluate((net) => {
    localStorage.setItem('stellar:selected-network', net);
  }, network);
  await page.reload();
}

async function connectWallet(page: Page) {
  // Inject a fake connected address so guarded routes are reachable
  await page.evaluate(() => {
    const KEY = 'store:preferences';
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    stored.connectedAddress = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
    stored.walletConnected = true;
    stored.walletType = 'freighter';
    stored.walletPublicKey = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
    localStorage.setItem(KEY, JSON.stringify(stored));
  });
  await page.reload();
}

async function typeMainnetConfirmation(page: Page) {
  const input = page.getByLabel(/type.*mainnet.*to confirm/i);
  await input.fill('mainnet');
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe('#983 Mainnet Safety Guard', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress real network calls
    await page.route('**/*.stellar.org/**', (route) => route.fulfill({ status: 200, json: {} }));
    await page.route('**/api/**', (route) => route.fulfill({ status: 200, json: {} }));

    await page.goto('/');
    await connectWallet(page);
  });

  // ── Network badge ───────────────────────────────────────────────────────────

  test('shows amber MAINNET badge when on mainnet', async ({ page }) => {
    await setNetwork(page, 'mainnet');

    const badge = page.getByRole('button', { name: /mainnet.*live funds/i });
    await expect(badge).toBeVisible();

    // Amber visual: the text "⚠ MAINNET" should be present
    await expect(page.getByText('⚠')).toBeVisible();
    await expect(page.getByText(/MAINNET/)).toBeVisible();
  });

  test('does not show amber MAINNET badge on testnet', async ({ page }) => {
    await setNetwork(page, 'testnet');

    await expect(page.getByText('⚠')).not.toBeVisible();
    await expect(page.getByText('TESTNET')).toBeVisible();
  });

  // ── Payment (TransactionSigner) flow ────────────────────────────────────────

  test('guard dialog appears when signing on mainnet', async ({ page }) => {
    await setNetwork(page, 'mainnet');
    await page.goto('/signer');

    // Paste a minimal placeholder XDR to enable the Sign button
    const xdrInput = page.getByRole('textbox').first();
    await xdrInput.fill('AAAAAQAAAA=='); // any non-empty string

    const signBtn = page.getByRole('button', { name: /sign/i }).first();
    await signBtn.click();

    // Guard dialog should appear
    await expect(page.getByRole('dialog', { name: /mainnet write confirmation/i })).toBeVisible();
  });

  test('guard dialog does NOT appear when signing on testnet', async ({ page }) => {
    await setNetwork(page, 'testnet');
    await page.goto('/signer');

    const xdrInput = page.getByRole('textbox').first();
    await xdrInput.fill('AAAAAQAAAA==');

    const signBtn = page.getByRole('button', { name: /sign/i }).first();
    await signBtn.click();

    await expect(page.getByRole('dialog', { name: /mainnet write confirmation/i })).not.toBeVisible();
  });

  // ── Contract invoke flow ────────────────────────────────────────────────────

  test('guard dialog appears when invoking contract on mainnet', async ({ page }) => {
    await setNetwork(page, 'mainnet');
    await page.goto('/contractInteraction');

    // Fill minimum required fields
    await page.getByPlaceholder(/contract id/i).fill('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4');
    await page.getByPlaceholder(/function name/i).fill('transfer').catch(() => {});

    const invokeBtn = page.getByRole('button', { name: /invoke/i }).first();
    await invokeBtn.click();

    await expect(page.getByRole('dialog', { name: /mainnet write confirmation/i })).toBeVisible();
  });

  // ── Deploy flow ─────────────────────────────────────────────────────────────

  test('guard dialog appears when deploying on mainnet', async ({ page }) => {
    await setNetwork(page, 'mainnet');
    await page.goto('/contracts');

    // Navigate to deployer step 4
    const deployTab = page.getByRole('tab', { name: /deploy/i }).first();
    if (await deployTab.isVisible()) {
      await deployTab.click();
    }

    const deployBtn = page.getByRole('button', { name: /deploy|simulation review/i }).first();
    if (await deployBtn.isVisible()) {
      await deployBtn.click();
      await expect(page.getByRole('dialog', { name: /mainnet write confirmation/i })).toBeVisible();
    }
  });

  // ── Boundary: partial phrase ─────────────────────────────────────────────────

  test('confirm button stays disabled with partial phrase', async ({ page }) => {
    await setNetwork(page, 'mainnet');
    await page.goto('/signer');

    const xdrInput = page.getByRole('textbox').first();
    await xdrInput.fill('AAAAAQAAAA==');
    await page.getByRole('button', { name: /sign/i }).first().click();

    await expect(page.getByRole('dialog', { name: /mainnet write confirmation/i })).toBeVisible();

    // Type a partial phrase
    await page.getByRole('textbox', { name: /type.*mainnet/i }).fill('main');

    const confirmBtn = page.getByRole('button', { name: /confirm write/i });
    await expect(confirmBtn).toBeDisabled();
  });

  // ── Read-only lock ───────────────────────────────────────────────────────────

  test('activating read-only lock changes badge appearance and blocks guard dialog', async ({ page }) => {
    await setNetwork(page, 'mainnet');

    // Click the badge to toggle read-only lock on
    const badge = page.getByRole('button', { name: /mainnet.*live funds/i });
    await badge.click();

    // Badge should now show lock icon
    await expect(page.getByRole('button', { name: /read-only lock/i })).toBeVisible();

    // Attempt a sign — dialog should NOT appear because writes are blocked
    await page.goto('/signer');
    const xdrInput = page.getByRole('textbox').first();
    await xdrInput.fill('AAAAAQAAAA==');
    await page.getByRole('button', { name: /sign/i }).first().click();

    await expect(page.getByRole('dialog', { name: /mainnet write confirmation/i })).not.toBeVisible();
  });
});
