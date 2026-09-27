import { Request, Response, NextFunction } from 'express';
import { getRateLimitStore } from './stores';

export type RateLimitStore = {
  increment(identifier: string, windowMs: number, maxRequests: number): Promise<RateLimitResult>;
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;

function config(): RateLimitConfig {
  const rawMax = process.env.RATE_LIMIT_MAX;
  const rawWindow = process.env.RATE_LIMIT_WINDOW;

  const maxRequests =
    rawMax && Number.isFinite(Number(rawMax)) && Number(rawMax) > 0
      ? Number(rawMax)
      : DEFAULT_MAX_REQUESTS;

  const windowMs =
    rawWindow && Number.isFinite(Number(rawWindow)) && Number(rawWindow) >= 1000
      ? Number(rawWindow)
      : DEFAULT_WINDOW_MS;

  return { maxRequests, windowMs };
}

function clientIdentifier(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim() || null;
  }
  return req.ip || (req.socket?.remoteAddress as string) || (req.connection?.remoteAddress as string) || null;
}

function validateIdentifier(identifier: string | null): string | null {
  if (!identifier || typeof identifier !== 'string') {
    return 'Could not determine client address';
  }

  const stripped = identifier.replace(/^::ffff:/, '');

  if (stripped.length > 45 || !/^[0-9a-fA-F.:]+$/.test(stripped)) {
    return `Malformed client address: ${identifier.slice(0, 20)}`;
  }

  return null;
}

function setRateLimitHeaders(res: Response, result: RateLimitResult, maxRequests: number): void {
  res.set({
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(result.resetTime),
  });

  if (!result.allowed && result.retryAfter !== undefined) {
    res.set('Retry-After', String(Math.max(1, Math.ceil(result.retryAfter))));
  }
}

let _storePromise: Promise<RateLimitStore> | null = null;

async function ensureStore(): Promise<RateLimitStore> {
  if (!_storePromise) {
    _storePromise = getRateLimitStore();
  }
  return _storePromise;
}

export function createRateLimiter() {
  const { maxRequests, windowMs } = config();

  return async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
    const identifier = clientIdentifier(req);
    const validationError = validateIdentifier(identifier);

    if (validationError) {
      res.status(400).json({
        error: 'Bad Request',
        message: validationError,
      });
      return;
    }

    try {
      const store = await ensureStore();
      const result = await store.increment(identifier!, windowMs, maxRequests);

      setRateLimitHeaders(res, result, maxRequests);

      if (!result.allowed) {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please wait before retrying.',
          retryAfter: result.retryAfter,
        });
        return;
      }

      next();
    } catch (err) {
      console.error(`[rateLimiter] Unexpected error — allowing request\n`, err);
      next();
    }
  };
}

export const rateLimiter = createRateLimiter();
