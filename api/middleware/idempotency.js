/**
 * IDEMPOTENCY KEY MIDDLEWARE
 * ==========================
 * Accepts `Idempotency-Key` on mutating proxy requests so clients can safely
 * retry POST / PUT / PATCH / DELETE calls without duplicating side effects.
 *
 * Behaviour
 * ---------
 * • Optional header — requests without a key pass through unchanged.
 * • First request with a key executes normally; the response is cached.
 * • Retries with the same key and identical payload return the cached response
 *   with `Idempotency-Replayed: true`.
 * • The same key with a different payload returns 409 Conflict.
 * • A concurrent duplicate while the first request is in-flight returns 409 with
 *   `Retry-After: 1`.
 *
 * Environment variables
 * ---------------------
 *   IDEMPOTENCY_ENABLED  – "false" disables the middleware (default: enabled)
 *   IDEMPOTENCY_TTL_MS   – cache lifetime in ms (default: 86_400_000 / 24 h)
 *   IDEMPOTENCY_STORE    – "memory" (default) | "redis"
 *   REDIS_URL            – required when IDEMPOTENCY_STORE=redis
 *
 * Failure modes
 * -------------
 * 1. Invalid / missing key format when provided → 422 Unprocessable Entity
 * 2. Same key, different body                   → 409 Conflict
 * 3. In-flight duplicate                        → 409 + Retry-After
 * 4. Store unavailable                          → fail-open (request proceeds)
 * 5. IDEMPOTENCY_ENABLED=false                  → middleware is a no-op
 */

import crypto from 'node:crypto';
import { getIdempotencyStore } from './idempotencyStore.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DEFAULT_TTL_MS = 86_400_000; // 24 hours
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function config() {
  const enabled = (process.env.IDEMPOTENCY_ENABLED || 'true').toLowerCase() !== 'false';

  const rawTtl = process.env.IDEMPOTENCY_TTL_MS;
  const ttlMs =
    rawTtl && Number.isFinite(Number(rawTtl)) && Number(rawTtl) >= 60_000
      ? Number(rawTtl)
      : DEFAULT_TTL_MS;

  return { enabled, ttlMs };
}

/**
 * Stable fingerprint for method + path + JSON body.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
export function requestFingerprint(req) {
  const body = req.body === undefined || req.body === null ? '' : JSON.stringify(req.body);
  return crypto
    .createHash('sha256')
    .update(`${req.method}\n${req.path}\n${body}`)
    .digest('hex');
}

/**
 * Validate an idempotency key supplied by the client.
 *
 * @param {unknown} key
 * @returns {string|null} error message or null when valid
 */
export function validateIdempotencyKey(key) {
  if (key === undefined || key === null || key === '') {
    return 'Idempotency-Key header is required when idempotency is requested';
  }

  if (Array.isArray(key)) {
    return 'Idempotency-Key must be a single header value';
  }

  const value = String(key).trim();
  if (!KEY_PATTERN.test(value)) {
    return 'Idempotency-Key must be 1–128 characters and contain only letters, numbers, hyphens, or underscores';
  }

  return null;
}

let _storePromise = null;

async function ensureStore() {
  if (!_storePromise) {
    _storePromise = getIdempotencyStore();
  }
  return _storePromise;
}

/**
 * Replay a previously stored response onto the current Express response.
 *
 * @param {import('express').Response} res
 * @param {{ statusCode: number, headers: Record<string, string>, body: unknown }} record
 */
function replayResponse(res, record) {
  res.set('Idempotency-Replayed', 'true');
  for (const [name, value] of Object.entries(record.headers || {})) {
    if (!['content-length', 'transfer-encoding'].includes(name.toLowerCase())) {
      res.set(name, value);
    }
  }
  res.status(record.statusCode).json(record.body);
}

/**
 * Create the idempotency middleware.
 */
export function createIdempotencyMiddleware() {
  const { enabled, ttlMs } = config();

  return async function idempotencyMiddleware(req, res, next) {
    if (!enabled) {
      return next();
    }

    if (!MUTATING_METHODS.has(req.method)) {
      return next();
    }

    const rawKey = req.headers['idempotency-key'];
    if (rawKey === undefined) {
      return next();
    }

    const validationError = validateIdempotencyKey(rawKey);
    if (validationError) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: validationError,
      });
    }

    const key = String(rawKey).trim();
    const fingerprint = requestFingerprint(req);

    try {
      const store = await ensureStore();
      const existing = await store.get(key);

      if (existing?.status === 'completed') {
        if (existing.fingerprint !== fingerprint) {
          return res.status(409).json({
            error: 'Conflict',
            message: 'Idempotency-Key was already used with a different request payload.',
          });
        }
        return replayResponse(res, existing.response);
      }

      if (existing?.status === 'processing') {
        res.set('Retry-After', '1');
        return res.status(409).json({
          error: 'Conflict',
          message: 'A request with this Idempotency-Key is already in progress.',
        });
      }

      const acquired = await store.begin(key, fingerprint, ttlMs);
      if (!acquired) {
        const latest = await store.get(key);
        if (latest?.status === 'completed' && latest.fingerprint === fingerprint) {
          return replayResponse(res, latest.response);
        }

        res.set('Retry-After', '1');
        return res.status(409).json({
          error: 'Conflict',
          message: 'A request with this Idempotency-Key is already in progress.',
        });
      }

      const originalJson = res.json.bind(res);
      res.json = function jsonWithIdempotencyCapture(body) {
        res.json = originalJson;

        const responseRecord = {
          statusCode: res.statusCode || 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body,
        };

        store
          .complete(key, fingerprint, responseRecord, ttlMs)
          .catch((err) => {
            console.error('[idempotency] Failed to persist replay record\n', err);
          });

        return originalJson(body);
      };

      res.on('finish', () => {
        if (res.headersSent && res.statusCode >= 400) {
          store
            .abandon(key)
            .catch((err) => console.error('[idempotency] Failed to abandon in-flight key\n', err));
        }
      });

      return next();
    } catch (err) {
      console.error('[idempotency] Store error — allowing request (fail-open)\n', err);
      res.set('Idempotency-Degraded', 'true');
      return next();
    }
  };
}

export const idempotencyMiddleware = createIdempotencyMiddleware();
