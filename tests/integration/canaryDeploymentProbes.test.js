/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { app } from '../../api/server.js';
import { _setSimulatedFailure, _resetSimulatedFailure } from '../../api/routes/health.js';
import { runCanaryHealthProbes } from '../../scripts/canary-health-probe.mjs';

describe('Canary Deployment Live Probes Integration', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    _resetSimulatedFailure();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('primary flow: probes all critical live API routes successfully within error budget', async () => {
    _resetSimulatedFailure();

    const report = await runCanaryHealthProbes({
      url: baseUrl,
      errorBudget: 0.05,
      latencyBudgetMs: 3000,
      iterations: 2,
      intervalMs: 50,
      authToken: 'test-token-valid-12345',
    });

    expect(report.success).toBe(true);
    expect(report.aborted).toBe(false);
    expect(report.metrics.errorRate).toBe(0);
    expect(report.metrics.failedRequests).toBe(0);
    expect(report.metrics.totalRequests).toBeGreaterThanOrEqual(12);
  });

  it('failure case: triggers auto-abort when live server encounters error budget breach', async () => {
    // Inject 503 into deep health check
    _setSimulatedFailure({
      statusCode: 503,
      message: 'Simulated infrastructure partition',
    });

    let abortCallbackFired = false;
    const mockAbortCommand = async () => {
      abortCallbackFired = true;
    };

    const report = await runCanaryHealthProbes(
      {
        url: baseUrl,
        errorBudget: 0.05,
        iterations: 2,
        intervalMs: 10,
        abortCommand: 'mock-abort-rollback',
      },
      globalThis.fetch,
      mockAbortCommand
    );

    expect(report.success).toBe(false);
    expect(report.aborted).toBe(true);
    expect(report.abortReason).toContain('Error budget breached');
    expect(abortCallbackFired).toBe(true);

    _resetSimulatedFailure();
  });
});
