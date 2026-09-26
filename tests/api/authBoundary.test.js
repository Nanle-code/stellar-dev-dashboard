/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import {
  oauthAuth,
  requireRole,
  getRuntimeEnvironment,
} from '../../api/middleware/auth.js';

function mockReq(overrides = {}) {
  return {
    headers: {},
    query: {},
    params: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('API auth boundaries', () => {
  it('allows a valid bearer token and attaches the user context', () => {
    const req = mockReq({ headers: { authorization: 'Bearer valid-token-12345' } });
    const res = mockRes();
    const next = vi.fn();

    oauthAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 'user-1', roles: expect.arrayContaining(['api_user']) });
    expect(res.statusCode).toBeNull();
  });

  it('rejects a token below the minimum length as a boundary case', () => {
    const req = mockReq({ headers: { authorization: 'Bearer short' } });
    const res = mockRes();
    const next = vi.fn();

    oauthAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid token/i);
  });

  it('rejects missing authorization for user-specific routes', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    oauthAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/missing or invalid token/i);
  });

  it('enforces role-based authorization on operational endpoints', () => {
    const req = mockReq({ user: { roles: ['api_user'] } });
    const res = mockRes();
    const next = vi.fn();

    requireRole('admin')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Forbidden');

    const allowedReq = mockReq({ user: { roles: ['admin'] } });
    const allowedRes = mockRes();
    const allowedNext = vi.fn();

    requireRole('admin')(allowedReq, allowedRes, allowedNext);

    expect(allowedNext).toHaveBeenCalledTimes(1);
  });

  it('fails fast for unsupported runtime environments', () => {
    expect(() => getRuntimeEnvironment('staging')).toThrow(/unsupported environment/i);
    expect(getRuntimeEnvironment('test')).toBe('test');
  });
});
