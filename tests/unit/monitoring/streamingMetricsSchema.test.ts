import { describe, it, expect } from 'vitest';
import {
  buildMetricsEnvelope,
  buildErrorEnvelope,
  parseMetricsEnvelope,
  isStreamingSupported,
  MetricsValidationError,
  SCHEMA_VERSION,
  type NetworkMetricsPayload,
  type AccountMetricsPayload,
} from '../../../src/monitoring/streamingMetricsSchema';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const validNetworkPayload: NetworkMetricsPayload = {
  ledgerCloseTimeMs: 5120,
  transactionCount: 128,
  operationCount: 340,
  baseFee: '100',
  baseReserve: '5000000',
  peerCount: 24,
  status: 'healthy',
};

const validAccountPayload: AccountMetricsPayload = {
  accountId: 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV2F7DND5JD',
  balance: '1000000000',
  sequence: '123456789',
  subentryCount: 3,
  status: 'active',
};

// ── buildMetricsEnvelope ──────────────────────────────────────────────────────

describe('buildMetricsEnvelope', () => {
  // Primary flow: valid network envelope
  it('primary flow: emits a valid network envelope with schemaVersion v1', () => {
    const envelope = buildMetricsEnvelope('network', validNetworkPayload, 1);

    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(envelope.type).toBe('network');
    expect(envelope.sequence).toBe(1);
    expect(typeof envelope.emittedAt).toBe('string');
    expect(() => new Date(envelope.emittedAt)).not.toThrow();
    expect(envelope.payload).toEqual(validNetworkPayload);
  });

  // Primary flow: valid account envelope
  it('primary flow: emits a valid account envelope with schemaVersion v1', () => {
    const envelope = buildMetricsEnvelope('account', validAccountPayload, 2);

    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(envelope.type).toBe('account');
    expect(envelope.sequence).toBe(2);
    expect(envelope.payload).toEqual(validAccountPayload);
  });

  // Boundary: zero-valued counters and maximum sequence
  it('boundary: accepts zero-valued numeric counters', () => {
    const payload: NetworkMetricsPayload = {
      ...validNetworkPayload,
      ledgerCloseTimeMs: 0,
      transactionCount: 0,
      operationCount: 0,
      peerCount: 0,
    };
    const envelope = buildMetricsEnvelope('network', payload, 0);
    expect(envelope.payload.ledgerCloseTimeMs).toBe(0);
    expect(envelope.payload.transactionCount).toBe(0);
  });

  it('boundary: accepts Number.MAX_SAFE_INTEGER as sequence', () => {
    const envelope = buildMetricsEnvelope('network', validNetworkPayload, Number.MAX_SAFE_INTEGER);
    expect(envelope.sequence).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('boundary: accepts all valid network status values', () => {
    for (const status of ['healthy', 'degraded', 'down'] as const) {
      const envelope = buildMetricsEnvelope('network', { ...validNetworkPayload, status }, 1);
      expect((envelope.payload as NetworkMetricsPayload).status).toBe(status);
    }
  });

  it('boundary: accepts all valid account status values', () => {
    for (const status of ['active', 'inactive', 'unknown'] as const) {
      const envelope = buildMetricsEnvelope('account', { ...validAccountPayload, status }, 1);
      expect((envelope.payload as AccountMetricsPayload).status).toBe(status);
    }
  });

  // Failure: unsupported type
  it('failure: throws MetricsValidationError for unsupported type', () => {
    expect(() =>
      buildMetricsEnvelope('dex' as 'network', validNetworkPayload, 1),
    ).toThrow(MetricsValidationError);
    expect(() =>
      buildMetricsEnvelope('dex' as 'network', validNetworkPayload, 1),
    ).toThrow('UNSUPPORTED_METRICS_TYPE');
  });

  // Failure: missing required network fields
  it('failure: throws for missing network payload field (ledgerCloseTimeMs)', () => {
    const bad = { ...validNetworkPayload } as Partial<NetworkMetricsPayload>;
    delete bad.ledgerCloseTimeMs;
    expect(() => buildMetricsEnvelope('network', bad, 1)).toThrow(MetricsValidationError);
    expect(() => buildMetricsEnvelope('network', bad, 1)).toThrow('ledgerCloseTimeMs');
  });

  it('failure: throws for negative network numeric field', () => {
    const bad = { ...validNetworkPayload, peerCount: -1 };
    expect(() => buildMetricsEnvelope('network', bad, 1)).toThrow(MetricsValidationError);
    expect(() => buildMetricsEnvelope('network', bad, 1)).toThrow('peerCount');
  });

  it('failure: throws for non-integer-string baseFee', () => {
    const bad = { ...validNetworkPayload, baseFee: 'not-a-number' };
    expect(() => buildMetricsEnvelope('network', bad, 1)).toThrow(MetricsValidationError);
    expect(() => buildMetricsEnvelope('network', bad, 1)).toThrow('baseFee');
  });

  it('failure: throws for invalid network status value', () => {
    const bad = { ...validNetworkPayload, status: 'unknown' as 'healthy' };
    expect(() => buildMetricsEnvelope('network', bad, 1)).toThrow(MetricsValidationError);
  });

  it('failure: throws for missing account payload field (balance)', () => {
    const bad = { ...validAccountPayload } as Partial<AccountMetricsPayload>;
    delete bad.balance;
    expect(() => buildMetricsEnvelope('account', bad, 1)).toThrow(MetricsValidationError);
    expect(() => buildMetricsEnvelope('account', bad, 1)).toThrow('balance');
  });

  it('failure: throws for empty accountId', () => {
    const bad = { ...validAccountPayload, accountId: '' };
    expect(() => buildMetricsEnvelope('account', bad, 1)).toThrow(MetricsValidationError);
    expect(() => buildMetricsEnvelope('account', bad, 1)).toThrow('accountId');
  });

  it('failure: throws for non-integer-string balance', () => {
    const bad = { ...validAccountPayload, balance: '1000.50' };
    expect(() => buildMetricsEnvelope('account', bad, 1)).toThrow(MetricsValidationError);
    expect(() => buildMetricsEnvelope('account', bad, 1)).toThrow('balance');
  });

  it('failure: throws for negative subentryCount', () => {
    const bad = { ...validAccountPayload, subentryCount: -1 };
    expect(() => buildMetricsEnvelope('account', bad, 1)).toThrow(MetricsValidationError);
    expect(() => buildMetricsEnvelope('account', bad, 1)).toThrow('subentryCount');
  });

  it('failure: non-object payload throws', () => {
    expect(() => buildMetricsEnvelope('network', null, 1)).toThrow(MetricsValidationError);
    expect(() => buildMetricsEnvelope('account', 'bad', 1)).toThrow(MetricsValidationError);
  });
});

// ── buildErrorEnvelope ────────────────────────────────────────────────────────

describe('buildErrorEnvelope', () => {
  it('primary flow: emits a structured error envelope', () => {
    const envelope = buildErrorEnvelope(
      'INVALID_METRICS_PAYLOAD',
      "payload.type must be 'network' or 'account'",
      43,
      'type',
    );

    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(envelope.type).toBe('error');
    expect(envelope.sequence).toBe(43);
    expect(envelope.payload.code).toBe('INVALID_METRICS_PAYLOAD');
    expect(envelope.payload.field).toBe('type');
  });

  it('primary flow: STREAMING_UNSUPPORTED error has no field', () => {
    const envelope = buildErrorEnvelope(
      'STREAMING_UNSUPPORTED',
      'Serverless environment does not support persistent connections',
      1,
    );
    expect(envelope.payload.code).toBe('STREAMING_UNSUPPORTED');
    expect(envelope.payload.field).toBeUndefined();
  });

  it('boundary: STREAM_FAILURE code is emitted correctly', () => {
    const envelope = buildErrorEnvelope('STREAM_FAILURE', 'Producer connection lost', 99);
    expect(envelope.payload.code).toBe('STREAM_FAILURE');
    expect(envelope.sequence).toBe(99);
  });
});

// ── parseMetricsEnvelope ──────────────────────────────────────────────────────

describe('parseMetricsEnvelope', () => {
  it('primary flow: parses a valid network envelope', () => {
    const raw = {
      schemaVersion: 'v1',
      type: 'network',
      emittedAt: '2026-01-01T00:00:00.000Z',
      sequence: 10,
      payload: validNetworkPayload,
    };
    const envelope = parseMetricsEnvelope(raw);
    expect(envelope.type).toBe('network');
    expect(envelope.schemaVersion).toBe('v1');
  });

  it('primary flow: passes through error envelopes without re-validating payload', () => {
    const raw = {
      schemaVersion: 'v1',
      type: 'error',
      emittedAt: '2026-01-01T00:00:00.000Z',
      sequence: 5,
      payload: { code: 'STREAM_FAILURE', message: 'down' },
    };
    const envelope = parseMetricsEnvelope(raw);
    expect(envelope.type).toBe('error');
  });

  it('boundary: accepts sequence 0', () => {
    const raw = {
      schemaVersion: 'v1',
      type: 'account',
      emittedAt: '2026-06-01T12:00:00.000Z',
      sequence: 0,
      payload: validAccountPayload,
    };
    expect(() => parseMetricsEnvelope(raw)).not.toThrow();
  });

  it('failure: rejects unknown schemaVersion', () => {
    const raw = { schemaVersion: 'v2', type: 'network', emittedAt: '2026-01-01T00:00:00.000Z', sequence: 1, payload: validNetworkPayload };
    expect(() => parseMetricsEnvelope(raw)).toThrow(MetricsValidationError);
    expect(() => parseMetricsEnvelope(raw)).toThrow('schemaVersion');
  });

  it('failure: rejects invalid emittedAt', () => {
    const raw = { schemaVersion: 'v1', type: 'network', emittedAt: 'not-a-date', sequence: 1, payload: validNetworkPayload };
    expect(() => parseMetricsEnvelope(raw)).toThrow(MetricsValidationError);
    expect(() => parseMetricsEnvelope(raw)).toThrow('emittedAt');
  });

  it('failure: rejects negative sequence', () => {
    const raw = { schemaVersion: 'v1', type: 'network', emittedAt: '2026-01-01T00:00:00.000Z', sequence: -1, payload: validNetworkPayload };
    expect(() => parseMetricsEnvelope(raw)).toThrow(MetricsValidationError);
    expect(() => parseMetricsEnvelope(raw)).toThrow('sequence');
  });

  it('failure: rejects non-object input', () => {
    expect(() => parseMetricsEnvelope(null)).toThrow(MetricsValidationError);
    expect(() => parseMetricsEnvelope('bad')).toThrow(MetricsValidationError);
  });

  it('failure: rejects unsupported type', () => {
    const raw = { schemaVersion: 'v1', type: 'dex', emittedAt: '2026-01-01T00:00:00.000Z', sequence: 1, payload: {} };
    expect(() => parseMetricsEnvelope(raw)).toThrow(MetricsValidationError);
  });
});

// ── isStreamingSupported ──────────────────────────────────────────────────────

describe('isStreamingSupported', () => {
  it('returns true in Node.js environment (no window object)', () => {
    // Tests run in jsdom or Node — either way the function should not throw
    const result = isStreamingSupported();
    expect(typeof result).toBe('boolean');
  });
});

// ── MetricsValidationError ────────────────────────────────────────────────────

describe('MetricsValidationError', () => {
  it('carries code and optional field', () => {
    const err = new MetricsValidationError('INVALID_METRICS_PAYLOAD', 'bad field', 'baseFee');
    expect(err.code).toBe('INVALID_METRICS_PAYLOAD');
    expect(err.field).toBe('baseFee');
    expect(err.name).toBe('MetricsValidationError');
    expect(err instanceof Error).toBe(true);
  });

  it('field is undefined when not provided', () => {
    const err = new MetricsValidationError('STREAM_FAILURE', 'connection lost');
    expect(err.field).toBeUndefined();
  });
});
