/**
 * SHARED RATE LIMIT STORES
 * =======================
 * Pluggable backends for the API rate limiter. Each store implements the same
 * interface so the middleware can run against an in-process Map in development
 * or a Redis cluster in production without changing a single line of
 * application code.
 *
 * Interface (duck-typed):
 *   increment(identifier: string, windowMs: number, maxRequests: number)
 *     => Promise<{ allowed: boolean, remaining: number, resetTime: number, retryAfter?: number }>
 *   reset(identifier: string) => Promise<void>
 *   disconnect() => Promise<void>            (optional — used by RedisStore)
 *
 * Configuration via environment variables:
 *   REDIS_URL        – Redis connection string (e.g. redis://localhost:6379)
 *   RATE_LIMIT_STORE – Explicit store selection: "redis" | "memory"
 */

// ---------------------------------------------------------------------------
// MemoryStore – single-process sliding window (default / fallback)
// ---------------------------------------------------------------------------
class MemoryStore {
  constructor() {
    this._buckets = new Map();
    this._cleanupTimer = setInterval(() => this._cleanup(), 120_000);
  }

  /**
   * Record a hit for `identifier` within a sliding window.
   *
   * @param {string} identifier  – client identifier (IP, API key, etc.)
   * @param {number} windowMs    – sliding window duration in ms
   * @param {number} maxRequests – max allowed hits in the window
   * @returns {Promise<{
   *   allowed: boolean,
   *   remaining: number,
   *   resetTime: number,       // epoch ms when the window fully resets
   *   retryAfter?: number      // seconds until next available slot (only when !allowed)
   * }>}
   */
  async increment(identifier, windowMs, maxRequests) {
    const now = Date.now();
    let bucket = this._buckets.get(identifier);

    if (!bucket) {
      bucket = [];
      this._buckets.set(identifier, bucket);
    }

    // Remove timestamps outside the current window
    const cutoff = now - windowMs;
    const withinWindow = bucket.filter((ts) => ts > cutoff);

    if (withinWindow.length >= maxRequests) {
      const oldest = withinWindow[0];
      const resetTime = oldest + windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    }

    withinWindow.push(now);
    this._buckets.set(identifier, withinWindow);

    const remaining = maxRequests - withinWindow.length;

    return {
      allowed: true,
      remaining,
      resetTime: now + windowMs,
    };
  }

  /**
   * Clear all state for a given identifier.
   */
  async reset(identifier) {
    this._buckets.delete(identifier);
  }

  /** Periodic removal of stale buckets */
  _cleanup() {
    const now = Date.now();
    for (const [id, timestamps] of this._buckets.entries()) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < now - 600_000) {
        this._buckets.delete(id);
      }
    }
  }

  /** Release the cleanup interval */
  async disconnect() {
    clearInterval(this._cleanupTimer);
  }
}

// ---------------------------------------------------------------------------
// RedisStore – distributed sliding window via sorted sets
// ---------------------------------------------------------------------------
class RedisStore {
  /**
   * @param {object}   redisClient – ioredis-compatible client
   * @param {object}   [opts]
   * @param {function} [opts.log]   – logger (defaults to console)
   */
  constructor(redisClient, opts = {}) {
    this._redis = redisClient;
    this._log = opts.log || console;
  }

  /**
   * Lua script for atomic sliding-window check + increment.
   *
   * KEYS[1] – sorted set key (e.g. "rl:<identifier>")
   * ARGV[1] – now in ms
   * ARGV[2] – window start cutoff (now - windowMs)
   * ARGV[3] – maxRequests
   *
   * Returns: {remaining, resetTime}   on success
   *          {remaining: -1, resetTime} when rate-limited
   */
  static _SLIDING_WINDOW_SCRIPT = `
    local key    = KEYS[1]
    local now    = tonumber(ARGV[1])
    local cutoff = tonumber(ARGV[2])
    local limit  = tonumber(ARGV[3])

    -- Remove stale entries
    redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

    local count = redis.call('ZCARD', key)

    if count >= limit then
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')[2]
      return {-1, tonumber(oldest)}
    end

    -- Use a unique member (score + microsecond entropy) to avoid dedup
    local member = now .. ':' .. redis.call('INCR', key .. ':seq')
    redis.call('ZADD', key, now, member)
    redis.call('EXPIRE', key, math.ceil((now - cutoff) / 1000))
    redis.call('EXPIRE', key .. ':seq', math.ceil((now - cutoff) / 1000))

    count = redis.call('ZCARD', key)
    return {limit - count, now}
  `;

  /**
   * Record a hit for `identifier`.
   * Falls back to degradeGracefully() if Redis is unreachable.
   */
  async increment(identifier, windowMs, maxRequests) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const key = `rl:${identifier}`;

    try {
      const [rawRemaining, rawReset] = await this._redis.eval(
        RedisStore._SLIDING_WINDOW_SCRIPT,
        1,
        key,
        now,
        cutoff,
        maxRequests,
      );

      const remaining = Number(rawRemaining);
      if (remaining === -1) {
        // Rate limited — rawReset is the oldest timestamp still in window
        const oldest = Number(rawReset);
        const resetTime = oldest + windowMs;
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000),
        };
      }

      return {
        allowed: true,
        remaining,
        resetTime: now + windowMs,
      };
    } catch (err) {
      this._log.warn(
        `[rateLimiter] Redis increment failed for "${identifier}" — falling back to pass-through\n`,
        err.message,
      );
      // Degrade gracefully: allow the request so the API stays available
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: now + windowMs,
        _degraded: true,
      };
    }
  }

  async reset(identifier) {
    const key = `rl:${identifier}`;
    try {
      await this._redis.del(key, `${key}:seq`);
    } catch (err) {
      this._log.warn(`[rateLimiter] Redis reset failed for "${identifier}"\n`, err.message);
    }
  }

  async disconnect() {
    try {
      await this._redis.quit();
    } catch {
      // Ignore disconnect failures — the process is likely exiting
    }
  }
}

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

let _store = null;

/**
 * Return the configured rate-limit store, creating it on first call.
 *
 * Resolution order:
 * 1. RATE_LIMIT_STORE=redis with REDIS_URL    → RedisStore
 * 2. REDIS_URL without explicit RATE_LIMIT_STORE → RedisStore
 * 3. Everything else                           → MemoryStore
 *
 * If Redis is requested but the client fails to initialise, the factory
 * falls back to MemoryStore and logs a warning.
 *
 * @param {object}  [opts]
 * @param {function} [opts.log] – logger (defaults to console)
 * @returns {Promise<MemoryStore|RedisStore>}
 */
export async function getRateLimitStore(opts = {}) {
  if (_store) return _store;

  const log = opts.log || console;
  const storeEnv = (process.env.RATE_LIMIT_STORE || '').toLowerCase();
  const redisUrl = process.env.REDIS_URL;

  if (storeEnv === 'redis' || (redisUrl && storeEnv !== 'memory')) {
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(redisUrl || 'redis://localhost:6379', {
        maxRetriesPerRequest: 2,
        retryStrategy(times) {
          if (times > 3) return null; // stop retrying
          return Math.min(times * 200, 2000);
        },
        lazyConnect: false,
      });

      // Wait for the connection to establish (or fail)
      await new Promise((resolve, reject) => {
        redis.once('ready', resolve);
        redis.once('error', reject);
      });

      log.info('[rateLimiter] Connected to Redis — using distributed store');
      _store = new RedisStore(redis, { log });
      return _store;
    } catch (err) {
      log.warn(
        `[rateLimiter] Redis initialisation failed — falling back to in-memory store\n  ${err.message}`,
      );
    }
  }

  log.info('[rateLimiter] Using in-memory store (not shared across instances)');
  _store = new MemoryStore();
  return _store;
}

/**
 * Resets the cached store instance (primarily for testing).
 */
export function _resetStoreCache() {
  _store = null;
}

export { MemoryStore, RedisStore };
