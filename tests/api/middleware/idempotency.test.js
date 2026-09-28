/**
 * @vitest-environment node
 *
 * Tests for idempotency-key middleware on mutating proxy endpoints.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createIdempotencyMiddleware,
  requestFingerprint,
  validateIdempotencyKey,
} from '../../../api/middleware/idempotency.js';
import { _resetIdempotencyStoreCache } from '../../../api/middleware/idempotencyStore.js';

function mockReq(method, path, body, headers = {}) {
  return {
    method,
    path,
    body,
    headers,
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    _headers: {},
    finished: false,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.headersSent = true;
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
    on(event, handler) {
      if (event === 'finish') {
        this._finishHandler = handler;
      }
    },
    emitFinish() {
      this.finished = true;
      this._finishHandler?.();
    },
  };
  return res;
}

async function setupMiddleware() {
  _resetIdempotencyStoreCache();
  vi.resetModules();
  delete process.env.IDEMPOTENCY_ENABLED;
  delete process.env.IDEMPOTENCY_TTL_MS;
  delete process.env.IDEMPOTENCY_STORE;
  delete process.env.REDIS_URL;

  const mod = await import('../../../api/middleware/idempotency.js');
  return mod.createIdempotencyMiddleware();
}

describe('idempotency middleware', () => {
  beforeEach(() => {
    _resetIdempotencyStoreCache();
  });

  afterEach(() => {
    _resetIdempotencyStoreCache();
  });

  it('passes through GET requests without inspecting headers', async () => {
    const middleware = await setupMiddleware();
    const req = mockReq('GET', '/api/v1/transactions', undefined, {
      'idempotency-key': 'abc123',
    });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('caches and replays mutating responses for the same key and payload', async () => {
    const middleware = await setupMiddleware();
    const key = 'create-tx-001';
    const req = mockReq('POST', '/api/v1/gas/record', { amount: 42 }, { 'idempotency-key': key });

    const firstRes = mockRes();
    const firstNext = vi.fn();
    await middleware(req, firstRes, firstNext);
    expect(firstNext).toHaveBeenCalled();

    firstRes.json({ ok: true, id: 'abc' });
    firstRes.emitFinish();

    const replayReq = mockReq('POST', '/api/v1/gas/record', { amount: 42 }, { 'idempotency-key': key });
    const replayRes = mockRes();
    const replayNext = vi.fn();
    await middleware(replayReq, replayRes, replayNext);

    expect(replayNext).not.toHaveBeenCalled();
    expect(replayRes._headers['idempotency-replayed']).toBe('true');
    expect(replayRes.body).toEqual({ ok: true, id: 'abc' });
  });

  it('accepts idempotency keys at the maximum length boundary', () => {
    const key = 'a'.repeat(128);
    expect(validateIdempotencyKey(key)).toBeNull();
  });

  it('returns 422 for an invalid idempotency key', async () => {
    const middleware = await setupMiddleware();
    const req = mockReq('POST', '/api/v1/gas/record', { amount: 1 }, { 'idempotency-key': 'bad key!' });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('Unprocessable Entity');
  });

  it('returns 409 when the same key is reused with a different payload', async () => {
    const middleware = await setupMiddleware();
    const key = 'conflict-key';

    const firstReq = mockReq('POST', '/api/v1/gas/record', { amount: 1 }, { 'idempotency-key': key });
    const firstRes = mockRes();
    await middleware(firstReq, firstRes, vi.fn());
    firstRes.json({ ok: true });
    firstRes.emitFinish();

    const conflictReq = mockReq('POST', '/api/v1/gas/record', { amount: 2 }, { 'idempotency-key': key });
    const conflictRes = mockRes();
    await middleware(conflictReq, conflictRes, vi.fn());

    expect(conflictRes.statusCode).toBe(409);
    expect(conflictRes.body.message).toMatch(/different request payload/i);
  });

  it('is a no-op when IDEMPOTENCY_ENABLED=false', async () => {
    process.env.IDEMPOTENCY_ENABLED = 'false';
    const middleware = createIdempotencyMiddleware();
    const req = mockReq('POST', '/api/v1/gas/record', { amount: 1 }, { 'idempotency-key': 'ignored' });
    const next = vi.fn();

    await middleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('builds stable fingerprints for equivalent payloads', () => {
    const reqA = mockReq('POST', '/api/v1/gas/record', { amount: 1 });
    const reqB = mockReq('POST', '/api/v1/gas/record', { amount: 1 });
    expect(requestFingerprint(reqA)).toBe(requestFingerprint(reqB));
  });
});
