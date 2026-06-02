import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration (#99).
 *
 * Runs against the Vite dev server. Specs live under tests/e2e and are
 * excluded from the unit-test runner (vitest/jest).
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
  // Visual regression snapshot settings
  snapshotDir: './tests/e2e/snapshots',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}-{projectName}{ext}',
  expect: {
    // Allow up to 0.2% pixel difference to reduce false positives from anti-aliasing
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
      scale: 'css',
    },
  },
  projects: [
    // Visual regression runs on chromium only for baseline consistency
    {
      name: 'visual',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Disable CSS transitions/animations for stable screenshots
        contextOptions: { reducedMotion: 'reduce' },
      },
      testMatch: '**/visual.spec.*',
    },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: '**/visual.spec.*' },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] }, testIgnore: '**/visual.spec.*' },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] }, testIgnore: '**/visual.spec.*' },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, testIgnore: '**/visual.spec.*' },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_BASE_URL ? 'npm run preview' : 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
