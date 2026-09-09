/**
 * IDEMPOTENCY STORE BACKENDS
 * ==========================
 * Pluggable storage for idempotency replay records. Uses an in-memory Map in
 * development and Redis in production so retries stay consistent across
 * horizontally scaled API instances.
 */

const DEFAULT_TTL_MS = 86_400_000;

class MemoryIdempotencyStore {
  constructor() {
    /** @type {Map<string, { status: string, fingerprint: string, response?: object, expiresAt: number }>} */
    this._records = new Map();
    this._cleanupTimer = setInterval(() => this._cleanup(), 300_000);
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, record] of this._records.entries()) {
      if (record.expiresAt <= now) {
        this._records.delete(key);
      }
    }
  }

  async get(key) {
    const record = this._records.get(key);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      this._records.delete(key);
      return null;
    }
    return record;
  }

  async begin(key, fingerprint, ttlMs = DEFAULT_TTL_MS) {
    const existing = await this.get(key);
    if (existing) {
      return false;
    }

    this._records.set(key, {
      status: 'processing',
      fingerprint,
      expiresAt: Date.now() + ttlMs,
    });
    return true;
  }

  async complete(key, fingerprint, response, ttlMs = DEFAULT_TTL_MS) {
    this._records.set(key, {
      status: 'completed',
      fingerprint,
      response,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async abandon(key) {
    const record = this._records.get(key);
    if (record?.status === 'processing') {
      this._records.delete(key);
    }
  }

  async disconnect() {
    clearInterval(this._cleanupTimer);
  }
}

class RedisIdempotencyStore {
  /**
   * @param {import('ioredis').default} redis
   * @param {{ log?: Console }} [opts]
   */
  constructor(redis, opts = {}) {
    this._redis = redis;
    this._log = opts.log || console;
  }

  _key(key) {
    return `idempotency:${key}`;
  }

  async get(key) {
    try {
      const raw = await this._redis.get(this._key(key));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      this._log.warn('[idempotency] Redis get failed\n', err.message);
      throw err;
    }
  }

  async begin(key, fingerprint, ttlMs = DEFAULT_TTL_MS) {
    const redisKey = this._key(key);
    const payload = JSON.stringify({
      status: 'processing',
      fingerprint,
      expiresAt: Date.now() + ttlMs,
    });

    const result = await this._redis.set(redisKey, payload, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async complete(key, fingerprint, response, ttlMs = DEFAULT_TTL_MS) {
    const redisKey = this._key(key);
    const payload = JSON.stringify({
      status: 'completed',
      fingerprint,
      response,
      expiresAt: Date.now() + ttlMs,
    });
    await this._redis.set(redisKey, payload, 'PX', ttlMs);
  }

  async abandon(key) {
    try {
      const record = await this.get(key);
      if (record?.status === 'processing') {
        await this._redis.del(this._key(key));
      }
    } catch (err) {
      this._log.warn('[idempotency] Redis abandon failed\n', err.message);
    }
  }

  async disconnect() {
    try {
      await this._redis.quit();
    } catch {
      // ignore shutdown errors
    }
  }
}

let _store = null;

/**
 * Resolve the configured idempotency store.
 *
 * @returns {Promise<MemoryIdempotencyStore|RedisIdempotencyStore>}
 */
export async function getIdempotencyStore(opts = {}) {
  if (_store) return _store;

  const log = opts.log || console;
  const storeEnv = (process.env.IDEMPOTENCY_STORE || 'memory').toLowerCase();
  const redisUrl = process.env.REDIS_URL;

  if (storeEnv === 'redis') {
    if (!redisUrl) {
      log.warn('[idempotency] IDEMPOTENCY_STORE=redis but REDIS_URL is unset — using memory store');
    } else {
      try {
        const { default: Redis } = await import('ioredis');
        const redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 2,
          retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
          },
        });

        await new Promise((resolve, reject) => {
          redis.once('ready', resolve);
          redis.once('error', reject);
        });

        log.info('[idempotency] Connected to Redis — using distributed store');
        _store = new RedisIdempotencyStore(redis, { log });
        return _store;
      } catch (err) {
        log.warn(
          `[idempotency] Redis initialisation failed — falling back to in-memory store\n  ${err.message}`,
        );
      }
    }
  }

  log.info('[idempotency] Using in-memory store (not shared across instances)');
  _store = new MemoryIdempotencyStore();
  return _store;
}

/** Reset cached store (testing helper). */
export function _resetIdempotencyStoreCache() {
  _store = null;
}

export { MemoryIdempotencyStore, RedisIdempotencyStore };
