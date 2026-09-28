import type { Redis } from 'ioredis';

export interface IdempotencyRecord {
  status: 'processing' | 'completed';
  fingerprint: string;
  response?: IdempotencyResponse;
  expiresAt: number;
}

export interface IdempotencyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface IdempotencyStoreBackend {
  get(key: string): Promise<IdempotencyRecord | null>;
  begin(key: string, fingerprint: string, ttlMs?: number): Promise<boolean>;
  complete(key: string, fingerprint: string, response: IdempotencyResponse, ttlMs?: number): Promise<void>;
  abandon(key: string): Promise<void>;
  disconnect(): Promise<void>;
}

const DEFAULT_TTL_MS = 86_400_000;

class MemoryIdempotencyStore implements IdempotencyStoreBackend {
  private _records: Map<string, IdempotencyRecord> = new Map();
  private _cleanupTimer: NodeJS.Timeout;

  constructor() {
    this._cleanupTimer = setInterval(() => this._cleanup(), 300_000);
  }

  private _cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this._records.entries()) {
      if (record.expiresAt <= now) {
        this._records.delete(key);
      }
    }
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this._records.get(key);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      this._records.delete(key);
      return null;
    }
    return record;
  }

  async begin(key: string, fingerprint: string, ttlMs: number = DEFAULT_TTL_MS): Promise<boolean> {
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

  async complete(key: string, fingerprint: string, response: IdempotencyResponse, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    this._records.set(key, {
      status: 'completed',
      fingerprint,
      response,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async abandon(key: string): Promise<void> {
    const record = this._records.get(key);
    if (record?.status === 'processing') {
      this._records.delete(key);
    }
  }

  async disconnect(): Promise<void> {
    clearInterval(this._cleanupTimer);
  }
}

class RedisIdempotencyStore implements IdempotencyStoreBackend {
  private _redis: Redis;
  private _log: Console;

  constructor(redis: Redis, opts: { log?: Console } = {}) {
    this._redis = redis;
    this._log = opts.log || console;
  }

  private _key(key: string): string {
    return `idempotency:${key}`;
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    try {
      const raw = await this._redis.get(this._key(key));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this._log.warn('[idempotency] Redis get failed\n', errorMsg);
      throw err;
    }
  }

  async begin(key: string, fingerprint: string, ttlMs: number = DEFAULT_TTL_MS): Promise<boolean> {
    const redisKey = this._key(key);
    const payload = JSON.stringify({
      status: 'processing',
      fingerprint,
      expiresAt: Date.now() + ttlMs,
    });

    const result = await (this._redis as any).set(redisKey, payload, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async complete(key: string, fingerprint: string, response: IdempotencyResponse, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    const redisKey = this._key(key);
    const payload = JSON.stringify({
      status: 'completed',
      fingerprint,
      response,
      expiresAt: Date.now() + ttlMs,
    });
    await (this._redis as any).set(redisKey, payload, 'PX', ttlMs);
  }

  async abandon(key: string): Promise<void> {
    try {
      const record = await this.get(key);
      if (record?.status === 'processing') {
        await this._redis.del(this._key(key));
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this._log.warn('[idempotency] Redis abandon failed\n', errorMsg);
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this._redis.quit();
    } catch {
      // ignore
    }
  }
}

let _store: IdempotencyStoreBackend | null = null;

interface GetIdempotencyStoreOptions {
  log?: Console;
}

export async function getIdempotencyStore(opts: GetIdempotencyStoreOptions = {}): Promise<IdempotencyStoreBackend> {
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
          retryStrategy(times: number) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
          },
        } as any);

        await new Promise<void>((resolve, reject) => {
          redis.once('ready', resolve);
          redis.once('error', reject);
        });

        log.info('[idempotency] Connected to Redis — using distributed store');
        _store = new RedisIdempotencyStore(redis, { log });
        return _store;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.warn(
          `[idempotency] Redis initialisation failed — falling back to in-memory store\n  ${errorMsg}`,
        );
      }
    }
  }

  log.info('[idempotency] Using in-memory store (not shared across instances)');
  _store = new MemoryIdempotencyStore();
  return _store;
}

export function _resetIdempotencyStoreCache(): void {
  _store = null;
}

export { MemoryIdempotencyStore, RedisIdempotencyStore };
