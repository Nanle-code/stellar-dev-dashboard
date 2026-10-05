/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import { router as aiControlsRouter } from '../../api/routes/aiControls.js';
import { router as behaviorRouter } from '../../api/routes/behavior.js';
import {
  MemoryKillSwitchStore,
  resetAIKillSwitchStoreForTests,
  setAIKillSwitchStoreForTests,
} from '../../api/services/aiKillSwitch.js';

const operatorToken = 'test-operator-token-with-more-than-32-characters';
let server;
let baseUrl;
let store;
let originalEnvironment;

beforeAll(async () => {
  originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  process.env.AI_KILL_SWITCH_OPERATOR_TOKEN = operatorToken;
  const app = express();
  app.use(express.json());
  app.use('/api/v1/ai-controls', aiControlsRouter);
  app.use('/api/v1/behavior', behaviorRouter);
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});

beforeEach(() => {
  store = new MemoryKillSwitchStore();
  setAIKillSwitchStoreForTests(store);
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  resetAIKillSwitchStoreForTests();
  if (originalEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment;
  delete process.env.AI_KILL_SWITCH_OPERATOR_TOKEN;
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
}

describe('global AI kill switch API', () => {
  it('updates global state, records an audit event, and disables AI behavior routes', async () => {
    const updated = await request('/ai-controls', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${operatorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false, reason: 'incident response' }),
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      enabled: false,
      updatedBy: 'configured-operator',
      reason: 'incident response',
    });

    const current = await request('/ai-controls');
    expect(current.body.data.enabled).toBe(false);
    const audit = await request('/ai-controls/audit');
    expect(audit.body.data[0]).toMatchObject({
      previousEnabled: true,
      enabled: false,
      reason: 'incident response',
    });

    const behavior = await request('/behavior/predict/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(behavior.status).toBe(503);
    expect(behavior.body.error).toBe('ai_disabled');
  });

  it('rejects malformed switch values and overlong reasons', async () => {
    for (const body of [{ enabled: 'false' }, { enabled: false, reason: 'x'.repeat(241) }]) {
      const result = await request('/ai-controls', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${operatorToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(result.status).toBe(400);
      expect(result.body.error).toBe('invalid_payload');
    }
    expect((await request('/ai-controls')).body.data.enabled).toBe(true);
  });

  it('rejects unauthorized operators and unsupported environments', async () => {
    const unauthorized = await request('/ai-controls', {
      method: 'PUT',
      headers: { Authorization: 'Bearer wrong-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(unauthorized.status).toBe(403);

    process.env.NODE_ENV = 'staging';
    const unsupported = await request('/ai-controls', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${operatorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(unsupported.status).toBe(503);
    expect(unsupported.body.error).toBe('unsupported_environment');
  });

  it('fails closed when the runtime store is unavailable', async () => {
    setAIKillSwitchStoreForTests({
      read: async () => {
        throw new Error('store offline');
      },
      update: async () => {
        throw new Error('store offline');
      },
      history: async () => {
        throw new Error('store offline');
      },
    });
    const status = await request('/ai-controls');
    expect(status.status).toBe(503);
    expect(status.body.error).toBe('ai_control_unavailable');
    const behavior = await request('/behavior/predict/intent', { method: 'POST' });
    expect(behavior.status).toBe(503);
    expect(behavior.body.error).toBe('ai_control_unavailable');
  });
});
