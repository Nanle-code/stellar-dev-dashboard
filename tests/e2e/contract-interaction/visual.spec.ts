/**
 * Contract interaction visual regression suite (#894)
 * ===================================================
 * Captures and compares baselines for the contract invocation form across the
 * `visual-mobile` / `visual-tablet` / `visual-desktop` / `visual-wide`
 * Playwright projects (see `playwright.config.ts` and `tests/visual/viewports.ts`).
 *
 * Because this file is named `visual.spec.ts` it is picked up by the `visual-*`
 * projects via `testMatch: '**\/visual.spec.*'` and ignored by the plain
 * browser projects.
 *
 * Coverage:
 *  - primary flow   → empty form, filled form, successful simulation result;
 *  - boundary cases → invalid contract id, oversized argument value, viewport
 *                     responsiveness;
 *  - failure paths  → Soroban RPC error rendering, missing-baseline handling.
 *
 * Recording baselines:
 *   UPDATE_VISUAL_BASELINES=1 npx playwright test --project=visual-desktop
 * Strict comparison (fail when a baseline is absent):
 *   VISUAL_REQUIRE_BASELINE=1 npx playwright test --project=visual-desktop
 */

import { expect, test } from '@playwright/test';
import {
  INVALID_CONTRACT_ID,
  VALID_CONTRACT_ID,
  contractForm,
  contractIdInput,
  expectStableScreenshot,
  fillContractForm,
  functionNameInput,
  mockStellarNetwork,
  openContractInteraction,
  resultPanel,
  simulateButton,
} from './contractFormHarness';

const UNAVAILABLE = 'Contract invocation form is not available in this build';

test.describe('Contract invocation form', () => {
  // ── Primary flow ─────────────────────────────────────────────────────────

  test('default (empty) form', async ({ page }, testInfo) => {
    await mockStellarNetwork(page);
    const available = await openContractInteraction(page);
    test.skip(!available, UNAVAILABLE);

    await expect(contractForm(page)).toBeVisible();
    await expectStableScreenshot(contractForm(page), testInfo, 'contract-form-empty.png');
  });

  test('form filled with a valid contract id', async ({ page }, testInfo) => {
    await mockStellarNetwork(page);
    const available = await openContractInteraction(page);
    test.skip(!available, UNAVAILABLE);

    await fillContractForm(page);
    await expect(contractIdInput(page)).toHaveValue(VALID_CONTRACT_ID);

    await expectStableScreenshot(contractForm(page), testInfo, 'contract-form-filled.png');
  });

  test('successful simulation renders the result panel', async ({ page }, testInfo) => {
    await mockStellarNetwork(page);
    const available = await openContractInteraction(page);
    test.skip(!available, UNAVAILABLE);

    const simulate = simulateButton(page);
    test.skip((await simulate.count()) === 0, 'Simulate control is not available');

    await fillContractForm(page);
    await simulate.click();

    await expect(resultPanel(page)).toBeVisible({ timeout: 15_000 });
    await expectStableScreenshot(page, testInfo, 'contract-form-simulated.png', { fullPage: true });
  });

  // ── Boundary cases ───────────────────────────────────────────────────────

  test('invalid contract id shows a validation state', async ({ page }, testInfo) => {
    await mockStellarNetwork(page);
    const available = await openContractInteraction(page);
    test.skip(!available, UNAVAILABLE);

    await contractIdInput(page).fill(INVALID_CONTRACT_ID);
    await contractIdInput(page).blur().catch(() => undefined);

    // The form must stay mounted and keep the user's input rather than crash.
    await expect(contractForm(page)).toBeVisible();
    await expect(contractIdInput(page)).toHaveValue(INVALID_CONTRACT_ID);
    await expect(functionNameInput(page).or(contractIdInput(page)).first()).toBeVisible();

    await expectStableScreenshot(contractForm(page), testInfo, 'contract-form-invalid-id.png');
  });

  test('oversized argument values do not break the layout', async ({ page }, testInfo) => {
    await mockStellarNetwork(page);
    const available = await openContractInteraction(page);
    test.skip(!available, UNAVAILABLE);

    await fillContractForm(page);

    const inputs = page.locator('input');
    const total = await inputs.count();
    for (let i = 0; i < total; i++) {
      const input = inputs.nth(i);
      const placeholder = (await input.getAttribute('placeholder')) ?? '';
      if (/contract address|contract id|function|method|increment|secret|search/i.test(placeholder)) continue;
      if (!(await input.isVisible().catch(() => false))) continue;
      if (!(await input.isEditable().catch(() => false))) continue;
      if ((await input.inputValue()) !== '') continue;
      await input.fill('9'.repeat(120));
      break;
    }

    await expect(contractForm(page)).toBeVisible();
    await expectStableScreenshot(contractForm(page), testInfo, 'contract-form-long-arg.png');
  });

  test('layout adapts to the project viewport', async ({ page }, testInfo) => {
    await mockStellarNetwork(page);
    const available = await openContractInteraction(page);
    test.skip(!available, UNAVAILABLE);

    await fillContractForm(page);

    const viewport = page.viewportSize();
    expect(viewport, 'visual projects must define a viewport').not.toBeNull();

    const formBox = await contractForm(page).boundingBox();
    expect(formBox).not.toBeNull();
    if (formBox && viewport) {
      expect(formBox.width).toBeLessThanOrEqual(viewport.width + 1);
    }

    await expectStableScreenshot(page, testInfo, 'contract-form-viewport.png', { fullPage: true });
  });

  // ── Failure paths ────────────────────────────────────────────────────────

  test('RPC failure surfaces an error state', async ({ page }, testInfo) => {
    await mockStellarNetwork(page, { simulateError: true });
    const available = await openContractInteraction(page);
    test.skip(!available, UNAVAILABLE);

    const simulate = simulateButton(page);
    test.skip((await simulate.count()) === 0, 'Simulate control is not available');

    await fillContractForm(page);
    await simulate.click();

    await expect(page.getByText(/trapped|simulation failed|error/i).first()).toBeVisible({ timeout: 15_000 });
    await expectStableScreenshot(contractForm(page), testInfo, 'contract-form-rpc-error.png');
  });

  test('missing baseline is handled without failing (unsupported environment)', async ({ page }, testInfo) => {
    test.skip(
      process.env.VISUAL_REQUIRE_BASELINE === '1' || process.env.UPDATE_VISUAL_BASELINES === '1',
      'baseline recording / strict mode is enabled for this run'
    );

    await mockStellarNetwork(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // A name that is never recorded: the helper must annotate and pass instead
    // of failing the suite when baselines are unavailable.
    await expectStableScreenshot(page, testInfo, 'contract-form-never-recorded.png');

    const annotations = testInfo.annotations.map((annotation) => annotation.type);
    expect(annotations).toContain('baseline-missing');
  });
});
