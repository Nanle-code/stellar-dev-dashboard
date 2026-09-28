import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * E2E tests for DEX strict-send path payment construction and preview (#893).
 *
 * Covers:
 *  - Happy path: two routes returned, best quote card renders correctly
 *  - Happy path: single direct route (zero intermediate hops)
 *  - Boundary: minimum valid amount (0.0000001 XLM — seven decimal places)
 *  - Boundary: long asset code at the 12-character limit
 *  - Failure: Horizon returns HTTP 400 (no path found)
 *  - Failure: network/fetch error reaching Horizon
 *  - Invalid input: empty amount blocked before network call
 *  - Invalid input: credit asset with missing issuer blocked before network call
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TESTNET_ACCOUNT = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

/**
 * A real-looking Stellar G-address used as a fake asset issuer in fixtures.
 * It is 56 characters starting with G, which passes isValidPublicKey().
 */
const FAKE_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

/** Horizon strict-send path endpoint pattern. */
const STRICT_SEND_PATTERN = '**/paths/strict-send*';
/** Horizon strict-receive path endpoint pattern. */
const STRICT_RECEIVE_PATTERN = '**/paths/strict-receive*';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

/** Two valid strict-send path quote records (best quote first). */
const TWO_ROUTE_PAYLOAD = {
  _embedded: {
    records: [
      {
        source_asset_type: 'native',
        source_asset_code: 'XLM',
        source_amount: '100.0000000',
        destination_asset_type: 'credit_alphanum4',
        destination_asset_code: 'USDC',
        destination_asset_issuer: FAKE_ISSUER,
        destination_amount: '10.0000000',
        path: [
          { asset_type: 'credit_alphanum4', asset_code: 'yXLM', asset_issuer: FAKE_ISSUER },
        ],
      },
      {
        source_asset_type: 'native',
        source_asset_code: 'XLM',
        source_amount: '100.0000000',
        destination_asset_type: 'credit_alphanum4',
        destination_asset_code: 'USDC',
        destination_asset_issuer: FAKE_ISSUER,
        destination_amount: '9.8000000',
        path: [],
      },
    ],
  },
};

/** Single direct-route response (no intermediate hops). */
const SINGLE_ROUTE_PAYLOAD = {
  _embedded: {
    records: [
      {
        source_asset_type: 'native',
        source_asset_code: 'XLM',
        source_amount: '0.0000001',
        destination_asset_type: 'credit_alphanum4',
        destination_asset_code: 'USDC',
        destination_asset_issuer: FAKE_ISSUER,
        destination_amount: '0.0000001',
        path: [],
      },
    ],
  },
};

/** Long asset-code fixture — 12 characters at the alphanum12 limit. */
const LONG_CODE_PAYLOAD = {
  _embedded: {
    records: [
      {
        source_asset_type: 'native',
        source_asset_code: 'XLM',
        source_amount: '50.0000000',
        destination_asset_type: 'credit_alphanum12',
        destination_asset_code: 'LONGASSET123',
        destination_asset_issuer: FAKE_ISSUER,
        destination_amount: '1.0000000',
        path: [],
      },
    ],
  },
};

/** Horizon 400 response — no path available. */
const HORIZON_400 = {
  status: 400,
  json: {
    type: 'https://stellar.org/horizon-errors/bad_request',
    title: 'Bad Request',
    status: 400,
    detail: 'No payment path found.',
    extras: {},
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to '/', mock common Horizon endpoints so unrelated calls don't
 * bleed into path-payment tests, and return to caller.
 */
async function gotoAndMockBase(page: Page): Promise<void> {
  // Stub account lookups and generic Horizon calls used by the overview.
  await page.route('**/horizon**.stellar.org/**', async (route: Route) => {
    const url = route.request().url();
    if (url.includes('/accounts/')) {
      await route.fulfill({
        status: 200,
        json: {
          account_id: TESTNET_ACCOUNT,
          balances: [{ asset_type: 'native', balance: '1000.0000000' }],
          sequence: '1',
          thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 1 },
          flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
        },
      });
    } else if (url.includes('/transactions')) {
      await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
    } else if (url.includes('/operations')) {
      await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
    } else if (url.includes('/paths/')) {
      // Default: pass through to per-test overrides; if no override is set the
      // test that forgot to stub will get a clear "unhandled" network error.
      await route.continue();
    } else {
      await route.continue();
    }
  });

  // Stub price API so the overview doesn't fail loudly.
  await page.route('**/api/v3/simple/price*', async (route: Route) => {
    await route.fulfill({ status: 200, json: { stellar: { usd: 0.1 } } });
  });

  await page.goto('/');
}

/** Connect an account and wait until the dashboard shell is visible. */
async function connectAccount(page: Page): Promise<void> {
  await page.getByPlaceholder(/G\.\.\. public key/i).fill(TESTNET_ACCOUNT);
  await page.getByRole('button', { name: /connect/i }).click();
  // The dashboard renders at least one of these headings once account data loads.
  await expect(
    page.getByText(/Account Detail|Overview/i).first(),
  ).toBeVisible({ timeout: 30_000 });
}

/** Navigate to the Path Explorer tab. */
async function openPathExplorer(page: Page): Promise<void> {
  const pathTab = page.getByRole('button', { name: /path/i }).first();
  await pathTab.click();
  // The tab heading is rendered by PathExplorer.tsx.
  await expect(page.getByRole('heading', { name: /path explorer/i })).toBeVisible({ timeout: 15_000 });
}

/**
 * Fill in a strict-send quote request for XLM → credit asset.
 *
 * Assumptions about the PathExplorer form layout (from PathExplorer.tsx):
 *  - Mode select: aria-label not set, but default value is 'strict-send'; we
 *    leave it unchanged for strict-send tests.
 *  - Amount: unlabelled input with placeholder "100.0000000".
 *  - Destination asset type: `<select aria-label="Destination asset type">` (value "credit").
 *  - Destination asset code: `<input aria-label="Destination asset code">`.
 *  - Destination asset issuer: `<input aria-label="Destination asset issuer">`.
 *  - Submit: `<button type="submit">Find paths</button>`.
 */
async function fillStrictSendForm(
  page: Page,
  opts: { amount: string; destCode: string; destIssuer?: string },
): Promise<void> {
  // Amount input — identified by its placeholder.
  await page.getByPlaceholder('100.0000000').fill(opts.amount);

  // Switch destination asset to "credit" so code + issuer inputs appear.
  await page.getByLabel('Destination asset type').selectOption('credit');

  // Fill asset code.
  await page.getByLabel('Destination asset code').fill(opts.destCode);

  // Fill issuer if provided.
  if (opts.destIssuer) {
    await page.getByLabel('Destination asset issuer').fill(opts.destIssuer);
  }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

test.describe('DEX Path Payment — Strict Send', () => {
  // ── Happy path: two routes returned ──────────────────────────────────────
  test.describe('Happy path — two routes', () => {
    test.beforeEach(async ({ page }) => {
      await gotoAndMockBase(page);

      // Intercept the strict-send call and return two quote records.
      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.fulfill({ status: 200, json: TWO_ROUTE_PAYLOAD });
      });

      await connectAccount(page);
      await openPathExplorer(page);
    });

    test('renders the best quote card after a successful strict-send search', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      // The quote section heading appears once results are loaded.
      const quotesSection = page.getByRole('region', { name: /path quotes/i });
      await expect(quotesSection).toBeVisible({ timeout: 15_000 });

      // The first card must be labelled "Best quote".
      await expect(page.getByText('Best quote')).toBeVisible();
    });

    test('displays the destination amount for the best route', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // The best quote destination amount from the fixture is 10.0000000 USDC.
      await expect(page.getByText(/10\.0000000/)).toBeVisible();
    });

    test('shows the correct total number of quotes returned', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // QuoteCard renders "(N total)" next to the card header.
      await expect(page.getByText(/2 total/i)).toBeVisible();
    });

    test('displays the hop route for the best path', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // The best route goes through yXLM — the route string must mention it.
      await expect(page.getByText(/yXLM/i)).toBeVisible();
    });

    test('displays slippage percentage for the second quote', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // The second quote has destination_amount 9.8 vs best 10.0 → slippage 2.00%.
      await expect(page.getByText(/2\.00%/)).toBeVisible();
    });

    test('does not show an error banner on a successful fetch', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('loading indicator disappears once results render', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // "Searching..." / "Searching for payment paths..." must be gone.
      await expect(page.getByText(/searching/i)).toHaveCount(0);
    });
  });

  // ── Happy path: single direct route (zero hops) ──────────────────────────
  test.describe('Happy path — single direct route', () => {
    test.beforeEach(async ({ page }) => {
      await gotoAndMockBase(page);

      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.fulfill({ status: 200, json: SINGLE_ROUTE_PAYLOAD });
      });

      await connectAccount(page);
      await openPathExplorer(page);
    });

    test('renders a single best-quote card with zero hops', async ({ page }) => {
      await fillStrictSendForm(page, {
        amount: '0.0000001',
        destCode: 'USDC',
        destIssuer: FAKE_ISSUER,
      });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // Only one quote; card header must say "1 total".
      await expect(page.getByText(/1 total/i)).toBeVisible();
    });

    test('shows "0 hops" for a direct route', async ({ page }) => {
      await fillStrictSendForm(page, {
        amount: '0.0000001',
        destCode: 'USDC',
        destIssuer: FAKE_ISSUER,
      });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // QuoteCard renders "<N> hops" in the card header area.
      await expect(page.getByText(/0 hops/i)).toBeVisible();
    });

    test('shows 0.00% slippage when there is only one path', async ({ page }) => {
      await fillStrictSendForm(page, {
        amount: '0.0000001',
        destCode: 'USDC',
        destIssuer: FAKE_ISSUER,
      });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // With a single route, slippage is always 0.00%.
      await expect(page.getByText(/0\.00%/)).toBeVisible();
    });
  });

  // ── Boundary: minimum valid amount ───────────────────────────────────────
  test.describe('Boundary — minimum valid amount (0.0000001)', () => {
    test('accepts seven-decimal-place amount and fetches paths', async ({ page }) => {
      await gotoAndMockBase(page);

      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.fulfill({ status: 200, json: SINGLE_ROUTE_PAYLOAD });
      });

      await connectAccount(page);
      await openPathExplorer(page);

      await fillStrictSendForm(page, {
        amount: '0.0000001',
        destCode: 'USDC',
        destIssuer: FAKE_ISSUER,
      });
      await page.getByRole('button', { name: /find paths/i }).click();

      // A successful fetch must render the quotes section — not an error.
      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('alert')).toHaveCount(0);
    });
  });

  // ── Boundary: 12-character asset code ────────────────────────────────────
  test.describe('Boundary — 12-character asset code', () => {
    test('accepts a 12-character alphanum12 destination asset code', async ({ page }) => {
      await gotoAndMockBase(page);

      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.fulfill({ status: 200, json: LONG_CODE_PAYLOAD });
      });

      await connectAccount(page);
      await openPathExplorer(page);

      await fillStrictSendForm(page, {
        amount: '50',
        destCode: 'LONGASSET123',
        destIssuer: FAKE_ISSUER,
      });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // The destination amount from the fixture is 1.0000000 LONGASSET123.
      await expect(page.getByText(/LONGASSET123/)).toBeVisible();
    });
  });

  // ── Failure: Horizon HTTP 400 ─────────────────────────────────────────────
  test.describe('Failure — Horizon 400 (no path found)', () => {
    test.beforeEach(async ({ page }) => {
      await gotoAndMockBase(page);

      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.fulfill(HORIZON_400);
      });

      await connectAccount(page);
      await openPathExplorer(page);
    });

    test('shows an error alert when Horizon returns 400', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      // PathExplorer.tsx renders a role="alert" div with the error message.
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    });

    test('error message mentions the Horizon status code', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });

      // fetchPaymentPaths() surfaces "Horizon could not produce a path quote (400)."
      await expect(page.getByRole('alert')).toContainText('400');
    });

    test('does not render any quote cards on a 400 error', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });

      // No quote section should appear.
      await expect(page.getByRole('region', { name: /path quotes/i })).toHaveCount(0);
    });

    test('loading indicator is gone after a 400 error', async ({ page }) => {
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/searching/i)).toHaveCount(0);
    });
  });

  // ── Failure: network / fetch error ───────────────────────────────────────
  test.describe('Failure — network error (Horizon unreachable)', () => {
    test('shows an error alert when the network request is aborted', async ({ page }) => {
      await gotoAndMockBase(page);

      // Abort the strict-send request to simulate Horizon being unreachable.
      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.abort('failed');
      });

      await connectAccount(page);
      await openPathExplorer(page);

      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    });

    test('error message advises checking connection when fetch fails', async ({ page }) => {
      await gotoAndMockBase(page);

      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.abort('failed');
      });

      await connectAccount(page);
      await openPathExplorer(page);

      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });

      // fetchPaymentPaths() throws PathPaymentError('REQUEST_FAILED',
      // 'Could not reach Horizon. Check your connection and try again.')
      await expect(page.getByRole('alert')).toContainText(/connection/i);
    });
  });

  // ── Invalid input: empty amount ───────────────────────────────────────────
  test.describe('Invalid input — empty or zero amount', () => {
    /**
     * Tracks whether Horizon was actually called. Any call that reaches
     * the stub means client-side validation did NOT block the request.
     */
    async function trackHorizonCall(page: Page): Promise<{ wasCalled: () => boolean }> {
      let called = false;
      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        called = true;
        await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
      });
      await page.route(STRICT_RECEIVE_PATTERN, async (route: Route) => {
        called = true;
        await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
      });
      return { wasCalled: () => called };
    }

    test('empty amount shows an error and does not call Horizon', async ({ page }) => {
      await gotoAndMockBase(page);
      const tracker = await trackHorizonCall(page);

      await connectAccount(page);
      await openPathExplorer(page);

      // Leave amount blank; only set destination asset.
      await page.getByLabel('Destination asset type').selectOption('credit');
      await page.getByLabel('Destination asset code').fill('USDC');
      await page.getByLabel('Destination asset issuer').fill(FAKE_ISSUER);

      await page.getByRole('button', { name: /find paths/i }).click();

      // fetchPaymentPaths() validation throws INVALID_INPUT for a non-positive amount.
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
      expect(tracker.wasCalled()).toBe(false);
    });

    test('zero amount shows an error and does not call Horizon', async ({ page }) => {
      await gotoAndMockBase(page);
      const tracker = await trackHorizonCall(page);

      await connectAccount(page);
      await openPathExplorer(page);

      await fillStrictSendForm(page, { amount: '0', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
      expect(tracker.wasCalled()).toBe(false);
    });

    test('amount with more than seven decimal places shows an error', async ({ page }) => {
      await gotoAndMockBase(page);
      const tracker = await trackHorizonCall(page);

      await connectAccount(page);
      await openPathExplorer(page);

      // Eight decimal places — should fail the /^\d+(\.\d{1,7})?$/ regex.
      await fillStrictSendForm(page, {
        amount: '1.00000001',
        destCode: 'USDC',
        destIssuer: FAKE_ISSUER,
      });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
      expect(tracker.wasCalled()).toBe(false);
    });
  });

  // ── Invalid input: credit asset with missing issuer ───────────────────────
  test.describe('Invalid input — credit asset with no issuer', () => {
    test('shows an error and does not call Horizon when issuer is blank', async ({ page }) => {
      await gotoAndMockBase(page);
      let horizonCalled = false;
      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        horizonCalled = true;
        await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
      });

      await connectAccount(page);
      await openPathExplorer(page);

      // Fill amount and dest code but deliberately omit the issuer.
      await fillStrictSendForm(page, {
        amount: '100',
        destCode: 'USDC',
        // destIssuer intentionally omitted
      });
      await page.getByRole('button', { name: /find paths/i }).click();

      // validateAsset() in fetchPaymentPaths() throws INVALID_INPUT for a missing issuer.
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
      expect(horizonCalled).toBe(false);
    });

    test('error message references the issuer field', async ({ page }) => {
      await gotoAndMockBase(page);
      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.fulfill({ status: 200, json: { _embedded: { records: [] } } });
      });

      await connectAccount(page);
      await openPathExplorer(page);

      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC' });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
      // fetchPaymentPaths throws: "Destination asset issuer must be a valid Stellar G address."
      await expect(page.getByRole('alert')).toContainText(/issuer/i);
    });
  });

  // ── State reset between searches ─────────────────────────────────────────
  test.describe('State management — reset between searches', () => {
    test('clears previous results when a new search is started', async ({ page }) => {
      await gotoAndMockBase(page);

      // First call returns two routes.
      let callCount = 0;
      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        callCount++;
        if (callCount === 1) {
          await route.fulfill({ status: 200, json: TWO_ROUTE_PAYLOAD });
        } else {
          // Second call returns a Horizon 400 so we can verify the results
          // section is gone rather than stale.
          await route.fulfill(HORIZON_400);
        }
      });

      await connectAccount(page);
      await openPathExplorer(page);

      // First search — results appear.
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();
      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });

      // Second search — an error clears the previous results.
      await page.getByRole('button', { name: /find paths/i }).click();
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('region', { name: /path quotes/i })).toHaveCount(0);
    });

    test('clears error when a successful search follows a failed one', async ({ page }) => {
      await gotoAndMockBase(page);

      let callCount = 0;
      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        callCount++;
        if (callCount === 1) {
          await route.fulfill(HORIZON_400);
        } else {
          await route.fulfill({ status: 200, json: TWO_ROUTE_PAYLOAD });
        }
      });

      await connectAccount(page);
      await openPathExplorer(page);

      // First search — error.
      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });

      // Second search — success must remove the error banner.
      await page.getByRole('button', { name: /find paths/i }).click();
      await expect(page.getByRole('region', { name: /path quotes/i })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('alert')).toHaveCount(0);
    });
  });

  // ── Empty response (no liquid path) ──────────────────────────────────────
  test.describe('Empty response — no liquid path', () => {
    test('shows the "no path found" empty state message', async ({ page }) => {
      await gotoAndMockBase(page);

      // Horizon responds 200 with zero records.
      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.fulfill({
          status: 200,
          json: { _embedded: { records: [] } },
        });
      });

      await connectAccount(page);
      await openPathExplorer(page);

      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      // PathExplorer.tsx renders: "No liquid payment path was found for these assets and amount."
      await expect(
        page.getByText(/no liquid payment path/i),
      ).toBeVisible({ timeout: 15_000 });
    });

    test('does not render any quote cards for an empty response', async ({ page }) => {
      await gotoAndMockBase(page);

      await page.route(STRICT_SEND_PATTERN, async (route: Route) => {
        await route.fulfill({
          status: 200,
          json: { _embedded: { records: [] } },
        });
      });

      await connectAccount(page);
      await openPathExplorer(page);

      await fillStrictSendForm(page, { amount: '100', destCode: 'USDC', destIssuer: FAKE_ISSUER });
      await page.getByRole('button', { name: /find paths/i }).click();

      await expect(page.getByText(/no liquid payment path/i)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('region', { name: /path quotes/i })).toHaveCount(0);
    });
  });
});
