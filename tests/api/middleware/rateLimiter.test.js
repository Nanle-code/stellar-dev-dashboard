/**
 * @vitest-environment node
 *
 * Tests for the API rate-limiter middleware.
 *
 * Coverage:
 *   • Primary flow: requests under the limit pass; requests over the limit
 *     are rejected with 429 + Retry-After.
 *   • Boundary case: exactly at the limit — the Nth request passes, the
 *     (N+1)th is rejected.
 *   • Failure case: missing / malformed client IP returns 400.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRateLimiter } from '../../../api/middleware/rateLimiter.js';
import { _resetStoreCache } from '../../../api/middleware/stores.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal mock Express request object.
 */
function mockReq(ip) {
  return {
    ip,
    socket: { remoteAddress: ip },
    connection: { remoteAddress: ip },
    headers: {},
  };
}

/**
 * Build a mock response that records status, body, and headers.
 * Header keys are stored in lowercase to match HTTP/Express conventions.
 */
function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    _headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    set(field, value) {
      if (typeof field === 'object') {
        for (const [k, v] of Object.entries(field)) {
          this._headers[k.toLowerCase()] = v;
        }
      } else {
        this._headers[field.toLowerCase()] = value;
      }
      return this;
    },
    get(field) {
      return this._headers[field.toLowerCase()];
    },
  };
  return res;
}

/**
 * Create a fresh middleware function.
 */
async function setupMiddleware(max, windowMs) {
  _resetStoreCache();
  vi.resetModules();
  delete process.env.RATE_LIMIT_MAX;
  delete process.env.RATE_LIMIT_WINDOW;
  delete process.env.RATE_LIMIT_STORE;
  delete process.env.REDIS_URL;

  if (max !== undefined) process.env.RATE_LIMIT_MAX = String(max);
  if (windowMs !== undefined) process.env.RATE_LIMIT_WINDOW = String(windowMs);

  const mod = await import('../../../api/middleware/rateLimiter.js');
  return mod.createRateLimiter();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rateLimiter middleware', () => {
  beforeEach(() => {
    _resetStoreCache();
  });

  afterEach(() => {
    _resetStoreCache();
  });

  // ── Primary flow ──────────────────────────────────────────────────────

  it('allows requests under the rate limit', async () => {
    const middleware = await setupMiddleware(10, 60_000);

    for (let i = 0; i < 5; i++) {
      const req = mockReq('1.2.3.4');
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._headers['x-ratelimit-limit']).toBe('10');
      expect(res._headers['x-ratelimit-remaining']).toBeDefined();
      expect(res._headers['x-ratelimit-reset']).toBeDefined();
    }
  });

  it('rejects requests over the rate limit with 429 and Retry-After', async () => {
    const middleware = await setupMiddleware(3, 60_000);

    // Consume all tokens
    for (let i = 0; i < 3; i++) {
      const req = mockReq('5.6.7.8');
      const res = mockRes();
      const next = vi.fn();
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    // Next should be rejected
    const req = mockReq('5.6.7.8');
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe('Too Many Requests');
    expect(res.body.retryAfter).toBeGreaterThan(0);
    expect(res._headers['retry-after']).toBeDefined();
    expect(res._headers['x-ratelimit-limit']).toBe('3');
    expect(res._headers['x-ratelimit-remaining']).toBe('0');
  });

  // ── Boundary case ─────────────────────────────────────────────────────

  it('allows exactly maxRequests and blocks the (max+1)th', async () => {
    const limit = 5;
    const middleware = await setupMiddleware(limit, 60_000);

    for (let i = 0; i < limit; i++) {
      const req = mockReq('10.0.0.1');
      const res = mockRes();
      const next = vi.fn();
      await middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    }

    const req = mockReq('10.0.0.1');
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.retryAfter).toBeGreaterThan(0);
  });

  // ── Failure / edge cases ──────────────────────────────────────────────

  it('returns 400 when client IP cannot be determined', async () => {
    const middleware = await setupMiddleware(10, 60_000);

    const req = {
      ip: undefined,
      socket: {},
      connection: {},
      headers: { 'x-forwarded-for': '  ' },
    };
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toMatch(/client address/i);
  });

  it('returns 400 for a malformed IP address', async () => {
    const middleware = await setupMiddleware(10, 60_000);

    const req = {
      ip: undefined,
      socket: {},
      connection: {},
      headers: { 'x-forwarded-for': '<script>alert(1)</script>' },
    };
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toMatch(/malformed/i);
  });

  it('counts different clients independently', async () => {
    const middleware = await setupMiddleware(2, 60_000);

    // Client A uses both tokens
    for (let i = 0; i < 2; i++) {
      const req = mockReq('a.a.a.a');
      const next = vi.fn();
      await middleware(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    }

    // Client A blocked
    const blockedA = mockRes();
    const nextA = vi.fn();
    await middleware(mockReq('a.a.a.a'), blockedA, nextA);
    expect(nextA).not.toHaveBeenCalled();
    expect(blockedA.statusCode).toBe(429);

    // Client B should still have full quota
    const resB = mockRes();
    const nextB = vi.fn();
    await middleware(mockReq('b.b.b.b'), resB, nextB);
    expect(nextB).toHaveBeenCalled();
    expect(Number(resB._headers['x-ratelimit-remaining'])).toBeGreaterThan(0);
  });

  it('includes rate limit headers on successful responses', async () => {
    const middleware = await setupMiddleware(20, 60_000);
    const req = mockReq('9.9.9.9');
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res._headers['x-ratelimit-limit']).toBe('20');
    expect(res._headers['x-ratelimit-remaining']).toBeDefined();
    expect(res._headers['x-ratelimit-reset']).toBeDefined();
    expect(res._headers['retry-after']).toBeUndefined();
  });

  it('uses default config (100/60s) when env vars are not set', async () => {
    const middleware = await setupMiddleware(undefined, undefined);
    const req = mockReq('8.8.8.8');
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._headers['x-ratelimit-limit']).toBe('100');
  });
});
