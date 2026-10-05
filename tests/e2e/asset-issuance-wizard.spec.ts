import { test, expect } from '@playwright/test';
import * as StellarSdk from '@stellar/stellar-sdk';

test.describe('testnet asset issuance wizard', () => {
  test('previews and submits the complete authorization-required issuance flow with fixtures', async ({ page }) => {
    const submissions: string[] = [];
    await page.route('https://friendbot.stellar.org/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ successful: true }) });
    });
    await page.route('https://horizon-testnet.stellar.org/accounts/**', async (route) => {
      const accountId = new URL(route.request().url()).pathname.split('/').pop();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          account_id: accountId,
          sequence: String(10 + submissions.length),
          subentry_count: 0,
          thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
          flags: {},
          balances: [{ asset_type: 'native', balance: '10' }],
          signers: [],
          data: {},
        }),
      });
    });
    await page.route('https://horizon-testnet.stellar.org/transactions', async (route) => {
      submissions.push(route.request().postData() ?? '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hash: `fixture-${submissions.length}`, ledger: 123, successful: true }),
      });
    });

    await page.goto('/assetIssuance');
    await page.getByLabel('Asset code').fill('DEMO');
    await page.getByLabel('Asset name').fill('Demo Credit');
    await page.getByLabel('Home domain').fill('example.org');
    await page.getByRole('checkbox').nth(0).check();
    await page.getByRole('checkbox').nth(1).check();
    await page.getByRole('checkbox').nth(2).check();
    await page.getByRole('button', { name: 'Create and fund accounts' }).click();
    await expect(page.getByText('Both testnet accounts are funded.')).toBeVisible();
    await expect(page.getByText('No currency-entry errors.')).toBeVisible();

    for (const title of ['Issuer policy and domain', 'Distributor trustline', 'Authorize holder', 'Issue initial supply']) {
      const stage = page.locator('article').filter({ hasText: title });
      await stage.getByRole('button', { name: 'Preview transaction' }).click();
      await expect(page.getByText(`Transaction preview: ${title}`)).toBeVisible();
      await page.getByRole('button', { name: 'Sign and submit' }).click();
      await expect(page.getByRole('status')).toContainText('Transaction confirmed:');
      await expect(stage).toContainText('Confirmed:');
    }

    expect(submissions).toHaveLength(4);
    expect(await page.getByText('[[CURRENCIES]]').count()).toBeGreaterThan(0);
    await expect(page.locator('article').filter({ hasText: 'Issue initial supply' })).toContainText('Confirmed: fixture-4');
  });

  test('creates accounts with Friendbot fixtures and resumes without persisting signing keys', async ({ page }) => {
    const fundedAddresses: string[] = [];
    await page.route('https://friendbot.stellar.org/**', async (route) => {
      const address = new URL(route.request().url()).searchParams.get('addr');
      if (address) fundedAddresses.push(address);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ successful: true }) });
    });

    await page.goto('/assetIssuance');
    await expect(page.getByRole('heading', { name: 'Testnet asset issuance' })).toBeVisible();
    await page.getByLabel('Asset code').fill('DEMO');
    await page.getByLabel('Asset name').fill('Demo Credit');
    await page.getByLabel('Home domain').fill('example.org');
    await page.getByRole('button', { name: 'Create and fund accounts' }).click();

    await expect(page.getByText('Both testnet accounts are funded.')).toBeVisible();
    await expect.poll(() => fundedAddresses.length).toBe(2);
    const savedDraft = await page.evaluate(() => localStorage.getItem('stellar:asset-issuance:testnet:v1'));
    expect(savedDraft).toContain('DEMO');
    expect(savedDraft).not.toMatch(/S[A-Z2-7]{55}/);

    await page.reload();
    await expect(page.getByText('Issuer · funded')).toBeVisible();
    await expect(page.getByLabel('issuer secret key')).toHaveValue('');
    await expect(page.getByLabel('distributor secret key')).toHaveValue('');
  });

  test('shows a funding failure and keeps the draft retryable', async ({ page }) => {
    await page.route('https://friendbot.stellar.org/**', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'fixture outage' }) });
    });

    await page.goto('/assetIssuance');
    await page.getByLabel('Asset code').fill('FAIL');
    await page.getByLabel('Asset name').fill('Failure Fixture');
    await page.getByLabel('Home domain').fill('example.org');
    await page.getByRole('button', { name: 'Create and fund accounts' }).click();

    await expect(page.getByRole('alert')).toContainText('Faucet request failed');
    await expect(page.getByLabel('issuer secret key')).not.toHaveValue('');
    const savedDraft = await page.evaluate(() => localStorage.getItem('stellar:asset-issuance:testnet:v1'));
    expect(savedDraft).toContain('FAIL');
    expect(savedDraft).not.toMatch(/S[A-Z2-7]{55}/);
  });

  test('requires explicit acknowledgement before signing the issuer lock', async ({ page }) => {
    const issuer = StellarSdk.Keypair.random();
    const distributor = StellarSdk.Keypair.random();
    const draft = {
      config: { code: 'DEMO', name: 'Demo Credit', homeDomain: 'example.org', supply: '1000', authRequired: false, authRevocable: false, clawbackEnabled: false },
      issuerPublicKey: issuer.publicKey(),
      distributorPublicKey: distributor.publicKey(),
      issuerFunded: true,
      distributorFunded: true,
      completed: { configure: true, trustline: true, issue: true },
      transactionHashes: {},
    };
    await page.addInitScript((savedDraft) => localStorage.setItem('stellar:asset-issuance:testnet:v1', JSON.stringify(savedDraft)), draft);
    await page.route('https://horizon-testnet.stellar.org/accounts/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          account_id: issuer.publicKey(),
          sequence: '10',
          subentry_count: 0,
          thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
          flags: {},
          balances: [{ asset_type: 'native', balance: '10' }],
          signers: [],
          data: {},
        }),
      });
    });

    await page.goto('/assetIssuance');
    await page.getByRole('button', { name: 'Preview transaction' }).click();
    const acknowledgement = page.getByLabel('I have verified the asset setup and understand this issuer cannot be operated again.');
    const submit = page.getByRole('button', { name: 'Sign and submit' });
    await expect(acknowledgement).not.toBeChecked();
    await expect(submit).toBeDisabled();
    await acknowledgement.check();
    await expect(submit).toBeEnabled();
  });
});
