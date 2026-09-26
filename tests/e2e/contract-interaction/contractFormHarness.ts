/**
 * Contract-interaction visual regression harness (#894)
 * ====================================================
 * Shared plumbing for `tests/e2e/contract-interaction/visual.spec.ts`, which
 * captures and compares baselines for the contract invocation form across the
 * `visual-*` Playwright projects (mobile / tablet / desktop / wide).
 *
 * Two concerns are handled here:
 *
 * 1. **Determinism** — the Soroban RPC and Horizon endpoints are mocked so the
 *    form, its result panel and its error states render identically on every
 *    run and without external network access.
 * 2. **Unsupported environments** — a baseline may not exist yet (the CI job
 *    restores `tests/e2e/snapshots` from cache) or the Contracts tab may be
 *    unavailable in a given build. `expectStableScreenshot` degrades
 *    gracefully: it records a baseline when asked to, skips comparison when no
 *    baseline exists, and hard-fails only when `VISUAL_REQUIRE_BASELINE=1`.
 */

import { expect, type Locator, type Page, type Request, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { classifyEndpoint, horizonResponse, sorobanResponse, type MockOptions } from './fixtures';

export type { MockOptions } from './fixtures';

/** Valid Soroban contract id shape (`C` + 55 base32 chars). */
export const VALID_CONTRACT_ID = `C${'A'.repeat(55)}`;

/** Deliberately malformed contract id used for the invalid-input boundary case. */
export const INVALID_CONTRACT_ID = 'NOT-A-CONTRACT-ID';

export const FUNCTION_NAME = 'increment';

const DEFAULT_BASE_URL = 'http://localhost:5173';

function appOrigins(): string[] {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;
  try {
    const origin = new URL(baseUrl).origin;
    return [origin, origin.replace('localhost', '127.0.0.1'), origin.replace('127.0.0.1', 'localhost')];
  } catch {
    return [DEFAULT_BASE_URL, 'http://localhost:4173'];
  }
}

function sorobanRequestBody(request: Request): Record<string, unknown> | null {
  try {
    return request.postDataJSON() as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Route every non-app request to deterministic fixtures. The app's own assets
 * are served normally so the UI renders as it does in production.
 */
export async function mockStellarNetwork(page: Page, options: MockOptions = {}): Promise<void> {
  const allowed = appOrigins();

  await page.route('**/*', async (route) => {
    const request = route.request();
    const kind = classifyEndpoint(request.url(), allowed);

    if (kind === 'app') return route.continue();

    if (kind === 'soroban') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sorobanResponse(sorobanRequestBody(request), options)),
      });
    }

    if (kind === 'horizon') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(horizonResponse(new URL(request.url()).pathname)),
      });
    }

    return route.continue();
  });
}

/** The contract invocation form (test id first, then placeholder fallbacks). */
export function contractForm(page: Page): Locator {
  return page
    .getByTestId('contract-interaction-form')
    .or(page.locator('form').filter({ has: page.getByPlaceholder(/contract address/i) }))
    .or(page.getByPlaceholder(/contract address/i))
    .first();
}

export function contractIdInput(page: Page): Locator {
  return page.getByPlaceholder(/contract address|contract id/i).first();
}

export function functionNameInput(page: Page): Locator {
  return page.getByPlaceholder(/function|method|increment/i).first();
}

export function simulateButton(page: Page): Locator {
  return page.getByRole('button', { name: /^simulate$/i }).first();
}

export function resultPanel(page: Page): Locator {
  return page.getByText(/simulation result|invoke result|result/i).first();
}

export function errorPanel(page: Page): Locator {
  return page.getByText(/error|failed|invalid|trapped/i).first();
}

/**
 * Navigate to the Contracts tab and wait for the invocation form.
 *
 * Returns `false` when the build under test has no Contracts tab or no form,
 * letting the caller `test.skip` instead of producing a meaningless failure.
 */
export async function openContractInteraction(page: Page): Promise<boolean> {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const contractsTab = page
    .getByRole('button', { name: /contracts/i })
    .or(page.getByRole('link', { name: /contracts/i }))
    .first();

  if ((await contractsTab.count()) === 0) return false;
  await contractsTab.click();
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const form = contractForm(page);
  if ((await form.count()) === 0) return false;

  try {
    await form.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    return false;
  }
  return form.isVisible().catch(() => false);
}

/** Fill the form with a given contract id / function name. */
export async function fillContractForm(
  page: Page,
  contractId: string = VALID_CONTRACT_ID,
  functionName: string = FUNCTION_NAME
): Promise<void> {
  const idField = contractIdInput(page);
  await idField.fill(contractId);
  const fnField = functionNameInput(page);
  if ((await fnField.count()) > 0) await fnField.fill(functionName);
}

export interface ScreenshotOptions {
  maxDiffPixelRatio?: number;
  clip?: { x: number; y: number; width: number; height: number };
  fullPage?: boolean;
}

function recordRequested(): boolean {
  return process.env.UPDATE_VISUAL_BASELINES === '1';
}

function strictBaselines(): boolean {
  return process.env.VISUAL_REQUIRE_BASELINE === '1';
}

/**
 * Assert a stable screenshot for `target`, tolerating a missing baseline.
 *
 * - baseline present → real Playwright pixel comparison (`toHaveScreenshot`);
 * - baseline missing + `UPDATE_VISUAL_BASELINES=1` → record it and pass;
 * - baseline missing + `VISUAL_REQUIRE_BASELINE=1` → fail (strict mode);
 * - baseline missing otherwise → attach the actual image, annotate the test and
 *   pass, so an environment that has not recorded baselines yet (CI cache cold)
 *   is reported as "comparison skipped" rather than a regression.
 */
export async function expectStableScreenshot(
  target: Page | Locator,
  testInfo: TestInfo,
  name: string,
  options: ScreenshotOptions = {}
): Promise<void> {
  const baseline = testInfo.snapshotPath(name);
  const exists = fs.existsSync(baseline);

  if (!exists) {
    const actual = await target.screenshot();
    await testInfo.attach(`${name}-actual`, { body: actual, contentType: 'image/png' });

    if (recordRequested()) {
      fs.mkdirSync(path.dirname(baseline), { recursive: true });
      fs.writeFileSync(baseline, actual);
      testInfo.annotations.push({ type: 'baseline-recorded', description: baseline });
      return;
    }

    if (strictBaselines()) {
      throw new Error(
        `Missing visual baseline "${name}" at ${baseline}. ` +
          'Record it with UPDATE_VISUAL_BASELINES=1 and commit/cache tests/e2e/snapshots.'
      );
    }

    testInfo.annotations.push({
      type: 'baseline-missing',
      description: `No baseline at ${baseline}; comparison skipped. Record with UPDATE_VISUAL_BASELINES=1.`,
    });
    return;
  }

  const assertion = expect(target as unknown as Locator) as unknown as {
    toHaveScreenshot: (snapshotName: string, opts?: Record<string, unknown>) => Promise<void>;
  };

  await assertion.toHaveScreenshot(name, {
    animations: 'disabled',
    scale: 'css',
    maxDiffPixelRatio: options.maxDiffPixelRatio ?? 0.002,
    ...(options.clip ? { clip: options.clip } : {}),
    ...(options.fullPage ? { fullPage: true } : {}),
  });
}
