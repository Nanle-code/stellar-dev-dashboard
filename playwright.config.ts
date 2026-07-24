import { defineConfig, devices } from '@playwright/test';
import { VISUAL_VIEWPORTS, VISUAL_DIFF_THRESHOLD } from './tests/visual/viewports';

/**
 * Playwright E2E configuration (#99, D-024).
 *
 * Visual regression uses dedicated per-viewport projects (mobile/tablet/desktop/wide).
 * Accessibility gate runs via the `a11y` project with axe-core.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'tests/e2e/report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'tests/e2e/report', open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  snapshotDir: './tests/e2e/snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}-{projectName}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: VISUAL_DIFF_THRESHOLD,
      animations: 'disabled',
      scale: 'css',
    },
  },
  projects: [
    // ── Visual regression — one project per viewport for baseline consistency ──
    ...(['mobile', 'tablet', 'desktop', 'wide'] as const).map((name) => ({
      name: `visual-${name}`,
      use: {
        ...devices['Desktop Chrome'],
        viewport: {
          width: VISUAL_VIEWPORTS[name].width,
          height: VISUAL_VIEWPORTS[name].height,
        },
        contextOptions: { reducedMotion: 'reduce' as const },
      },
      testMatch: '**/visual.spec.*',
    })),

    // ── Accessibility gate — axe-core WCAG 2.1 AA ─────────────────────────────
    {
      name: 'a11y',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/a11y-gate.spec.*',
    },

    // ── Standard E2E (exclude visual + a11y gate specs) ─────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/visual.spec.*', '**/a11y-gate.spec.*'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: ['**/visual.spec.*', '**/a11y-gate.spec.*'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: ['**/visual.spec.*', '**/a11y-gate.spec.*'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testIgnore: ['**/visual.spec.*', '**/a11y-gate.spec.*'],
    },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_BASE_URL ? 'npm run preview' : 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
