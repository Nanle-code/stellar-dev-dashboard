/**
 * Feature Flag Lifecycle Management (#819)
 *
 * Defines create → evaluate → expire → retire flows for dashboard feature flags,
 * with append-only audit history. Pure in-memory service (injectable clock/store)
 * so it works in browser and Node test environments.
 */

export type FeatureFlagEnvironment = 'development' | 'staging' | 'production' | 'test';

export type FeatureFlagStatus = 'draft' | 'active' | 'expired' | 'retired';

export type FeatureFlagAuditAction =
  | 'created'
  | 'activated'
  | 'evaluated'
  | 'expired'
  | 'retired'
  | 'failed';

export interface FeatureFlagDefinition {
  /** Stable kebab/snake/camel key, 2–64 chars, [a-zA-Z0-9._-] */
  key: string;
  name: string;
  description?: string;
  /** Environments where the flag may be evaluated */
  environments: FeatureFlagEnvironment[];
  /** Optional ISO expiry; after this instant evaluate() forces expired */
  expiresAt?: string | null;
  /** Percentage rollout 0–100 (inclusive) */
  rolloutPercent?: number;
  /** Optional allow-list; when set, only these subjects get a positive eval */
  allowlist?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface FeatureFlag extends FeatureFlagDefinition {
  id: string;
  status: FeatureFlagStatus;
  createdAt: string;
  updatedAt: string;
  retiredAt?: string | null;
  expiredAt?: string | null;
}

export interface FeatureFlagAuditEntry {
  id: string;
  flagId: string;
  flagKey: string;
  action: FeatureFlagAuditAction;
  at: string;
  actor?: string;
  environment?: FeatureFlagEnvironment;
  detail?: string;
  success: boolean;
}

export interface EvaluateOptions {
  environment: FeatureFlagEnvironment;
  subjectId?: string;
  actor?: string;
}

export interface EvaluateResult {
  enabled: boolean;
  reason:
    | 'active'
    | 'draft'
    | 'expired'
    | 'retired'
    | 'unsupported_environment'
    | 'not_in_allowlist'
    | 'rollout_excluded'
    | 'flag_not_found';
  flag?: FeatureFlag;
}

export interface FeatureFlagStore {
  flags: Map<string, FeatureFlag>;
  /** key → id */
  keyIndex: Map<string, string>;
  audit: FeatureFlagAuditEntry[];
}

export class FeatureFlagError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FeatureFlagError';
    this.code = code;
  }
}

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9._-]{1,63}$/;
const SUPPORTED_ENVIRONMENTS: readonly FeatureFlagEnvironment[] = [
  'development',
  'staging',
  'production',
  'test',
];

export function createEmptyStore(): FeatureFlagStore {
  return {
    flags: new Map(),
    keyIndex: new Map(),
    audit: [],
  };
}

function assertValidKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || !KEY_RE.test(key)) {
    throw new FeatureFlagError(
      'INVALID_KEY',
      'Flag key must be 2–64 chars, start with a letter, and use only [a-zA-Z0-9._-]',
    );
  }
}

function assertValidName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 120) {
    throw new FeatureFlagError('INVALID_NAME', 'Flag name must be 1–120 non-empty characters');
  }
}

function normalizeEnvironments(envs: unknown): FeatureFlagEnvironment[] {
  if (!Array.isArray(envs) || envs.length === 0) {
    throw new FeatureFlagError(
      'INVALID_ENVIRONMENTS',
      'At least one environment is required',
    );
  }
  const unique = [...new Set(envs)];
  for (const env of unique) {
    if (!SUPPORTED_ENVIRONMENTS.includes(env as FeatureFlagEnvironment)) {
      throw new FeatureFlagError(
        'UNSUPPORTED_ENVIRONMENT',
        `Unsupported environment: ${String(env)}. Allowed: ${SUPPORTED_ENVIRONMENTS.join(', ')}`,
      );
    }
  }
  return unique as FeatureFlagEnvironment[];
}

function normalizeRollout(percent: unknown): number {
  if (percent === undefined || percent === null) return 100;
  if (typeof percent !== 'number' || Number.isNaN(percent) || !Number.isFinite(percent)) {
    throw new FeatureFlagError('INVALID_ROLLOUT', 'rolloutPercent must be a finite number');
  }
  if (percent < 0 || percent > 100) {
    throw new FeatureFlagError('INVALID_ROLLOUT', 'rolloutPercent must be between 0 and 100');
  }
  return percent;
}

function parseExpiresAt(value: unknown, now: Date): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new FeatureFlagError('INVALID_EXPIRY', 'expiresAt must be an ISO-8601 string');
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new FeatureFlagError('INVALID_EXPIRY', `Invalid expiresAt timestamp: ${value}`);
  }
  if (ms <= now.getTime()) {
    throw new FeatureFlagError('INVALID_EXPIRY', 'expiresAt must be in the future at create time');
  }
  return new Date(ms).toISOString();
}

/** Stable 0–99 bucket for subject-based rollout (FNV-1a style). */
export function subjectRolloutBucket(subjectId: string, flagKey: string): number {
  const input = `${flagKey}::${subjectId}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

export class FeatureFlagLifecycleService {
  private readonly store: FeatureFlagStore;
  private readonly nowFn: () => Date;
  private seq = 0;

  constructor(options?: { store?: FeatureFlagStore; now?: () => Date }) {
    this.store = options?.store ?? createEmptyStore();
    this.nowFn = options?.now ?? (() => new Date());
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.nowFn().getTime()}_${this.seq}`;
  }

  private audit(
    flag: Pick<FeatureFlag, 'id' | 'key'>,
    action: FeatureFlagAuditAction,
    opts: {
      success: boolean;
      actor?: string;
      environment?: FeatureFlagEnvironment;
      detail?: string;
    },
  ): FeatureFlagAuditEntry {
    const entry: FeatureFlagAuditEntry = {
      id: this.nextId('audit'),
      flagId: flag.id,
      flagKey: flag.key,
      action,
      at: this.nowFn().toISOString(),
      actor: opts.actor,
      environment: opts.environment,
      detail: opts.detail,
      success: opts.success,
    };
    this.store.audit.unshift(entry);
    return entry;
  }

  /** Create a flag in draft status (must activate before evaluate returns enabled). */
  create(input: FeatureFlagDefinition, actor?: string): FeatureFlag {
    assertValidKey(input.key);
    assertValidName(input.name);
    const environments = normalizeEnvironments(input.environments);
    const rolloutPercent = normalizeRollout(input.rolloutPercent);
    const now = this.nowFn();
    const expiresAt = parseExpiresAt(input.expiresAt, now);

    if (this.store.keyIndex.has(input.key)) {
      this.audit({ id: 'unknown', key: input.key }, 'failed', {
        success: false,
        actor,
        detail: `Duplicate flag key: ${input.key}`,
      });
      throw new FeatureFlagError('DUPLICATE_KEY', `Flag key already exists: ${input.key}`);
    }

    const flag: FeatureFlag = {
      id: this.nextId('flag'),
      key: input.key,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      environments,
      expiresAt,
      rolloutPercent,
      allowlist: input.allowlist ? [...input.allowlist] : undefined,
      metadata: input.metadata ? { ...input.metadata } : undefined,
      createdBy: actor ?? input.createdBy,
      status: 'draft',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      retiredAt: null,
      expiredAt: null,
    };

    this.store.flags.set(flag.id, flag);
    this.store.keyIndex.set(flag.key, flag.id);
    this.audit(flag, 'created', {
      success: true,
      actor,
      detail: `Created draft flag "${flag.key}"`,
    });
    return { ...flag, allowlist: flag.allowlist ? [...flag.allowlist] : undefined };
  }

  /** Transition draft → active (or re-activate expired if not retired). */
  activate(keyOrId: string, actor?: string): FeatureFlag {
    const flag = this.requireFlag(keyOrId);
    if (flag.status === 'retired') {
      this.audit(flag, 'failed', {
        success: false,
        actor,
        detail: 'Cannot activate a retired flag',
      });
      throw new FeatureFlagError('FLAG_RETIRED', `Flag is retired: ${flag.key}`);
    }
    if (flag.status === 'active') {
      return this.clone(flag);
    }

    const now = this.nowFn();
    if (flag.expiresAt && Date.parse(flag.expiresAt) <= now.getTime()) {
      flag.status = 'expired';
      flag.expiredAt = now.toISOString();
      flag.updatedAt = now.toISOString();
      this.audit(flag, 'expired', {
        success: true,
        actor,
        detail: 'Auto-expired on activate because expiresAt is in the past',
      });
      throw new FeatureFlagError(
        'FLAG_EXPIRED',
        `Cannot activate flag "${flag.key}": expiresAt is in the past`,
      );
    }

    flag.status = 'active';
    flag.updatedAt = now.toISOString();
    this.audit(flag, 'activated', {
      success: true,
      actor,
      detail: `Activated flag "${flag.key}"`,
    });
    return this.clone(flag);
  }

  /**
   * Evaluate whether a flag is enabled for a subject/environment.
   * Never throws for missing flags — returns enabled:false with reason.
   * Throws FeatureFlagError only for invalid evaluate options.
   */
  evaluate(keyOrId: string, options: EvaluateOptions): EvaluateResult {
    if (!options || typeof options !== 'object') {
      throw new FeatureFlagError('INVALID_EVAL_OPTIONS', 'evaluate options are required');
    }
    const { environment, subjectId, actor } = options;
    if (!SUPPORTED_ENVIRONMENTS.includes(environment)) {
      throw new FeatureFlagError(
        'UNSUPPORTED_ENVIRONMENT',
        `Unsupported environment: ${String(environment)}`,
      );
    }

    const flag = this.findFlag(keyOrId);
    if (!flag) {
      this.audit({ id: 'unknown', key: String(keyOrId) }, 'evaluated', {
        success: false,
        actor,
        environment,
        detail: 'Flag not found',
      });
      return { enabled: false, reason: 'flag_not_found' };
    }

    const now = this.nowFn();
    if (
      flag.status === 'active' &&
      flag.expiresAt &&
      Date.parse(flag.expiresAt) <= now.getTime()
    ) {
      flag.status = 'expired';
      flag.expiredAt = now.toISOString();
      flag.updatedAt = now.toISOString();
      this.audit(flag, 'expired', {
        success: true,
        actor,
        environment,
        detail: 'Auto-expired during evaluate',
      });
    }

    let result: EvaluateResult;

    if (flag.status === 'retired') {
      result = { enabled: false, reason: 'retired', flag: this.clone(flag) };
    } else if (flag.status === 'expired') {
      result = { enabled: false, reason: 'expired', flag: this.clone(flag) };
    } else if (flag.status === 'draft') {
      result = { enabled: false, reason: 'draft', flag: this.clone(flag) };
    } else if (!flag.environments.includes(environment)) {
      result = {
        enabled: false,
        reason: 'unsupported_environment',
        flag: this.clone(flag),
      };
    } else if (flag.allowlist && flag.allowlist.length > 0) {
      if (!subjectId || !flag.allowlist.includes(subjectId)) {
        result = { enabled: false, reason: 'not_in_allowlist', flag: this.clone(flag) };
      } else {
        result = { enabled: true, reason: 'active', flag: this.clone(flag) };
      }
    } else if ((flag.rolloutPercent ?? 100) < 100) {
      if (!subjectId) {
        result = { enabled: false, reason: 'rollout_excluded', flag: this.clone(flag) };
      } else {
        const bucket = subjectRolloutBucket(subjectId, flag.key);
        const enabled = bucket < (flag.rolloutPercent ?? 100);
        result = {
          enabled,
          reason: enabled ? 'active' : 'rollout_excluded',
          flag: this.clone(flag),
        };
      }
    } else {
      result = { enabled: true, reason: 'active', flag: this.clone(flag) };
    }

    this.audit(flag, 'evaluated', {
      success: result.enabled,
      actor,
      environment,
      detail: `evaluate → ${result.reason} (enabled=${result.enabled})`,
    });
    return result;
  }

  /** Mark an active/draft flag as expired (lifecycle expire flow). */
  expire(keyOrId: string, actor?: string): FeatureFlag {
    const flag = this.requireFlag(keyOrId);
    if (flag.status === 'retired') {
      this.audit(flag, 'failed', {
        success: false,
        actor,
        detail: 'Cannot expire a retired flag',
      });
      throw new FeatureFlagError('FLAG_RETIRED', `Flag is retired: ${flag.key}`);
    }
    if (flag.status === 'expired') {
      return this.clone(flag);
    }
    const now = this.nowFn();
    flag.status = 'expired';
    flag.expiredAt = now.toISOString();
    flag.updatedAt = now.toISOString();
    this.audit(flag, 'expired', {
      success: true,
      actor,
      detail: `Manually expired flag "${flag.key}"`,
    });
    return this.clone(flag);
  }

  /** Retire a flag permanently (terminal state). */
  retire(keyOrId: string, actor?: string): FeatureFlag {
    const flag = this.requireFlag(keyOrId);
    if (flag.status === 'retired') {
      return this.clone(flag);
    }
    const now = this.nowFn();
    flag.status = 'retired';
    flag.retiredAt = now.toISOString();
    flag.updatedAt = now.toISOString();
    this.audit(flag, 'retired', {
      success: true,
      actor,
      detail: `Retired flag "${flag.key}"`,
    });
    return this.clone(flag);
  }

  list(status?: FeatureFlagStatus): FeatureFlag[] {
    const all = [...this.store.flags.values()].map((f) => this.clone(f));
    if (!status) return all.sort((a, b) => a.key.localeCompare(b.key));
    return all.filter((f) => f.status === status).sort((a, b) => a.key.localeCompare(b.key));
  }

  get(keyOrId: string): FeatureFlag | undefined {
    const flag = this.findFlag(keyOrId);
    return flag ? this.clone(flag) : undefined;
  }

  getAuditHistory(flagKeyOrId?: string, limit = 100): FeatureFlagAuditEntry[] {
    const entries = flagKeyOrId
      ? this.store.audit.filter(
          (e) => e.flagKey === flagKeyOrId || e.flagId === flagKeyOrId,
        )
      : this.store.audit;
    return entries.slice(0, Math.max(0, limit)).map((e) => ({ ...e }));
  }

  private findFlag(keyOrId: string): FeatureFlag | undefined {
    if (!keyOrId || typeof keyOrId !== 'string') return undefined;
    if (this.store.flags.has(keyOrId)) return this.store.flags.get(keyOrId);
    const id = this.store.keyIndex.get(keyOrId);
    return id ? this.store.flags.get(id) : undefined;
  }

  private requireFlag(keyOrId: string): FeatureFlag {
    const flag = this.findFlag(keyOrId);
    if (!flag) {
      throw new FeatureFlagError('FLAG_NOT_FOUND', `Flag not found: ${keyOrId}`);
    }
    return flag;
  }

  private clone(flag: FeatureFlag): FeatureFlag {
    return {
      ...flag,
      environments: [...flag.environments],
      allowlist: flag.allowlist ? [...flag.allowlist] : undefined,
      metadata: flag.metadata ? { ...flag.metadata } : undefined,
    };
  }
}

/** Shared singleton for dashboard UI (browser). */
let defaultService: FeatureFlagLifecycleService | null = null;

export function getFeatureFlagLifecycleService(): FeatureFlagLifecycleService {
  if (!defaultService) {
    defaultService = new FeatureFlagLifecycleService();
  }
  return defaultService;
}

export function resetFeatureFlagLifecycleServiceForTests(): void {
  defaultService = null;
}
