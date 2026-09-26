// tests/unit/lib/requestCancellation.test.ts
// Regression tests for Issue #745 — cancel stale Horizon requests during account changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RequestCoordinator,
  StaleRequestError,
  isStaleRequestError,
  isAbortError,
  isCancellation,
  accountRequests,
  AccountLanes,
  supportsAbortController,
} from '../../../src/lib/requestCancellation';

/** A promise plus the handles to settle it, so tests control response ordering. */
function deferred<T>() {
  let resolve!: (_value: T) => void;
  let reject!: (_error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let coordinator: RequestCoordinator;

beforeEach(() => {
  coordinator = new RequestCoordinator();
  accountRequests.abortAll();
});

describe('RequestCoordinator — primary flow', () => {
  it('lets the only in-flight lease commit its result', () => {
    const lease = coordinator.begin('account');
    const setState = vi.fn();

    expect(lease.active).toBe(true);
    expect(lease.commit(setState)).toBe(true);
    expect(setState).toHaveBeenCalledOnce();
  });

  it('resolves run() with the value when the lease stays current', async () => {
    const lease = coordinator.begin('account');
    await expect(lease.run(async () => 'account-data')).resolves.toBe('account-data');
  });

  it('hands out increasing tokens so newer leases are identifiable', () => {
    const first = coordinator.begin('account');
    const second = coordinator.begin('account');
    expect(second.token).toBeGreaterThan(first.token);
  });

  it('keeps separate lanes independent of one another', () => {
    const offers = coordinator.begin(AccountLanes.Offers);
    const creation = coordinator.begin(AccountLanes.CreationDate);

    expect(offers.active).toBe(true);
    expect(creation.active).toBe(true);
    expect(coordinator.activeLaneCount).toBe(2);
  });
});

describe('RequestCoordinator — stale responses (the #745 race)', () => {
  it('marks the previous lease inactive as soon as a newer one starts', () => {
    const stale = coordinator.begin('account');
    const fresh = coordinator.begin('account');

    expect(stale.active).toBe(false);
    expect(fresh.active).toBe(true);
  });

  it('refuses to commit state from a superseded lease', () => {
    const staleWrite = vi.fn();
    const freshWrite = vi.fn();

    const stale = coordinator.begin('account');
    const fresh = coordinator.begin('account');

    expect(stale.commit(staleWrite)).toBe(false);
    expect(staleWrite).not.toHaveBeenCalled();
    expect(fresh.commit(freshWrite)).toBe(true);
    expect(freshWrite).toHaveBeenCalledOnce();
  });

  it('rejects a slow response that resolves after a newer request started', async () => {
    const slowAccountA = deferred<string>();

    const leaseA = coordinator.begin('account');
    const pending = leaseA.run(() => slowAccountA.promise);

    // User switches to account B while A is still in flight.
    const leaseB = coordinator.begin('account');

    // ...and only now does Horizon answer for A.
    slowAccountA.resolve('ACCOUNT-A-DATA');

    await expect(pending).rejects.toThrow(StaleRequestError);
    expect(leaseB.active).toBe(true);
  });

  it('rejects immediately when run() starts on an already-stale lease', async () => {
    const stale = coordinator.begin('account');
    coordinator.begin('account');

    const work = vi.fn().mockResolvedValue('data');
    await expect(stale.run(work)).rejects.toThrow(StaleRequestError);
    expect(work).not.toHaveBeenCalled();
  });

  it('ensureActive() throws a StaleRequestError naming the lane', () => {
    const stale = coordinator.begin('account:connect');
    coordinator.begin('account:connect');

    expect(() => stale.ensureActive()).toThrow(/account:connect/);
    try {
      stale.ensureActive();
    } catch (error) {
      expect(isStaleRequestError(error)).toBe(true);
      expect((error as StaleRequestError).lane).toBe('account:connect');
    }
  });

  it('still delivers the newest response after an older one was discarded', async () => {
    const slowA = deferred<string>();
    const fastB = deferred<string>();

    const leaseA = coordinator.begin('account');
    const pendingA = leaseA.run(() => slowA.promise).catch((error) => error);

    const leaseB = coordinator.begin('account');
    const pendingB = leaseB.run(() => fastB.promise);

    fastB.resolve('ACCOUNT-B-DATA');
    slowA.resolve('ACCOUNT-A-DATA');

    expect(isStaleRequestError(await pendingA)).toBe(true);
    await expect(pendingB).resolves.toBe('ACCOUNT-B-DATA');
  });
});

describe('RequestCoordinator — aborting', () => {
  it.runIf(supportsAbortController)('aborts the previous lease signal when superseded', () => {
    const stale = coordinator.begin('account');
    expect(stale.signal?.aborted).toBe(false);

    coordinator.begin('account');
    expect(stale.signal?.aborted).toBe(true);
  });

  it('abort(lane) cancels in-flight work on that lane only', () => {
    const offers = coordinator.begin(AccountLanes.Offers);
    const creation = coordinator.begin(AccountLanes.CreationDate);

    coordinator.abort(AccountLanes.Offers);

    expect(offers.active).toBe(false);
    expect(creation.active).toBe(true);
  });

  it('abortAll() cancels every lane — the network-switch path', () => {
    const connect = coordinator.begin(AccountLanes.Connect);
    const offers = coordinator.begin(AccountLanes.Offers);

    coordinator.abortAll();

    expect(connect.active).toBe(false);
    expect(offers.active).toBe(false);
    expect(coordinator.activeLaneCount).toBe(0);
  });

  it('lease.abort() invalidates only that lease', () => {
    const lease = coordinator.begin('account');
    lease.abort();
    expect(lease.active).toBe(false);
  });

  it('abort() on an idle lane is a no-op rather than an error', () => {
    expect(() => coordinator.abort('never-used')).not.toThrow();
    expect(coordinator.activeLaneCount).toBe(0);
  });

  it('does not resurrect a lease aborted before its work settles', async () => {
    const slow = deferred<string>();
    const lease = coordinator.begin('account');
    const pending = lease.run(() => slow.promise);

    lease.abort();
    slow.resolve('late');

    await expect(pending).rejects.toThrow(StaleRequestError);
  });
});

describe('RequestCoordinator — failure paths', () => {
  it('propagates a genuine request failure unchanged to the current lease', async () => {
    const lease = coordinator.begin('account');
    const failure = new Error('Horizon 404: account not found');

    await expect(lease.run(() => Promise.reject(failure))).rejects.toThrow(
      'Horizon 404: account not found'
    );
  });

  it('reports a real failure as a failure, not a cancellation', async () => {
    const lease = coordinator.begin('account');
    const caught = await lease.run(() => Promise.reject(new Error('boom'))).catch((e) => e);

    expect(isCancellation(caught)).toBe(false);
    expect(isStaleRequestError(caught)).toBe(false);
  });

  it('reports a stale-lane failure as a cancellation', async () => {
    const slow = deferred<string>();
    const lease = coordinator.begin('account');
    const pending = lease.run(() => slow.promise).catch((e) => e);

    coordinator.begin('account');
    slow.reject(new Error('connection reset'));

    // The lease is stale, so the underlying failure is reported as a cancellation
    // and callers stay silent instead of showing an error for an abandoned account.
    const caught = await pending;
    expect(isCancellation(caught)).toBe(true);
  });

  it('rejects an empty or non-string lane as invalid input', () => {
    expect(() => coordinator.begin('')).toThrow(TypeError);
    expect(() => coordinator.begin('   ')).toThrow(TypeError);
    expect(() => coordinator.begin(undefined as unknown as string)).toThrow(TypeError);
    expect(() => coordinator.abort('')).toThrow(TypeError);
  });
});

describe('cancellation predicates', () => {
  it('recognises a StaleRequestError, including a structurally-cloned one', () => {
    expect(isStaleRequestError(new StaleRequestError('lane', 1))).toBe(true);
    expect(isStaleRequestError({ isStaleRequest: true })).toBe(true);
    expect(isStaleRequestError(new Error('other'))).toBe(false);
    expect(isStaleRequestError(null)).toBe(false);
  });

  it('recognises DOM abort errors by name', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(isAbortError(abort)).toBe(true);
    expect(isCancellation(abort)).toBe(true);

    expect(isAbortError(new Error('network down'))).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});

describe('unsupported environments', () => {
  it('exposes whether AbortController is available', () => {
    expect(typeof supportsAbortController).toBe('boolean');
  });

  it('still invalidates stale leases when signals are unavailable', async () => {
    // Simulate an environment with no AbortController by re-importing the module
    // with the global removed — token-based invalidation must carry correctness.
    const original = globalThis.AbortController;
    // @ts-expect-error deliberately removing a global to model an old webview
    delete globalThis.AbortController;
    vi.resetModules();

    try {
      const mod = await import('../../../src/lib/requestCancellation');
      expect(mod.supportsAbortController).toBe(false);

      const local = new mod.RequestCoordinator();
      const stale = local.begin('account');
      expect(stale.signal).toBeUndefined();

      local.begin('account');
      expect(stale.active).toBe(false);
      expect(stale.commit(() => undefined)).toBe(false);
      await expect(stale.run(async () => 'x')).rejects.toThrow(mod.StaleRequestError);
    } finally {
      globalThis.AbortController = original;
      vi.resetModules();
    }
  });
});
