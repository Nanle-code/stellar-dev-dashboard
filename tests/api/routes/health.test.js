/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import {
  router as healthRouter,
  _resetSimulatedFailure,
  _setSimulatedFailure,
} from '../../../api/routes/health.js';

describe('Health Routes and Probes', () => {
  let app;

  beforeEach(() => {
    _resetSimulatedFailure();
    delete process.env.CANARY;
    app = express();
    app.use(express.json());
    app.use('/health', healthRouter);
  });

  afterEach(() => {
    _resetSimulatedFailure();
    delete process.env.CANARY;
  });

  function mockRequest(app, method, url, body = {}) {
    return new Promise((resolve) => {
      const req = {
        method,
        url,
        path: url.split('?')[0],
        headers: {},
        query: {},
        params: {},
        body,
      };

      const res = {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          resolve(this);
          return this;
        },
        setHeader(name, val) {
          this.headers[name.toLowerCase()] = val;
        },
        set(name, val) {
          this.headers[name.toLowerCase()] = val;
        },
      };

      app.handle(req, res, () => {
        resolve(res);
      });
    });
  }

  it('primary flow: returns 200 OK with liveness details for GET /health', async () => {
    const res = await mockRequest(app, 'GET', '/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'api',
      version: '1.0.0',
    });
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('boundary case: reflects canary environment flag when CANARY=true', async () => {
    process.env.CANARY = 'true';
    const res = await mockRequest(app, 'GET', '/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.canary).toBe(true);
  });

  it('primary flow: returns comprehensive readiness checks on GET /health/deep', async () => {
    const res = await mockRequest(app, 'GET', '/health/deep');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.memory).toBeDefined();
    expect(res.body.checks.memory.status).toBe('ok');
    expect(res.body.checks.routes).toBeDefined();
  });

  it('failure case: returns 503 when simulated failure is injected during canary probe test', async () => {
    _setSimulatedFailure({ statusCode: 503, message: 'Database connection pool exhausted' });
    const res = await mockRequest(app, 'GET', '/health');
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('Database connection pool exhausted');

    const deepRes = await mockRequest(app, 'GET', '/health/deep');
    expect(deepRes.statusCode).toBe(503);
    expect(deepRes.body.status).toBe('unhealthy');
  });

  it('recovery: restores 200 OK after simulated failure is cleared', async () => {
    _setSimulatedFailure({ statusCode: 500, message: 'Transient fault' });
    _resetSimulatedFailure();

    const res = await mockRequest(app, 'GET', '/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
