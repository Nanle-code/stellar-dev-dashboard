/**
 * Versioned streaming metrics schema for external consumers and plugins.
 *
 * Implements the schema defined in:
 *   .qoder/repowiki/en/content/API Reference/Custom REST API/Custom REST API.md
 *
 * The schema is stable within a major version (currently v1). Consumers MUST
 * ignore unknown fields to remain forward-compatible. A new major version is
 * published only for breaking changes.
 *
 * Compatibility: pure TypeScript, no runtime dependencies. Works in Node and
 * browser environments.
 *
 * Security: payloads MUST NOT contain secrets, private keys, or PII. Only
 * public account identifiers and aggregate network values are permitted.
 */

export const SCHEMA_VERSION = 'v1' as const;

// ── Payload types ────────────────────────────────────────────────────────────

export interface NetworkMetricsPayload {
  /** Average ledger close time in milliseconds. */
  ledgerCloseTimeMs: number;
  /** Transaction count in the last closed ledger. */
  transactionCount: number;
  /** Operation count in the last closed ledger. */
  operationCount: number;
  /** Base fee in stroops, as a string to avoid precision loss. */
  baseFee: string;
  /** Base reserve in stroops, as a string. */
  baseReserve: string;
  /** Number of connected peers. */
  peerCount: number;
  /** Network health status. */
  status: 'healthy' | 'degraded' | 'down';
}

export interface AccountMetricsPayload {
  /** Stellar account identifier (G... public key). */
  accountId: string;
  /** Native balance in stroops, as a string. */
  balance: string;
  /** Current account sequence number, as a string. */
  sequence: string;
  /** Number of subentries. */
  subentryCount: number;
  /** Account status. */
  status: 'active' | 'inactive' | 'unknown';
}

export interface ErrorPayload {
  /** Machine-readable error code. */
  code:
    | 'INVALID_METRICS_PAYLOAD'
    | 'UNSUPPORTED_METRICS_TYPE'
    | 'STREAMING_UNSUPPORTED'
    | 'STREAM_FAILURE';
  /** Human-readable description of the error. */
  message: string;
  /** Field that caused the validation error, if applicable. */
  field?: string;
}

// ── Envelope ─────────────────────────────────────────────────────────────────

export interface MetricsEnvelope<T = NetworkMetricsPayload | AccountMetricsPayload | ErrorPayload> {
  /** Schema version. Always "v1" for this schema. */
  schemaVersion: typeof SCHEMA_VERSION;
  /** Message type. */
  type: 'network' | 'account' | 'error';
  /** ISO 8601 UTC timestamp of emission. */
  emittedAt: string;
  /** Monotonically increasing sequence number per stream. */
  sequence: number;
  /** Type-specific payload. */
  payload: T;
}

export type NetworkEnvelope = MetricsEnvelope<NetworkMetricsPayload> & { type: 'network' };
export type AccountEnvelope = MetricsEnvelope<AccountMetricsPayload> & { type: 'account' };
export type ErrorEnvelope = MetricsEnvelope<ErrorPayload> & { type: 'error' };
export type AnyEnvelope = NetworkEnvelope | AccountEnvelope | ErrorEnvelope;

// ── Validation errors ────────────────────────────────────────────────────────

export class MetricsValidationError extends Error {
  constructor(
    public readonly code: ErrorPayload['code'],
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'MetricsValidationError';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when value is a finite, non-negative number. */
function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Returns true when value is a string representing a base-10 integer. */
function isBase10IntString(value: unknown): value is string {
  return typeof value === 'string' && /^-?\d+$/.test(value) && Number.isInteger(Number(value));
}

// ── Payload validators ───────────────────────────────────────────────────────

function validateNetworkPayload(payload: unknown): asserts payload is NetworkMetricsPayload {
  if (!payload || typeof payload !== 'object') {
    throw new MetricsValidationError('INVALID_METRICS_PAYLOAD', 'payload must be an object');
  }
  const p = payload as Record<string, unknown>;

  if (!isNonNegativeFinite(p.ledgerCloseTimeMs)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.ledgerCloseTimeMs must be a non-negative number',
      'ledgerCloseTimeMs',
    );
  }
  if (!isNonNegativeFinite(p.transactionCount)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.transactionCount must be a non-negative number',
      'transactionCount',
    );
  }
  if (!isNonNegativeFinite(p.operationCount)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.operationCount must be a non-negative number',
      'operationCount',
    );
  }
  if (!isBase10IntString(p.baseFee)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.baseFee must be a base-10 integer string',
      'baseFee',
    );
  }
  if (!isBase10IntString(p.baseReserve)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.baseReserve must be a base-10 integer string',
      'baseReserve',
    );
  }
  if (!isNonNegativeFinite(p.peerCount)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.peerCount must be a non-negative number',
      'peerCount',
    );
  }
  if (p.status !== 'healthy' && p.status !== 'degraded' && p.status !== 'down') {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.status must be "healthy", "degraded", or "down"',
      'status',
    );
  }
}

function validateAccountPayload(payload: unknown): asserts payload is AccountMetricsPayload {
  if (!payload || typeof payload !== 'object') {
    throw new MetricsValidationError('INVALID_METRICS_PAYLOAD', 'payload must be an object');
  }
  const p = payload as Record<string, unknown>;

  if (typeof p.accountId !== 'string' || p.accountId.trim() === '') {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.accountId must be a non-empty string',
      'accountId',
    );
  }
  if (!isBase10IntString(p.balance)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.balance must be a base-10 integer string',
      'balance',
    );
  }
  if (!isBase10IntString(p.sequence)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.sequence must be a base-10 integer string',
      'sequence',
    );
  }
  if (!isNonNegativeFinite(p.subentryCount)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.subentryCount must be a non-negative number',
      'subentryCount',
    );
  }
  if (p.status !== 'active' && p.status !== 'inactive' && p.status !== 'unknown') {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'payload.status must be "active", "inactive", or "unknown"',
      'status',
    );
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build and validate a metrics envelope.
 *
 * Throws MetricsValidationError when the type is unsupported or the payload
 * fails validation. The caller should catch this and emit an error envelope
 * instead (use buildErrorEnvelope).
 */
export function buildMetricsEnvelope(
  type: 'network' | 'account',
  payload: unknown,
  sequence: number,
): NetworkEnvelope | AccountEnvelope {
  if (type !== 'network' && type !== 'account') {
    throw new MetricsValidationError(
      'UNSUPPORTED_METRICS_TYPE',
      `payload.type must be "network" or "account", got "${String(type)}"`,
      'type',
    );
  }

  if (type === 'network') {
    validateNetworkPayload(payload);
    return {
      schemaVersion: SCHEMA_VERSION,
      type: 'network',
      emittedAt: new Date().toISOString(),
      sequence,
      payload,
    };
  }

  validateAccountPayload(payload);
  return {
    schemaVersion: SCHEMA_VERSION,
    type: 'account',
    emittedAt: new Date().toISOString(),
    sequence,
    payload,
  };
}

/**
 * Build a structured error envelope for emission on the metrics stream.
 * Used when a payload fails validation or the environment is unsupported.
 */
export function buildErrorEnvelope(
  code: ErrorPayload['code'],
  message: string,
  sequence: number,
  field?: string,
): ErrorEnvelope {
  return {
    schemaVersion: SCHEMA_VERSION,
    type: 'error',
    emittedAt: new Date().toISOString(),
    sequence,
    payload: { code, message, ...(field !== undefined ? { field } : {}) },
  };
}

/**
 * Detect whether the current runtime supports persistent streaming.
 *
 * Returns false in serverless or edge environments where a persistent
 * connection cannot be maintained (no WebSocket or EventSource API).
 */
export function isStreamingSupported(): boolean {
  // In Node.js (test / server) typeof window is undefined — treat as supported
  // so server-side producers can always stream.
  if (typeof window === 'undefined') return true;
  // In browser, require at least WebSocket support.
  return typeof WebSocket !== 'undefined';
}

/**
 * Validate a raw incoming envelope from an external producer.
 *
 * Returns the typed envelope on success or throws MetricsValidationError.
 * Consumers can use this to guard against malformed upstream messages.
 */
export function parseMetricsEnvelope(raw: unknown): AnyEnvelope {
  if (!raw || typeof raw !== 'object') {
    throw new MetricsValidationError('INVALID_METRICS_PAYLOAD', 'envelope must be an object');
  }
  const env = raw as Record<string, unknown>;

  if (env.schemaVersion !== SCHEMA_VERSION) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      `unsupported schemaVersion "${String(env.schemaVersion)}"`,
      'schemaVersion',
    );
  }
  if (typeof env.emittedAt !== 'string' || Number.isNaN(Date.parse(env.emittedAt))) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'envelope.emittedAt must be a valid ISO-8601 date string',
      'emittedAt',
    );
  }
  if (!isNonNegativeFinite(env.sequence) || !Number.isInteger(env.sequence)) {
    throw new MetricsValidationError(
      'INVALID_METRICS_PAYLOAD',
      'envelope.sequence must be a non-negative integer',
      'sequence',
    );
  }

  if (env.type === 'error') {
    // Error envelopes are passed through without further payload validation.
    return raw as ErrorEnvelope;
  }

  if (env.type !== 'network' && env.type !== 'account') {
    throw new MetricsValidationError(
      'UNSUPPORTED_METRICS_TYPE',
      `envelope.type must be "network", "account", or "error"`,
      'type',
    );
  }

  return buildMetricsEnvelope(env.type as 'network' | 'account', env.payload, env.sequence as number);
}
