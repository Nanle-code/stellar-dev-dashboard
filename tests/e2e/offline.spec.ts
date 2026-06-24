import { test, expect } from '@playwright/test';

test.describe('offline queue and conflict resolution', () => {
  test('caches page, queues offline request, and syncs on reconnect', async ({ page }) => {
    let requestCount = 0;
    await page.route('**/api/test-offline', async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/');
    await page.locator('button[title="User Preferences"]').waitFor({ state: 'visible', timeout: 10000 });
    const swResponse = await page.request.get('/sw.js');
    expect(swResponse.status()).toBe(200);

    const queueLength = await page.evaluate(async () => {
      const { queueRequest, getQueue } = await import('/src/lib/offlineQueue.js');
      await queueRequest({
        url: '/api/test-offline',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: { value: 'local', updatedAt: Date.now() },
        version: 'v1',
      });
      const queue = await getQueue();
      return queue.length;
    });
    expect(queueLength).toBe(1);

    await page.context().setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('text=You are offline')).toBeVisible();
    expect(requestCount).toBe(0);

    const syncRequestPromise = page.waitForRequest((request) => request.url().endsWith('/api/test-offline'), { timeout: 15000 });
    await page.context().setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    await syncRequestPromise;
    const remaining = await page.evaluate(async () => {
      const { getQueue } = await import('/src/lib/offlineQueue.js');
      const queue = await getQueue();
      return queue.length;
    });
    expect(remaining).toBe(0);
  });

  test('detects conflict and allows user resolution', async ({ page }) => {
    let requestCount = 0;
    let resolveHeaders = {};

    await page.route('**/api/conflict', async (route, request) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify('remote'),
        });
        return;
      }
      resolveHeaders = request.headers();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/');
    await page.locator('button[title="User Preferences"]').waitFor({ state: 'visible', timeout: 10000 });
    const swResponse = await page.request.get('/sw.js');
    expect(swResponse.status()).toBe(200);

    await page.evaluate(async () => {
      window.__conflicts = [];
      const { onQueueEvent, queueRequest } = await import('/src/lib/offlineQueue.js');
      onQueueEvent((detail) => window.__conflicts.push(detail));
      await queueRequest({
        url: '/api/conflict',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'local',
        version: 'v1',
      });
    });

    await page.context().setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('text=You are offline')).toBeVisible();

    const conflictRequestPromise = page.waitForRequest((request) => request.url().endsWith('/api/conflict'), { timeout: 15000 });
    await page.context().setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true);
    await conflictRequestPromise;

    await page.waitForFunction(
      () => window.__conflicts && window.__conflicts.some((detail) => detail.type === 'conflict'),
      null,
      { timeout: 15000 }
    );
    await expect(page.locator('text=Open Resolver')).toBeVisible();
    await page.click('text=Open Resolver');
    await expect(page.locator('text=Conflict Resolver')).toBeVisible();

    await page.evaluate(async () => {
      const conflicts = window.__conflicts;
      const { resolveConflict } = await import('/src/lib/offlineQueue.js');
      await resolveConflict(conflicts[0].id, { type: 'accept-local' });
    });

    expect(resolveHeaders['x-conflict-resolution']).toBe('accept-local');
  });
});
