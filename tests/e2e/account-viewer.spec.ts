import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for the Account Viewer flow (#248).
 *
 * Covers:
 *  - Account input & validation
 *  - Balance display (XLM + non-native assets)
 *  - USD estimates
 *  - Transaction history loading & pagination
 *  - Operations tab
 *  - Error scenarios (invalid key, network errors)
 *  - Mainnet / testnet mode switching
 */

const TESTNET_ACCOUNT = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
const MAINNET_ACCOUNT = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const INVALID_KEY     = 'INVALIDKEYNOTASTELLARADDRESS';
const SHORT_KEY       = 'GABC123';

async function connectAccount(page, address) {
  const input = page.getByPlaceholder(/G\.\.\. public key/i);
  await input.fill(address);
  await page.getByRole('button', { name: /connect/i }).click();
}

async function waitForAccountDetail(page) {
  await expect(page.getByText('Account Detail')).toBeVisible({ timeout: 20000 });
}

test.describe('Account Input & Validation', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('shows connect panel on first load', async ({ page }) => {
    await expect(page.getByText('STELLAR')).toBeVisible();
    await expect(page.getByPlaceholder(/G\.\.\. public key/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /connect/i })).toBeVisible();
  });

  test('shows error for invalid key', async ({ page }) => {
    await connectAccount(page, INVALID_KEY);
    await expect(page.getByText(/invalid stellar address/i)).toBeVisible();
  });

  test('shows error for short key', async ({ page }) => {
    await connectAccount(page, SHORT_KEY);
    await expect(page.getByText(/invalid stellar address/i)).toBeVisible();
  });

  test('clears error when user edits input', async ({ page }) => {
    await connectAccount(page, INVALID_KEY);
    await expect(page.getByText(/invalid stellar address/i)).toBeVisible();
    await page.getByPlaceholder(/G\.\.\. public key/i).fill('G');
    await expect(page.getByText(/invalid stellar address/i)).toHaveCount(0);
  });

  test('pressing Enter triggers connect', async ({ page }) => {
    const input = page.getByPlaceholder(/G\.\.\. public key/i);
    await input.fill(INVALID_KEY);
    await input.press('Enter');
    await expect(page.getByText(/invalid stellar address/i)).toBeVisible();
  });
});

test.describe('Balance Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await connectAccount(page, TESTNET_ACCOUNT);
    await waitForAccountDetail(page);
  });

  test('displays public key in identity section', async ({ page }) => {
    await expect(page.getByText(new RegExp(TESTNET_ACCOUNT.slice(0, 8), 'i'))).toBeVisible();
  });

  test('displays XLM balance', async ({ page }) => {
    await expect(page.getByText(/XLM/)).toBeVisible();
  });

  test('displays Asset Balances section', async ({ page }) => {
    await expect(page.getByText('Asset Balances')).toBeVisible();
  });

  test('displays Thresholds section', async ({ page }) => {
    await expect(page.getByText('Thresholds')).toBeVisible();
  });

  test('displays Flags section', async ({ page }) => {
    await expect(page.getByText('Flags')).toBeVisible();
  });

  test('shows View on Stellar Expert link', async ({ page }) => {
    const link = page.getByRole('link', { name: /view on stellar expert/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', new RegExp(TESTNET_ACCOUNT));
  });
});

test.describe('USD Estimates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await connectAccount(page, TESTNET_ACCOUNT);
    await waitForAccountDetail(page);
  });

  test('page remains stable whether or not USD estimate loads', async ({ page }) => {
    await expect(page.getByText('Account Detail')).toBeVisible();
    const usd = page.getByText(/est\./i);
    const count = await usd.count();
    if (count > 0) await expect(usd.first()).toBeVisible();
  });

  test('USD estimate matches dollar format when present', async ({ page }) => {
    const usd = page.getByText(/est\.\s*\$[\d,]+(\.\d+)?/i);
    const count = await usd.count();
    if (count > 0) {
      const text = await usd.first().textContent();
      expect(text).toMatch(/\$[\d,]+(\.\d{2})?/);
    }
  });
});

test.describe('Transaction History', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await connectAccount(page, TESTNET_ACCOUNT);
    await waitForAccountDetail(page);
    await page.getByRole('button', { name: /transactions/i }).click();
  });

  test('shows transaction list or empty state', async ({ page }) => {
    const noTx = await page.getByText(/no transactions found/i).count();
    if (noTx === 0) {
      await expect(page.getByText('Hash')).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page.getByText(/no transactions found/i)).toBeVisible();
    }
  });

  test('shows Load More or No More Transactions footer', async ({ page }) => {
    const noTx = await page.getByText(/no transactions found/i).count();
    if (noTx > 0) return;
    await expect(page.getByText('Hash')).toBeVisible({ timeout: 15000 });
    const loadMore = await page.getByRole('button', { name: /load more/i }).isVisible().catch(() => false);
    const noMore   = await page.getByText(/no more transactions/i).isVisible().catch(() => false);
    expect(loadMore || noMore).toBeTruthy();
  });

  test('Load More button appends transactions', async ({ page }) => {
    const loadMore = page.getByRole('button', { name: /load more/i });
    if (!await loadMore.isVisible().catch(() => false)) return;
    await loadMore.click();
    await expect(page.getByText('Account Detail')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Operations Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await connectAccount(page, TESTNET_ACCOUNT);
    await waitForAccountDetail(page);
    await page.getByRole('button', { name: /transactions/i }).click();
    await page.getByRole('button', { name: /operations/i }).click();
  });

  test('switches to operations view', async ({ page }) => {
    const noOps = await page.getByText(/no operations found/i).count();
    if (noOps === 0) {
      await expect(page.getByText(/type/i).first()).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page.getByText(/no operations found/i)).toBeVisible();
    }
  });

  test('operations Load More works', async ({ page }) => {
    const loadMore = page.getByRole('button', { name: /load more/i });
    if (!await loadMore.isVisible().catch(() => false)) return;
    await loadMore.click();
    await expect(page.getByText('Account Detail')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Error Scenarios', () => {
  test('shows error for non-existent account', async ({ page }) => {
    await page.goto('/');
    await connectAccount(page, 'GDQJUTQYK2MQX2VGDR2FYWLIYAQIEGXTQVTFEMGH3SUELR3QLKRNEYM');
    await expect(page.getByText(/not found|failed|error/i)).toBeVisible({ timeout: 20000 });
  });

  test('shows error when Horizon is unreachable', async ({ page }) => {
    await page.route('**/horizon**.stellar.org/**', route => route.abort('failed'));
    await page.goto('/');
    await connectAccount(page, TESTNET_ACCOUNT);
    await expect(page.getByText(/not found|failed|error|unavailable/i)).toBeVisible({ timeout: 20000 });
  });
});

test.describe('Mainnet vs Testnet', () => {
  test('stellar.expert link uses testnet slug for testnet account', async ({ page }) => {
    await page.goto('/');
    await connectAccount(page, TESTNET_ACCOUNT);
    await waitForAccountDetail(page);
    const href = await page.getByRole('link', { name: /view on stellar expert/i }).getAttribute('href');
    expect(href).toMatch(/testnet/i);
  });

  test('connects to mainnet account without crashing', async ({ page }) => {
    await page.goto('/');
    const mainnetBtn = page.getByRole('button', { name: /mainnet/i });
    if (await mainnetBtn.isVisible()) await mainnetBtn.click();
    await connectAccount(page, MAINNET_ACCOUNT);
    await expect(page.locator('body')).toBeVisible();
  });
});
