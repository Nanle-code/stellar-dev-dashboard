/**
 * SERVER-SIDE RATE LIMITER MIDDLEWARE
 * ===================================
 * Enforces per-client rate limits on the Express API using a pluggable
 * backing store.  The store is selected once at startup (Redis for
 * production / multi-instance deployments, in-memory for development)
 * and remains active for the lifetime of the process.
 *
 * Features
 * --------
 * • Shared store — limits stay consistent across processes when backed
 *   by Redis so a load-balanced fleet enforces the same ceiling.
 * • Sliding window — timestamps older than the window are discarded on
 *   each check, giving a rolling count of recent requests.
 * • Retry headers — `Retry-After`, `X-RateLimit-Limit`,
 *   `X-RateLimit-Remaining`, and `X-RateLimit-Reset` are always set,
 *   helping well-behaved clients back off without guessing.
 * • Graceful degradation — if the Redis store is unreachable the
 *   middleware still allows requests (fail-open) rather than blocking
 *   legitimate traffic.
 * • Configurable — limits and window are controlled via environment
 *   variables so operators can tune them without code changes.
 *
 * Environment variables
 * ---------------------
 *   RATE_LIMIT_MAX    – max requests per window  (default 100)
 *   RATE_LIMIT_WINDOW – window duration in ms    (default 60_000)
 *   REDIS_URL         – Redis connection string   (optional)
 *   RATE_LIMIT_STORE  – "redis" | "memory"        (optional)
 *
 * Failure modes
 * -------------
 * 1. Missing / invalid IP  → 400 Bad Request (explicit message)
 * 2. Store throws           → request allowed (fail-open with log)
 * 3. Redis unreachable      → fallback to memory store at startup
 */

import { getRateLimitStore } from './stores.js';

// ── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 100;

function config() {
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

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract a stable client identifier from the request.
 * Prefer the left-most entry of `X-Forwarded-For` when behind a trusted
 * proxy; otherwise fall back to the socket remote address.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function clientIdentifier(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim() || null;
  }
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || null;
}

/**
 * Validate the extracted identifier.  Returns a human-readable error string
 * on failure, or `null` if valid.
 */
function validateIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return 'Could not determine client address';
  }

  const stripped = identifier.replace(/^::ffff:/, '');

  // Basic length & character sanity check
  if (stripped.length > 45 || !/^[0-9a-fA-F.:]+$/.test(stripped)) {
    return `Malformed client address: ${identifier.slice(0, 20)}`;
  }

  return null; // valid
}

/**
 * Set rate-limit informational headers on the response.
 */
function setRateLimitHeaders(res, result, maxRequests) {
  res.set({
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(result.resetTime),
  });

  if (!result.allowed && result.retryAfter !== undefined) {
    res.set('Retry-After', String(Math.max(1, Math.ceil(result.retryAfter))));
  }
}

// ── Middleware factory ─────────────────────────────────────────────────────

let _storePromise = null;

/**
 * Lazily initialises the rate-limit store on first request.  This keeps
 * the import of optional dependencies (ioredis) out of the critical path
 * and allows the process to start even when Redis is temporarily down.
 */
async function ensureStore() {
  if (!_storePromise) {
    _storePromise = getRateLimitStore();
  }
  return _storePromise;
}

/**
 * Create the Express rate-limiter middleware.
 *
 * Usage:
 *   import { createRateLimiter } from './middleware/rateLimiter.js';
 *   app.use(createRateLimiter());
 */
export function createRateLimiter() {
  const { maxRequests, windowMs } = config();

  return async function rateLimiter(req, res, next) {
    // ── 1. Validate input ─────────────────────────────────────────────────
    const identifier = clientIdentifier(req);

    const validationError = validateIdentifier(identifier);
    if (validationError) {
      res.status(400).json({
        error: 'Bad Request',
        message: validationError,
      });
      return;
    }

    // ── 2. Try the store ──────────────────────────────────────────────────
    try {
      const store = await ensureStore();
      const result = await store.increment(identifier, windowMs, maxRequests);

      // Always attach informational headers
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
      // ── 3. Fail open ──────────────────────────────────────────────────
      // If the store throws unexpectedly we allow the request rather than
      // blocking all traffic.  This is the safest default for an API
      // dashboard that is not serving financial transactions directly.
      console.error(`[rateLimiter] Unexpected error — allowing request\n`, err);
      next();
    }
  };
}

// ── Pre-configured singleton (backward-compatible default export) ─────────

export const rateLimiter = createRateLimiter();
