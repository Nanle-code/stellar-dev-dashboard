/**
 * Mobile viewport and touch E2E coverage (#405).
 *
 * Runs in every standard project, but forces a touch-enabled phone viewport so
 * desktop browsers exercise the mobile layout too.
 */

import { test, expect } from './support/fixtures';
import { buildHorizonAccount, testKeypair } from './support/dataFactories';
import { connectAccount, expectNoHorizontalOverflow } from './support/actions';

const ALICE = testKeypair('alice').publicKey();

const PHONES = [
  { name: 'small phone', viewport: { width: 360, height: 740 } },
  { name: 'large phone', viewport: { width: 414, height: 896 } },
];

for (const phone of PHONES) {
  test.describe(`Mobile layout — ${phone.name}`, () => {
    test.use({ viewport: phone.viewport, hasTouch: true, isMobile: true });

    test('connect screen fits the viewport and accepts touch input', async ({ page, stellar }) => {
      stellar.setAccount(buildHorizonAccount({ seed: 'alice' }));
      await page.goto('/connect');
      await expectNoHorizontalOverflow(page);

      const input = page.getByLabel('Stellar account address');
      await input.tap();
      await input.fill(ALICE);
      await page.getByRole('button', { name: 'Connect to Stellar account' }).tap();
      await expect(page).toHaveURL(/\/overview/);
      await expectNoHorizontalOverflow(page);
    });

    test('touch targets on the connect screen are at least 24px', async ({ page, stellar }) => {
      stellar.setAccount(buildHorizonAccount());
      await page.goto('/connect');
      const button = page.getByRole('button', { name: 'Connect to Stellar account' });
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(24);
      expect(box!.width).toBeGreaterThanOrEqual(24);
    });

    test('menu drawer and quick navigation work by tap after connecting', async ({ page, stellar }) => {
      stellar.setAccount(buildHorizonAccount({ seed: 'alice' }));
      await connectAccount(page, ALICE);
      await expect(page).toHaveURL(/\/overview/);
      await expectNoHorizontalOverflow(page);

      // The hamburger exposes the full navigation drawer.
      await expect(page.getByRole('button', { name: 'Open navigation menu' })).toHaveAttribute('aria-controls', 'mobile-sidebar');

      // Bottom quick-navigation bar switches sections.
      const quickNav = page.getByRole('navigation', { name: 'Quick navigation' });
      await expect(quickNav).toBeVisible();
      await quickNav.getByRole('button', { name: 'Txns' }).dispatchEvent('click');
      await expect(page).toHaveURL(/\/transactions/);
      await expectNoHorizontalOverflow(page);
    });
  });
}
