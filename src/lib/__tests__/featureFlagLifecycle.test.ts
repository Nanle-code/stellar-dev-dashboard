/**
 * Unit tests for featureFlagLifecycle.ts (#819)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeatureFlagLifecycleService,
  FeatureFlagError,
  createEmptyStore,
  subjectRolloutBucket,
  resetFeatureFlagLifecycleServiceForTests,
  type FeatureFlagDefinition,
} from '../featureFlagLifecycle';

function makeInput(overrides: Partial<FeatureFlagDefinition> = {}): FeatureFlagDefinition {
  return {
    key: 'new-dashboard-widget',
    name: 'New Dashboard Widget',
    description: 'Shows experimental widget',
    environments: ['development', 'staging', 'test'],
    rolloutPercent: 100,
    ...overrides,
  };
}

describe('feature flag lifecycle', () => {
  let service: FeatureFlagLifecycleService;
  let nowMs: number;

  beforeEach(() => {
    resetFeatureFlagLifecycleServiceForTests();
    nowMs = Date.parse('2026-09-24T12:00:00.000Z');
    service = new FeatureFlagLifecycleService({
      store: createEmptyStore(),
      now: () => new Date(nowMs),
    });
  });

  it('creates a draft flag and records audit history (primary flow)', () => {
    const flag = service.create(makeInput(), 'admin-1');
    expect(flag.status).toBe('draft');
    expect(flag.key).toBe('new-dashboard-widget');
    expect(flag.createdBy).toBe('admin-1');

    service.activate(flag.key, 'admin-1');
    const evalResult = service.evaluate(flag.key, {
      environment: 'staging',
      subjectId: 'user-a',
      actor: 'admin-1',
    });
    expect(evalResult.enabled).toBe(true);
    expect(evalResult.reason).toBe('active');

    const history = service.getAuditHistory(flag.key);
    const actions = history.map((h) => h.action);
    expect(actions).toContain('created');
    expect(actions).toContain('activated');
    expect(actions).toContain('evaluated');
  });

  it('rejects invalid key / empty environments / bad rollout (boundary)', () => {
    expect(() => service.create(makeInput({ key: '1bad' }))).toThrow(FeatureFlagError);
    expect(() => service.create(makeInput({ key: 'ok', environments: [] }))).toThrow(
      /environment/i,
    );
    expect(() => service.create(makeInput({ rolloutPercent: 150 }))).toThrow(/rollout/i);
    expect(() =>
      service.create(makeInput({ environments: ['qa' as never] })),
    ).toThrow(/Unsupported environment/);
  });

  it('handles expire and retire flows and blocks evaluate afterward', () => {
    const flag = service.create(makeInput({ key: 'expiring-flag' }), 'ops');
    service.activate(flag.key, 'ops');
    service.expire(flag.key, 'ops');
    expect(service.evaluate(flag.key, { environment: 'test', subjectId: 's1' }).reason).toBe(
      'expired',
    );

    service.retire(flag.key, 'ops');
    const retired = service.evaluate(flag.key, { environment: 'test', subjectId: 's1' });
    expect(retired.enabled).toBe(false);
    expect(retired.reason).toBe('retired');
    expect(() => service.activate(flag.key)).toThrow(/retired/i);
  });

  it('auto-expires during evaluate when expiresAt is past (boundary)', () => {
    const flag = service.create(
      makeInput({
        key: 'timed-flag',
        expiresAt: '2026-09-24T18:00:00.000Z',
      }),
    );
    service.activate(flag.key);
    nowMs = Date.parse('2026-09-24T19:00:00.000Z');
    const result = service.evaluate(flag.key, { environment: 'development', subjectId: 'u1' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('expired');
    expect(service.get(flag.key)?.status).toBe('expired');
  });

  it('returns unsupported_environment and allowlist misses without throwing', () => {
    const flag = service.create(
      makeInput({
        key: 'prod-only',
        environments: ['production'],
        allowlist: ['allowed-user'],
      }),
    );
    service.activate(flag.key);

    expect(
      service.evaluate(flag.key, { environment: 'development', subjectId: 'allowed-user' })
        .reason,
    ).toBe('unsupported_environment');

    expect(
      service.evaluate(flag.key, { environment: 'production', subjectId: 'other' }).reason,
    ).toBe('not_in_allowlist');

    expect(
      service.evaluate(flag.key, { environment: 'production', subjectId: 'allowed-user' })
        .enabled,
    ).toBe(true);
  });

  it('fails gracefully for missing flags and duplicate keys (failure cases)', () => {
    const missing = service.evaluate('does-not-exist', {
      environment: 'test',
      subjectId: 'x',
    });
    expect(missing.enabled).toBe(false);
    expect(missing.reason).toBe('flag_not_found');

    service.create(makeInput({ key: 'dup-flag' }));
    expect(() => service.create(makeInput({ key: 'dup-flag' }))).toThrow(/already exists/);

    expect(() =>
      service.evaluate('dup-flag', { environment: 'bogus' as never }),
    ).toThrow(FeatureFlagError);
  });

  it('applies deterministic rollout buckets', () => {
    const flag = service.create(
      makeInput({ key: 'partial-rollout', rolloutPercent: 0 }),
    );
    service.activate(flag.key);
    expect(
      service.evaluate(flag.key, { environment: 'test', subjectId: 'anyone' }).reason,
    ).toBe('rollout_excluded');

    const bucket = subjectRolloutBucket('subject-42', 'partial-rollout');
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(100);
    expect(subjectRolloutBucket('subject-42', 'partial-rollout')).toBe(bucket);
  });

  it('lists flags and returns audit history with limit', () => {
    service.create(makeInput({ key: 'a-flag', name: 'A' }));
    service.create(makeInput({ key: 'b-flag', name: 'B' }));
    expect(service.list()).toHaveLength(2);
    expect(service.list('draft')).toHaveLength(2);
    expect(service.getAuditHistory(undefined, 1)).toHaveLength(1);
  });
});
