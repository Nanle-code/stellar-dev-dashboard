import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { getIdempotencyStore } from './idempotencyStore';

export interface IdempotencyRecord {
  status: 'processing' | 'completed';
  fingerprint: string;
  response: IdempotencyResponse;
}

export interface IdempotencyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export type IdempotencyStore = {
  get(key: string): Promise<IdempotencyRecord | null>;
  begin(key: string, fingerprint: string, ttlMs: number): Promise<boolean>;
  complete(key: string, fingerprint: string, response: IdempotencyResponse, ttlMs: number): Promise<void>;
};

interface IdempotencyConfig {
  enabled: boolean;
  ttlMs: number;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DEFAULT_TTL_MS = 86_400_000; // 24 hours
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function config(): IdempotencyConfig {
  const enabled = (process.env.IDEMPOTENCY_ENABLED || 'true').toLowerCase() !== 'false';

  const rawTtl = process.env.IDEMPOTENCY_TTL_MS;
  const ttlMs =
    rawTtl && Number.isFinite(Number(rawTtl)) && Number(rawTtl) >= 60_000
      ? Number(rawTtl)
      : DEFAULT_TTL_MS;

  return { enabled, ttlMs };
}

export function requestFingerprint(req: Request): string {
  const body = req.body === undefined || req.body === null ? '' : JSON.stringify(req.body);
  return crypto
    .createHash('sha256')
    .update(`${req.method}\n${req.path}\n${body}`)
    .digest('hex');
}

export function validateIdempotencyKey(key: unknown): string | null {
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

let _storePromise: Promise<IdempotencyStore> | null = null;

async function ensureStore(): Promise<IdempotencyStore> {
  if (!_storePromise) {
    _storePromise = getIdempotencyStore();
  }
  return _storePromise;
}

function replayResponse(res: Response, record: IdempotencyResponse): void {
  res.set('Idempotency-Replayed', 'true');
  for (const [name, value] of Object.entries(record.headers || {})) {
    if (!['content-length', 'transfer-encoding'].includes(name.toLowerCase())) {
      res.set(name, value);
    }
  }
  res.status(record.statusCode).json(record.body);
}

export function createIdempotencyMiddleware() {
  const { enabled, ttlMs } = config();

  return async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      (res.json as any) = function jsonWithIdempotencyCapture(body: unknown) {
        (res.json as any) = originalJson;

        const responseRecord: IdempotencyResponse = {
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

      next();
    } catch (err) {
      console.error('[idempotency] Store error — proceeding without idempotency\n', err);
      next();
    }
  };
}

export const idempotencyMiddleware = createIdempotencyMiddleware();
