import { test, expect } from '@playwright/test';

/**
 * Visual regression tests — snapshots are stored in tests/e2e/snapshots/
 * Run `npm run test:visual:update` to update baselines.
 *
 * All tests run on the 'visual' Playwright project (chromium 1280x800, reduced-motion)
 * so screenshots are deterministic across runs.
 */

const TESTNET_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

/** Wait for the page to be visually stable (no pending network or animations). */
async function waitForStable(page) {
  await page.waitForLoadState('networkidle');
  // Extra tick so CSS transitions triggered by load finish
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Connect Panel (unauthenticated landing)
// ---------------------------------------------------------------------------

test.describe('Connect Panel', () => {
  test('default state', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('connect-panel.png');
  });

  test('invalid key error state', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox').fill('BADKEY');
    await page.getByRole('button', { name: /connect/i }).click();
    await waitForStable(page);
    await expect(page).toHaveScreenshot('connect-panel-error.png');
  });
});

// ---------------------------------------------------------------------------
// Sidebar & Layout
// ---------------------------------------------------------------------------

test.describe('Layout', () => {
  test('sidebar', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
    await expect(page.locator('aside')).toHaveScreenshot('sidebar.png');
  });

  test('price ticker bar', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
    // The price ticker is the first child of the main layout header area
    const ticker = page.locator('[data-testid="price-ticker"], .price-ticker').first();
    if (await ticker.count()) {
      await expect(ticker).toHaveScreenshot('price-ticker.png');
    } else {
      // Fallback: top 80px strip of the viewport
      await expect(page).toHaveScreenshot('price-ticker-fallback.png', {
        clip: { x: 0, y: 0, width: 1280, height: 80 },
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Tabs (navigated via sidebar)
// ---------------------------------------------------------------------------

test.describe('Dashboard tabs', () => {
  const tabs = [
    { label: /network stats/i, snapshot: 'tab-network-stats.png' },
    { label: /wallet/i,        snapshot: 'tab-wallet.png' },
    { label: /faucet/i,        snapshot: 'tab-faucet.png' },
    { label: /explorer/i,      snapshot: 'tab-explorer.png' },
  ];

  for (const { label, snapshot } of tabs) {
    test(`${snapshot}`, async ({ page }) => {
      await page.goto('/');
      await waitForStable(page);
      const btn = page.getByRole('button', { name: label }).or(page.getByRole('link', { name: label })).first();
      if (await btn.count()) {
        await btn.click();
        await waitForStable(page);
      }
      await expect(page).toHaveScreenshot(snapshot);
    });
  }
});

// ---------------------------------------------------------------------------
// Connected account views (uses Testnet public key — read-only, no auth needed)
// ---------------------------------------------------------------------------

test.describe('Connected account views', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox').fill(TESTNET_KEY);
    await page.getByRole('button', { name: /connect/i }).click();
    await waitForStable(page);
  });

  test('overview', async ({ page }) => {
    await expect(page).toHaveScreenshot('overview-connected.png');
  });

  test('account detail', async ({ page }) => {
    const btn = page.getByRole('button', { name: /account/i }).or(page.getByRole('link', { name: /^account$/i })).first();
    if (await btn.count()) {
      await btn.click();
      await waitForStable(page);
    }
    await expect(page).toHaveScreenshot('account-detail.png');
  });

  test('transactions', async ({ page }) => {
    const btn = page.getByRole('button', { name: /transactions/i }).or(page.getByRole('link', { name: /transactions/i })).first();
    if (await btn.count()) {
      await btn.click();
      await waitForStable(page);
    }
    await expect(page).toHaveScreenshot('transactions.png');
  });
});

// ---------------------------------------------------------------------------
// Theme variants
// ---------------------------------------------------------------------------

test.describe('Themes', () => {
  test('dark theme (default)', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
    await expect(page).toHaveScreenshot('theme-dark.png');
  });

  test('light theme', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
    // Toggle theme if the button exists
    const toggle = page.getByRole('button', { name: /light|theme|toggle/i }).first();
    if (await toggle.count()) {
      await toggle.click();
      await waitForStable(page);
    } else {
      // Force via attribute so the snapshot still runs
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      await page.waitForTimeout(100);
    }
    await expect(page).toHaveScreenshot('theme-light.png');
  });
});

// ---------------------------------------------------------------------------
// Responsive — all 3 viewports for major widgets
// ---------------------------------------------------------------------------

const VIEWPORTS = [
  { name: 'mobile',  width: 375,  height: 667 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const WIDGET_TABS = [
  { tab: /overview/i,        snapshot: 'overview' },
  { tab: /account/i,         snapshot: 'account' },
  { tab: /transactions/i,    snapshot: 'transactions' },
  { tab: /network stats/i,   snapshot: 'network-stats' },
  { tab: /dex|explorer/i,    snapshot: 'dex-explorer' },
  { tab: /path/i,            snapshot: 'path-explorer' },
  { tab: /real.?time|ledger/i, snapshot: 'real-time-ledger' },
  { tab: /comparison/i,      snapshot: 'account-comparison' },
  { tab: /portfolio/i,       snapshot: 'portfolio-value' },
];

for (const vp of VIEWPORTS) {
  test.describe(`Viewport ${vp.name} (${vp.width}×${vp.height})`, () => {
    test('connect panel', async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await waitForStable(page);
      await expect(page).toHaveScreenshot(`${vp.name}-connect.png`);
    });

    for (const { tab, snapshot } of WIDGET_TABS) {
      test(`widget: ${snapshot}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');
        await waitForStable(page);
        // Try to connect first so authenticated tabs render content
        const input = page.getByRole('textbox').first();
        if (await input.count()) {
          await input.fill(TESTNET_KEY);
          await page.getByRole('button', { name: /connect/i }).first().click();
          await waitForStable(page);
        }
        const btn = page
          .getByRole('button', { name: tab })
          .or(page.getByRole('link', { name: tab }))
          .first();
        if (await btn.count()) {
          await btn.click();
          await waitForStable(page);
        }
        await expect(page).toHaveScreenshot(`${vp.name}-${snapshot}.png`);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Multisig (kept from original spec)
// ---------------------------------------------------------------------------

test.describe('Multisig', () => {
  test('setup panel', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
    const btn = page.getByRole('button', { name: /multisig/i }).first();
    if (await btn.count()) {
      await btn.click();
      await waitForStable(page);
    }
    await expect(page).toHaveScreenshot('multisig-setup.png');
  });

  test('sessions panel', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);
    const ms = page.getByRole('button', { name: /multisig/i }).first();
    if (await ms.count()) {
      await ms.click();
      const sessions = page.getByRole('button', { name: /sessions/i }).first();
      if (await sessions.count()) {
        await sessions.click();
      }
      await waitForStable(page);
    }
    await expect(page).toHaveScreenshot('multisig-sessions.png');
  });
});
