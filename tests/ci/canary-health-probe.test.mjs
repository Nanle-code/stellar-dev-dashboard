import { describe, it, expect, vi } from 'vitest';
import {
  parseArgs,
  probeRoute,
  calculateMetrics,
  runCanaryHealthProbes,
  InvalidInputError,
  UnsupportedEnvironmentError,
  DEFAULT_CRITICAL_ROUTES,
} from '../../scripts/canary-health-probe.mjs';

function createMockFetch(routeResponses = {}) {
  return vi.fn(async (url, options = {}) => {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    const handler = routeResponses[pathname] || routeResponses['default'];

    if (!handler) {
      return {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          status: 'ok',
          apiVersion: '1.0.0',
          id: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
          data: [],
          predictedTotalFee: 120,
        }),
        text: async () => 'ok',
      };
    }

    if (typeof handler === 'function') {
      return handler(url, options);
    }

    const {
      status = 200,
      body = { status: 'ok' },
      headers = { 'content-type': 'application/json' },
    } = handler;
    return {
      status,
      headers: new Headers(headers),
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  });
}

describe('Canary Deployment Health Probes', () => {
  describe('Input Validation and Argument Parsing', () => {
    it('primary flow: parses valid CLI arguments and sets defaults', () => {
      const opts = parseArgs([
        '--url',
        'http://127.0.0.1:4001',
        '--error-budget',
        '0.08',
        '--latency-budget-ms',
        '1500',
        '--iterations',
        '4',
        '--interval-ms',
        '250',
        '--env',
        'canary',
        '--auth-token',
        'secret-canary-token',
        '--abort-command',
        'docker compose stop api-canary',
      ]);

      expect(opts.url).toBe('http://127.0.0.1:4001');
      expect(opts.errorBudget).toBe(0.08);
      expect(opts.latencyBudgetMs).toBe(1500);
      expect(opts.iterations).toBe(4);
      expect(opts.intervalMs).toBe(250);
      expect(opts.environment).toBe('canary');
      expect(opts.authToken).toBe('secret-canary-token');
      expect(opts.abortCommand).toBe('docker compose stop api-canary');
    });

    it('boundary case: accepts percentage string for error budget', () => {
      const opts1 = parseArgs(['--error-budget', '5%']);
      expect(opts1.errorBudget).toBe(0.05);

      const opts2 = parseArgs(['--error-budget', '0%']);
      expect(opts2.errorBudget).toBe(0);

      const opts3 = parseArgs(['--error-budget', '100%']);
      expect(opts3.errorBudget).toBe(1);
    });

    it('boundary case: accepts minimum iteration count of 1', () => {
      const opts = parseArgs(['--iterations', '1']);
      expect(opts.iterations).toBe(1);
    });

    it('failure case: rejects malformed or invalid URLs', () => {
      expect(() => parseArgs(['--url', 'not-a-valid-url'])).toThrow(InvalidInputError);
      expect(() => parseArgs(['--url', 'ftp://localhost:4000'])).toThrow(InvalidInputError);
    });

    it('failure case: rejects out-of-range or non-numeric error budgets', () => {
      expect(() => parseArgs(['--error-budget', '-0.1'])).toThrow(InvalidInputError);
      expect(() => parseArgs(['--error-budget', '1.5'])).toThrow(InvalidInputError);
      expect(() => parseArgs(['--error-budget', 'invalid'])).toThrow(InvalidInputError);
    });

    it('failure case: rejects invalid iterations count', () => {
      expect(() => parseArgs(['--iterations', '0'])).toThrow(InvalidInputError);
      expect(() => parseArgs(['--iterations', '-5'])).toThrow(InvalidInputError);
      expect(() => parseArgs(['--iterations', '2.5'])).toThrow(InvalidInputError);
      expect(() => parseArgs(['--iterations', 'abc'])).toThrow(InvalidInputError);
    });

    it('failure case: rejects invalid latency budget and timeouts', () => {
      expect(() => parseArgs(['--latency-budget-ms', '0'])).toThrow(InvalidInputError);
      expect(() => parseArgs(['--latency-budget-ms', '-100'])).toThrow(InvalidInputError);
      expect(() => parseArgs(['--timeout-ms', '-500'])).toThrow(InvalidInputError);
    });

    it('failure case: rejects unknown CLI flags', () => {
      expect(() => parseArgs(['--unknown-unsupported-flag'])).toThrow(InvalidInputError);
    });

    it('unsupported environment: rejects environments outside the supported matrix', () => {
      expect(() => parseArgs(['--env', 'sandbox'])).toThrow(UnsupportedEnvironmentError);
      expect(() => parseArgs(['--env', 'demo-env'])).toThrow(UnsupportedEnvironmentError);
      expect(() => parseArgs(['--env', 'unknown'])).toThrow(/unsupported environment/i);
    });

    it('supported environment: accepts valid deployment environments', () => {
      for (const env of ['production', 'staging', 'canary', 'test', 'development']) {
        const opts = parseArgs(['--env', env]);
        expect(opts.environment).toBe(env);
      }
    });
  });

  describe('Route Probing and Failure Paths', () => {
    it('primary flow: successfully probes an individual healthy route', async () => {
      const mockFetch = createMockFetch({
        '/health': { status: 200, body: { status: 'ok' } },
      });

      const route = {
        id: 'liveness',
        name: 'Liveness',
        path: '/health',
        method: 'GET',
        expectedStatus: 200,
        validate: (data) => data?.status === 'ok',
      };

      const result = await probeRoute('http://localhost:4000', route, {}, mockFetch);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data.status).toBe('ok');
      expect(typeof result.latencyMs).toBe('number');
    });

    it('failure path: handles HTTP 500/503 server errors cleanly', async () => {
      const mockFetch = createMockFetch({
        '/health/deep': { status: 503, body: { status: 'unhealthy' } },
      });

      const route = {
        id: 'readiness',
        name: 'Readiness',
        path: '/health/deep',
        method: 'GET',
        expectedStatus: 200,
        validate: (data) => data?.status === 'healthy',
      };

      const result = await probeRoute('http://localhost:4000', route, {}, mockFetch);

      expect(result.success).toBe(false);
      expect(result.status).toBe(503);
      expect(result.error).toMatch(/Unexpected HTTP status 503/i);
    });

    it('failure path: handles network failure / connection refused without unhandled crash', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:4001'));

      const route = {
        id: 'liveness',
        name: 'Liveness',
        path: '/health',
      };

      const result = await probeRoute('http://localhost:4001', route, {}, mockFetch);

      expect(result.success).toBe(false);
      expect(result.status).toBe(0);
      expect(result.error).toMatch(/ECONNREFUSED/i);
    });

    it('failure path: handles response validation mismatch', async () => {
      const mockFetch = createMockFetch({
        '/health': { status: 200, body: { status: 'degraded' } },
      });

      const route = {
        id: 'liveness',
        name: 'Liveness',
        path: '/health',
        expectedStatus: 200,
        validate: (data) => data?.status === 'ok',
      };

      const result = await probeRoute('http://localhost:4000', route, {}, mockFetch);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/validation failed/i);
    });
  });

  describe('Error Budget Calculation and Auto-Abort Logic', () => {
    it('primary flow: calculates zero errors when all probes succeed', () => {
      const results = [
        { routeId: 'r1', success: true, latencyMs: 50 },
        { routeId: 'r2', success: true, latencyMs: 70 },
      ];

      const metrics = calculateMetrics(results, 0.05, 2000);

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.errorBudgetBreached).toBe(false);
      expect(metrics.aborted).toBe(false);
    });

    it('boundary case: error rate exactly equal to budget threshold does NOT breach', () => {
      // 1 failure out of 20 = 5.0% error rate; budget = 5.0%
      const results = Array(19).fill({ routeId: 'r1', success: true, latencyMs: 30 });
      results.push({ routeId: 'r1', success: false, latencyMs: 40, error: 'Fail' });

      const metrics = calculateMetrics(results, 0.05, 2000);

      expect(metrics.errorRate).toBe(0.05);
      expect(metrics.errorBudgetBreached).toBe(false);
      expect(metrics.aborted).toBe(false);
    });

    it('failure case: error rate strictly exceeding error budget triggers auto-abort', () => {
      // 2 failures out of 20 = 10% error rate; budget = 5%
      const results = Array(18).fill({ routeId: 'r1', success: true, latencyMs: 30 });
      results.push({ routeId: 'r1', success: false, latencyMs: 40, error: 'Fail 1' });
      results.push({ routeId: 'r1', success: false, latencyMs: 40, error: 'Fail 2' });

      const metrics = calculateMetrics(results, 0.05, 2000);

      expect(metrics.errorRate).toBe(0.1);
      expect(metrics.errorBudgetBreached).toBe(true);
      expect(metrics.aborted).toBe(true);
    });

    it('failure case: latency budget breach triggers auto-abort', () => {
      const results = [
        { routeId: 'r1', success: true, latencyMs: 1500 },
        { routeId: 'r2', success: true, latencyMs: 2500 }, // exceeds 2000ms budget
      ];

      const metrics = calculateMetrics(results, 0.1, 2000);

      expect(metrics.errorBudgetBreached).toBe(false);
      expect(metrics.latencyBudgetBreached).toBe(true);
      expect(metrics.aborted).toBe(true);
    });
  });

  describe('Full Canary Rollout Orchestration and Rollback Command', () => {
    it('primary flow: completes full canary rollout when all critical routes pass', async () => {
      const mockFetch = createMockFetch();
      const mockExec = vi.fn();

      const report = await runCanaryHealthProbes(
        {
          url: 'http://localhost:4000',
          errorBudget: 0.05,
          iterations: 2,
          intervalMs: 0,
        },
        mockFetch,
        mockExec,
        DEFAULT_CRITICAL_ROUTES
      );

      expect(report.success).toBe(true);
      expect(report.aborted).toBe(false);
      expect(report.metrics.totalRequests).toBe(2 * DEFAULT_CRITICAL_ROUTES.length);
      expect(report.metrics.errorRate).toBe(0);
      expect(mockExec).not.toHaveBeenCalled();
    });

    it('failure case: auto-aborts rollout and executes abort command on error budget breach', async () => {
      // Simulate /health/deep failing with 503
      const mockFetch = createMockFetch({
        '/health/deep': { status: 503, body: { status: 'unhealthy' } },
      });
      const mockExec = vi.fn().mockResolvedValue({ stdout: 'Stopped' });

      const report = await runCanaryHealthProbes(
        {
          url: 'http://localhost:4000',
          errorBudget: 0.05,
          iterations: 2,
          intervalMs: 0,
          abortCommand: 'docker compose stop api-canary',
        },
        mockFetch,
        mockExec,
        DEFAULT_CRITICAL_ROUTES
      );

      expect(report.success).toBe(false);
      expect(report.aborted).toBe(true);
      expect(report.abortReason).toMatch(/Error budget breached/i);
      expect(mockExec).toHaveBeenCalledWith('docker compose stop api-canary');
    });
  });
});
