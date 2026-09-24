import type { Redis } from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  _degraded?: boolean;
}

export interface RateLimitStore {
  increment(identifier: string, windowMs: number, maxRequests: number): Promise<RateLimitResult>;
  reset(identifier: string): Promise<void>;
  disconnect(): Promise<void>;
}

class MemoryStore implements RateLimitStore {
  private _buckets: Map<string, number[]> = new Map();
  private _cleanupTimer: NodeJS.Timeout;

  constructor() {
    this._cleanupTimer = setInterval(() => this._cleanup(), 120_000);
  }

  async increment(identifier: string, windowMs: number, maxRequests: number): Promise<RateLimitResult> {
    const now = Date.now();
    let bucket = this._buckets.get(identifier);

    if (!bucket) {
      bucket = [];
      this._buckets.set(identifier, bucket);
    }

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

  async reset(identifier: string): Promise<void> {
    this._buckets.delete(identifier);
  }

  private _cleanup(): void {
    const now = Date.now();
    for (const [id, timestamps] of this._buckets.entries()) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < now - 600_000) {
        this._buckets.delete(id);
      }
    }
  }

  async disconnect(): Promise<void> {
    clearInterval(this._cleanupTimer);
  }
}

class RedisStore implements RateLimitStore {
  private _redis: Redis;
  private _log: Console;

  private static readonly _SLIDING_WINDOW_SCRIPT = `
    local key    = KEYS[1]
    local now    = tonumber(ARGV[1])
    local cutoff = tonumber(ARGV[2])
    local limit  = tonumber(ARGV[3])

    redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)

    local count = redis.call('ZCARD', key)

    if count >= limit then
      local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')[2]
      return {-1, tonumber(oldest)}
    end

    local member = now .. ':' .. redis.call('INCR', key .. ':seq')
    redis.call('ZADD', key, now, member)
    redis.call('EXPIRE', key, math.ceil((now - cutoff) / 1000))
    redis.call('EXPIRE', key .. ':seq', math.ceil((now - cutoff) / 1000))

    count = redis.call('ZCARD', key)
    return {limit - count, now}
  `;

  constructor(redisClient: Redis, opts: { log?: Console } = {}) {
    this._redis = redisClient;
    this._log = opts.log || console;
  }

  async increment(identifier: string, windowMs: number, maxRequests: number): Promise<RateLimitResult> {
    const now = Date.now();
    const cutoff = now - windowMs;
    const key = `rl:${identifier}`;

    try {
      const result = (await (this._redis as any).eval(
        RedisStore._SLIDING_WINDOW_SCRIPT,
        1,
        key,
        now,
        cutoff,
        maxRequests,
      )) as [number, number];

      const [rawRemaining, rawReset] = result;
      const remaining = Number(rawRemaining);

      if (remaining === -1) {
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
      const errorMsg = err instanceof Error ? err.message : String(err);
      this._log.warn(
        `[rateLimiter] Redis increment failed for "${identifier}" — falling back to pass-through\n`,
        errorMsg,
      );
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: now + windowMs,
        _degraded: true,
      };
    }
  }

  async reset(identifier: string): Promise<void> {
    const key = `rl:${identifier}`;
    try {
      await this._redis.del(key, `${key}:seq`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this._log.warn(`[rateLimiter] Redis reset failed for "${identifier}"\n`, errorMsg);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this._redis.quit();
    } catch {
      // Ignore
    }
  }
}

let _store: RateLimitStore | null = null;

interface GetStoreOptions {
  log?: Console;
}

export async function getRateLimitStore(opts: GetStoreOptions = {}): Promise<RateLimitStore> {
  if (_store) return _store;

  const log = opts.log || console;
  const storeEnv = (process.env.RATE_LIMIT_STORE || '').toLowerCase();
  const redisUrl = process.env.REDIS_URL;

  if (storeEnv === 'redis' || (redisUrl && storeEnv !== 'memory')) {
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(redisUrl || 'redis://localhost:6379', {
        maxRetriesPerRequest: 2,
        retryStrategy(times: number) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: false,
      } as any);

      await new Promise<void>((resolve, reject) => {
        redis.once('ready', resolve);
        redis.once('error', reject);
      });

      log.info('[rateLimiter] Connected to Redis — using distributed store');
      _store = new RedisStore(redis, { log });
      return _store;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.warn(
        `[rateLimiter] Redis initialisation failed — falling back to in-memory store\n  ${errorMsg}`,
      );
    }
  }

  log.info('[rateLimiter] Using in-memory store (not shared across instances)');
  _store = new MemoryStore();
  return _store;
}

export function _resetStoreCache(): void {
  _store = null;
}

export { MemoryStore, RedisStore };
