// tests/unit/lib/stellar.cancellation.test.ts
// Issue #745 — the account-scoped Horizon readers must honour an AbortSignal so a
// slower response for a previous account/network cannot overwrite current state.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const loadAccount = vi.fn();
const call = vi.fn();

vi.mock('@stellar/stellar-sdk', async () => {
  const actual =
    await vi.importActual<typeof import('@stellar/stellar-sdk')>('@stellar/stellar-sdk');
  class MockServer {
    loadAccount = loadAccount;
    transactions = () => this;
    operations = () => this;
    offers = () => this;
    ledgers = () => this;
    forAccount = () => this;
    order = () => this;
    limit = () => this;
    cursor = () => this;
    call = call;
  }
  return {
    ...actual,
    Horizon: { ...actual.Horizon, Server: MockServer },
    SorobanRpc: { ...actual.SorobanRpc, Server: MockServer },
  };
});

import * as stellar from '../../../src/lib/stellar';

/** A promise the test settles by hand, to control response ordering. */
function deferred<T>() {
  let resolve!: (_value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Unique key per test so the module-level cache never serves a stale hit. */
let counter = 0;
const uniqueKey = () => `GTEST${(counter += 1)}`;

beforeEach(() => {
  loadAccount.mockReset();
  call.mockReset();
  stellar.stellarCache.clear?.();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchAccount — signal support', () => {
  it('resolves normally when no signal is supplied (backwards compatible)', async () => {
    const account = { account_id: 'GABC', balances: [] };
    loadAccount.mockResolvedValueOnce(account);

    await expect(stellar.fetchAccount(uniqueKey(), 'testnet')).resolves.toBe(account);
  });

  it('resolves normally when given a signal that never aborts', async () => {
    const account = { account_id: 'GABC', balances: [] };
    loadAccount.mockResolvedValueOnce(account);
    const controller = new AbortController();

    await expect(
      stellar.fetchAccount(uniqueKey(), 'testnet', { signal: controller.signal })
    ).resolves.toBe(account);
  });

  it('rejects immediately when the signal is already aborted, without calling Horizon', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      stellar.fetchAccount(uniqueKey(), 'testnet', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(loadAccount).not.toHaveBeenCalled();
  });

  it('rejects with AbortError when aborted mid-flight, discarding the late response', async () => {
    const slow = deferred<unknown>();
    loadAccount.mockReturnValueOnce(slow.promise);

    const controller = new AbortController();
    const pending = stellar.fetchAccount(uniqueKey(), 'testnet', { signal: controller.signal });

    // User switches account: abort, then the old response finally lands.
    controller.abort();
    slow.resolve({ account_id: 'STALE-ACCOUNT', balances: [] });

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('propagates a genuine Horizon failure rather than masking it as an abort', async () => {
    loadAccount.mockRejectedValueOnce(new Error('Horizon 404'));
    const controller = new AbortController();

    await expect(
      stellar.fetchAccount(uniqueKey(), 'testnet', { signal: controller.signal })
    ).rejects.toThrow('Horizon 404');
  });
});

describe('fetchTransactions / fetchOperations — signal support', () => {
  it('fetchTransactions rejects when aborted mid-flight', async () => {
    const slow = deferred<unknown>();
    call.mockReturnValueOnce(slow.promise);

    const controller = new AbortController();
    const pending = stellar.fetchTransactions(uniqueKey(), 'testnet', 10, null, {
      signal: controller.signal,
    });

    controller.abort();
    slow.resolve({ records: [{ paging_token: 'stale' }] });

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('fetchTransactions still returns records when not aborted', async () => {
    call.mockResolvedValueOnce({ records: [{ id: 'tx1', paging_token: 'p1' }] });

    const result = await stellar.fetchTransactions(uniqueKey(), 'testnet', 10, null, {});
    expect(result.records).toHaveLength(1);
    expect(result.nextCursor).toBe('p1');
  });

  it('fetchOperations rejects when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      stellar.fetchOperations(uniqueKey(), 'testnet', 10, null, { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(call).not.toHaveBeenCalled();
  });
});

describe('fetchAccountOffers — signal support', () => {
  it('rejects when aborted mid-flight instead of returning the stale offers', async () => {
    const slow = deferred<unknown>();
    call.mockReturnValueOnce(slow.promise);

    const controller = new AbortController();
    const pending = stellar.fetchAccountOffers(uniqueKey(), 'testnet', {
      signal: controller.signal,
    });

    controller.abort();
    slow.resolve({ records: [{ id: 'stale-offer' }] });

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('fetchAccountCreationDate — abort is not "no date found"', () => {
  it('returns null when Horizon fails, as before', async () => {
    call.mockRejectedValueOnce(new Error('boom'));
    await expect(stellar.fetchAccountCreationDate(uniqueKey(), 'testnet')).resolves.toBeNull();
  });

  it('rethrows an abort rather than resolving null and clearing current state', async () => {
    const slow = deferred<unknown>();
    call.mockReturnValueOnce(slow.promise);

    const controller = new AbortController();
    const pending = stellar.fetchAccountCreationDate(uniqueKey(), 'testnet', {
      signal: controller.signal,
    });

    controller.abort();
    slow.resolve({ records: [{ type: 'create_account', created_at: '2024-01-01' }] });

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects up front when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      stellar.fetchAccountCreationDate(uniqueKey(), 'testnet', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
