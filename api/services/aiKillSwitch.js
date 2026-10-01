import { timingSafeEqual } from 'node:crypto';

const STATE_KEY = 'stellar-dashboard:ai-kill-switch';
const AUDIT_LIMIT = 100;

class MemoryKillSwitchStore {
  constructor() {
    this.state = { enabled: true, updatedAt: null, updatedBy: null, reason: null };
    this.audit = [];
  }

  async read() {
    return { ...this.state };
  }

  async update(enabled, actor, reason) {
    const now = new Date().toISOString();
    const entry = { enabled, previousEnabled: this.state.enabled, updatedAt: now, actor, reason };
    this.state = { enabled, updatedAt: now, updatedBy: actor, reason };
    this.audit.unshift(entry);
    this.audit.length = Math.min(this.audit.length, AUDIT_LIMIT);
    return { ...this.state };
  }

  async history() {
    return this.audit.map((entry) => ({ ...entry }));
  }
}

class RedisKillSwitchStore {
  constructor(redis) {
    this.redis = redis;
  }

  async read() {
    const raw = await this.redis.get(STATE_KEY);
    return raw
      ? JSON.parse(raw)
      : { enabled: true, updatedAt: null, updatedBy: null, reason: null };
  }

  async update(enabled, actor, reason) {
    const script = `
      local old = redis.call('GET', KEYS[1])
      local previous = true
      if old then previous = cjson.decode(old).enabled end
      local state = cjson.encode({enabled=ARGV[1] == 'true', updatedAt=ARGV[2], updatedBy=ARGV[3], reason=ARGV[4]})
      local audit = cjson.encode({enabled=ARGV[1] == 'true', previousEnabled=previous, updatedAt=ARGV[2], actor=ARGV[3], reason=ARGV[4]})
      redis.call('SET', KEYS[1], state)
      redis.call('LPUSH', KEYS[2], audit)
      redis.call('LTRIM', KEYS[2], 0, ${AUDIT_LIMIT - 1})
      return state
    `;
    const raw = await this.redis.eval(
      script,
      2,
      STATE_KEY,
      `${STATE_KEY}:audit`,
      String(enabled),
      new Date().toISOString(),
      actor,
      reason || ''
    );
    return JSON.parse(raw);
  }

  async history() {
    const rows = await this.redis.lrange(`${STATE_KEY}:audit`, 0, AUDIT_LIMIT - 1);
    return rows.map((row) => JSON.parse(row));
  }
}

let storePromise;
let injectedStore;

async function getStore() {
  if (injectedStore) return injectedStore;
  if (storePromise) return storePromise;
  storePromise = (async () => {
    const mode = (process.env.AI_KILL_SWITCH_STORE || '').toLowerCase();
    const redisUrl = process.env.REDIS_URL;
    if (mode && mode !== 'memory' && mode !== 'redis') {
      throw new Error('AI_KILL_SWITCH_STORE must be either redis or memory');
    }
    if (mode === 'memory' && process.env.NODE_ENV === 'production') {
      throw new Error('Process-local AI kill switch storage is unsupported in production');
    }
    if (mode === 'memory' || (!redisUrl && process.env.NODE_ENV !== 'production')) {
      return new MemoryKillSwitchStore();
    }
    if (!redisUrl) {
      throw new Error('AI kill switch requires REDIS_URL in production');
    }
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
    await redis.ping();
    return new RedisKillSwitchStore(redis);
  })().catch((error) => {
    storePromise = undefined;
    throw error;
  });
  return storePromise;
}

export function validateKillSwitchUpdate(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    typeof body.enabled !== 'boolean'
  ) {
    const error = new Error('enabled must be a boolean');
    error.status = 400;
    throw error;
  }
  const reason = body.reason === undefined ? '' : body.reason;
  const containsControlCharacter =
    typeof reason === 'string' &&
    Array.from(reason).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    );
  if (typeof reason !== 'string' || reason.length > 240 || containsControlCharacter) {
    const error = new Error('reason must be a string of at most 240 printable characters');
    error.status = 400;
    throw error;
  }
  return { enabled: body.enabled, reason: reason.trim() };
}

export function isOperatorTokenValid(token, expected = process.env.AI_KILL_SWITCH_OPERATOR_TOKEN) {
  if (typeof token !== 'string' || typeof expected !== 'string' || expected.length < 32)
    return false;
  const supplied = Buffer.from(token);
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

export async function getAIKillSwitch() {
  return (await getStore()).read();
}

export async function updateAIKillSwitch(enabled, actor, reason = '') {
  return (await getStore()).update(enabled, actor, reason);
}

export async function getAIKillSwitchHistory() {
  return (await getStore()).history();
}

export function setAIKillSwitchStoreForTests(store) {
  injectedStore = store;
  storePromise = undefined;
}

export function resetAIKillSwitchStoreForTests() {
  injectedStore = undefined;
  storePromise = undefined;
}

export { MemoryKillSwitchStore };
