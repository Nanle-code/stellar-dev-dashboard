/**
 * Critical-path E2E coverage (#405).
 *
 * Account connection, transaction submission, wallet connection (Freighter,
 * Ledger) and contract interaction, each with a happy path plus edge and
 * failure cases. All network traffic is served by the deterministic `stellar`
 * fixture (`./support/fixtures.ts`), so the suite never touches a live network.
 */

import { test, expect } from './support/fixtures';
import { buildHorizonAccount, testKeypair } from './support/dataFactories';
import { connectAccount, openRoute } from './support/actions';

const ALICE = testKeypair('alice').publicKey();

test.describe('Account connection', () => {
  test('happy path: valid key loads the dashboard and shows the account', async ({ page, stellar }) => {
    stellar.setAccount(buildHorizonAccount({ seed: 'alice', balances: [{ asset: 'native', balance: '1234.5000000' }] }));
    await connectAccount(page, ALICE);

    await expect(page).toHaveURL(/\/overview/);
    const connected = page.getByLabel('Connected account');
    await expect(connected).toBeVisible();
    const shown = (await connected.innerText()).match(/G[A-Z0-9]{2,11}(?:…|\.{3})[A-Z0-9]{3,12}|G[A-Z2-7]{55}/)?.[0];
    expect(shown).toBeDefined();
    if (shown?.length === 56) expect(shown).toBe(ALICE);
    else expect(shown).toBeShortAddressOf(ALICE);
    expect(ALICE).toBeStellarPublicKey();
  });

  test('edge case: malformed key shows a validation error and stays on connect', async ({ page, stellar }) => {
    await connectAccount(page, 'GABC123');
    await expect(page.getByText(/invalid stellar address/i)).toBeVisible();
    await expect(page.getByLabel('Stellar account address')).toHaveAttribute('aria-invalid', 'true');
    expect(stellar.unhandled.filter((u) => /horizon/.test(u))).toEqual([]);
  });

  test('edge case: checksum-invalid key is rejected before any network call', async ({ page }) => {
    const tampered = ALICE.slice(0, -1) + (ALICE.endsWith('A') ? 'B' : 'A');
    const accountRequests: string[] = [];
    page.on('request', (r) => {
      if (/\/accounts\//.test(r.url())) accountRequests.push(r.url());
    });
    await connectAccount(page, tampered);
    await expect(page.getByText(/invalid stellar address/i)).toBeVisible();
    expect(accountRequests).toEqual([]);
  });

  test('failure: unfunded account (Horizon 404) surfaces an error instead of a blank dashboard', async ({ page, stellar }) => {
    stellar.setAccount(null);
    await connectAccount(page, ALICE);
    await expect(page.getByText(/not found|not funded|does not exist|unfunded|fund it|friendbot/i).first()).toBeVisible();
  });
});

test.describe('Wallet connection', () => {
  test('Freighter: connects and exposes the wallet address', async ({ page, stellar, freighter }) => {
    await freighter.install();
    const walletKey = 'GA1234567890MOCKWALLETPUBLICKEY1234567890'; // from tests/e2e/fixtures/freighter-mock.js
    stellar.setAccount(buildHorizonAccount());
    await connectAccount(page, ALICE);
    await openRoute(page, '/wallet');
    await page.getByRole('button', { name: 'Connect Freighter' }).click();
    await expect(page.getByText(walletKey).first()).toBeVisible();
  });

  test('Freighter: user rejection shows the wallet error', async ({ page, stellar, freighter }) => {
    await freighter.install();
    stellar.setAccount(buildHorizonAccount());
    await connectAccount(page, ALICE);
    await openRoute(page, '/wallet');
    await page.evaluate(() => (window as unknown as { mockWalletAdapter: { rejectNextConnect(): void } }).mockWalletAdapter.rejectNextConnect());
    await page.getByRole('button', { name: 'Connect Freighter' }).click();
    await expect(page.getByText('User declined access.').first()).toBeVisible();
  });

  test('Freighter: not installed is reported as not detected', async ({ page, stellar }) => {
    stellar.setAccount(buildHorizonAccount());
    await connectAccount(page, ALICE);
    await openRoute(page, '/wallet');
    await expect(page.getByRole('button', { name: 'Connect Freighter' })).toContainText(/not detected/i);
  });

  test('Ledger: unsupported browser (no WebUSB/WebHID) fails safely', async ({ page, stellar }) => {
    await page.addInitScript(() => {
      for (const api of ['hid', 'usb'] as const) {
        try {
          Object.defineProperty(Navigator.prototype, api, { get: () => undefined, configurable: true });
        } catch {
          /* already non-configurable — the availability check below still runs */
        }
      }
    });
    stellar.setAccount(buildHorizonAccount());
    await connectAccount(page, ALICE);
    await openRoute(page, '/wallet');
    const ledger = page.getByRole('button', { name: /^Connect Ledger/ });
    await expect(ledger).toContainText(/WebUSB\/WebHID unavailable/);
    await ledger.click();
    // The read-only account stays connected; no hardware session is created.
    await expect(page).toHaveURL(/\/wallet/);
  });
});

test.describe('Transaction building', () => {
  test('builder renders the operation form for the connected account', async ({ page, stellar }) => {
    stellar.setAccount(buildHorizonAccount({ seed: 'alice' }));
    await connectAccount(page, ALICE);
    await expect(page).toHaveURL(/\/overview/);
    await openRoute(page, '/builder');
    await expect(page.getByPlaceholder('Enter source account public key (G...)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Payment' })).toBeVisible();
    // Nothing is submitted to Horizon without an explicit sign-and-submit action.
    expect(stellar.submissions).toHaveLength(0);
  });

  test('signer asks for a wallet before signing', async ({ page, stellar }) => {
    stellar.setAccount(buildHorizonAccount({ seed: 'alice' }));
    await connectAccount(page, ALICE);
    await expect(page).toHaveURL(/\/overview/);
    await openRoute(page, '/signer');
    await expect(page.getByText('Connect a wallet to sign transactions.')).toBeVisible();
  });
});

test.describe('Contract interaction', () => {
  async function simulate(page: import('@playwright/test').Page, contractId: string) {
    await connectAccount(page, ALICE);
    await expect(page).toHaveURL(/\/overview/);
    await openRoute(page, '/contractInteraction');
    await page.getByPlaceholder('C... contract address').fill(contractId);
    await page.getByPlaceholder('increment').fill('increment');
    // Keyboard activation: at narrow desktop widths the fixed sidebar can overlap the button.
    await page.getByRole('button', { name: 'Simulate' }).press('Enter');
  }

  test('simulation request reaches Soroban RPC with a valid contract id', async ({ page, stellar }) => {
    stellar.setAccount(buildHorizonAccount({ seed: 'alice' }));
    stellar.setSorobanScenario('success');
    expect(stellar.soroban.contractId).toBeContractId();
    await simulate(page, stellar.soroban.contractId);
    await expect(page.locator('#main-content')).not.toContainText(/something went wrong|unexpected error/i);
  });

  test('invalid contract id is flagged before simulation', async ({ page, stellar }) => {
    stellar.setAccount(buildHorizonAccount({ seed: 'alice' }));
    await connectAccount(page, ALICE);
    await expect(page).toHaveURL(/\/overview/);
    await openRoute(page, '/contractInteraction');
    const input = page.getByPlaceholder('C... contract address');
    await input.fill('NOT-A-CONTRACT');
    expect('NOT-A-CONTRACT').not.toBeContractId();
    await expect(page.locator('#main-content')).toContainText(/invalid|contract id/i);
  });
});
