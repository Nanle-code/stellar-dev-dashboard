/**
 * Common UI actions for E2E tests (#405). Selectors use accessible names so
 * they survive styling changes.
 */

import { expect, type Page } from '@playwright/test';

/** Open the connect screen, enter an address and press Connect. */
export async function connectAccount(page: Page, address: string): Promise<void> {
  await page.goto('/connect');
  const input = page.getByLabel('Stellar account address');
  await expect(input).toBeVisible();
  await input.fill(address);
  // Keyboard activation avoids flakiness from first-run overlays animating over the button.
  await page.getByRole('button', { name: 'Connect to Stellar account' }).press('Enter');
}

/**
 * Navigate to a dashboard route *inside* the running app. `page.goto` would
 * reload the page and drop the in-memory session (connected account), which
 * redirects back to /connect, so push the URL through the History API and let
 * React Router pick it up.
 */
export async function openRoute(page: Page, route: string): Promise<void> {
  if (!/^https?:/.test(page.url())) await page.goto('/connect');
  await page.evaluate((path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
}

/** Open a section from the sidebar by its visible title. */
export async function openSection(page: Page, title: string): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Dashboard sections' });
  await nav.getByRole('button', { name: title, exact: true }).click();
}

/** Fail if the page scrolls horizontally, the usual symptom of a broken responsive layout. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);
}
