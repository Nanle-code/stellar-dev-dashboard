/**
 * @vitest-environment node
 *
 * Tests for the gas prediction API route (#911).
 *
 * Coverage:
 *   • Primary flow: a valid request on pubnet returns 200 with the
 *     documented response schema (baseFee, inclusionFee, confidence).
 *   • Boundary case: a valid futurenet request at the maximum allowable
 *     operations count (100) still returns 200.
 *   • Failure case: a negative operationsCount returns 400.
 *   • Failure case: an unsupported network environment returns 422.
 *   • Failure case: an internal calculation failure returns 503.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import { router as gasPredictionRouter } from '../../../api/routes/gasPrediction.js';

let server;
let baseUrl;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', gasPredictionRouter);

  server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api/v1`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function predict(body) {
  const res = await fetch(`${baseUrl}/gas/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

describe('POST /gas/predict', () => {
  // ── Primary flow ──────────────────────────────────────────────────────

  it('returns 200 with the documented schema for a valid pubnet request', async () => {
    const { status, body } = await predict({
      contractId: 'CABC123',
      functionName: 'transfer',
      network: 'pubnet',
      operationsCount: 1,
    });

    expect(status).toBe(200);
    expect(body.network).toBe('pubnet');
    expect(typeof body.baseFee).toBe('number');
    expect(typeof body.inclusionFee).toBe('number');
    expect(typeof body.confidence).toBe('number');
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });

  // ── Boundary case ─────────────────────────────────────────────────────

  it('returns 200 for a futurenet request at the maximum allowable operations count', async () => {
    const { status, body } = await predict({
      contractId: 'CABC123',
      functionName: 'transfer',
      network: 'futurenet',
      operationsCount: 100,
    });

    expect(status).toBe(200);
    expect(body.network).toBe('futurenet');
    expect(body.operationsCount).toBe(100);
  });

  // ── Failure cases ──────────────────────────────────────────────────────

  it('returns 400 for a negative operationsCount', async () => {
    const { status, body } = await predict({
      contractId: 'CABC123',
      functionName: 'transfer',
      network: 'testnet',
      operationsCount: -1,
    });

    expect(status).toBe(400);
    expect(body.error).toBe('ValidationError');
    expect(body.field).toBe('operationsCount');
  });

  it('returns 400 when contractId or functionName is missing', async () => {
    const { status, body } = await predict({ network: 'testnet' });

    expect(status).toBe(400);
    expect(body.error).toBe('ValidationError');
  });

  it('returns 422 for an unsupported network environment', async () => {
    const { status, body } = await predict({
      contractId: 'CABC123',
      functionName: 'transfer',
      network: 'mainnet-legacy',
    });

    expect(status).toBe(422);
    expect(body.error).toBe('UnsupportedNetworkError');
    expect(body.allowed).toEqual(['pubnet', 'testnet', 'futurenet']);
  });

  it('returns 503 when the calculation engine fails on malformed input', async () => {
    const { status, body } = await predict({
      contractId: 'CABC123',
      functionName: 'transfer',
      network: 'testnet',
      args: 'not-an-array',
    });

    expect(status).toBe(503);
    expect(body.error).toBe('ServiceUnavailableError');
  });
});
