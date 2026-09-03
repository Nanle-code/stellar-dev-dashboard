// tests/unit/lib/store.networkCancellation.test.ts
// Issue #745 — switching network must cancel in-flight Horizon reads and leave no
// loading flag stuck on, since the cancelled requests' own handlers will not fire.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/lib/storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn(),
}));
vi.mock('../../../src/utils/stateSync', () => ({
  broadcastStateChange: vi.fn(),
  onStateChange: vi.fn(),
  syncState: vi.fn().mockResolvedValue(0),
  loadSyncedState: vi.fn().mockReturnValue(null),
  resolveStateConflict: vi.fn((local: unknown) => local),
  getTabId: vi.fn().mockReturnValue('test-tab'),
}));
vi.mock('../../../src/lib/cacheInit', () => ({
  handleNetworkSwitch: vi.fn(),
  initCache: vi.fn().mockResolvedValue(undefined),
  handleTransactionSuccess: vi.fn().mockResolvedValue(undefined),
  _resetCacheInit: vi.fn(),
}));

import { useStore } from '../../../src/lib/store';
import { accountRequests, AccountLanes } from '../../../src/lib/requestCancellation';

const BASELINE = useStore.getState();

function resetStore() {
  useStore.setState(BASELINE, true);
  accountRequests.abortAll();
}

describe('setNetwork — cancels in-flight account reads', () => {
  beforeEach(resetStore);

  it('invalidates a connect lease that was in flight', () => {
    const lease = accountRequests.begin(AccountLanes.Connect);
    expect(lease.active).toBe(true);

    useStore.getState().setNetwork('mainnet');

    expect(lease.active).toBe(false);
  });

  it('invalidates every account lane, not just the connect lane', () => {
    const connect = accountRequests.begin(AccountLanes.Connect);
    const offers = accountRequests.begin(AccountLanes.Offers);
    const creation = accountRequests.begin(AccountLanes.CreationDate);

    useStore.getState().setNetwork('futurenet');

    expect(connect.active).toBe(false);
    expect(offers.active).toBe(false);
    expect(creation.active).toBe(false);
    expect(accountRequests.activeLaneCount).toBe(0);
  });

  it('refuses a state write from a read that was in flight across the switch', () => {
    const lease = accountRequests.begin(AccountLanes.Connect);
    useStore.getState().setNetwork('mainnet');

    // The stale response finally arrives and tries to publish itself.
    const wrote = lease.commit(() => useStore.getState().setAccountData({} as never));

    expect(wrote).toBe(false);
    expect(useStore.getState().accountData).toBeNull();
  });

  it('clears loading flags so no spinner is left stuck after cancelling', () => {
    useStore.setState({ accountLoading: true, txLoading: true, opsLoading: true });
    accountRequests.begin(AccountLanes.Connect);

    useStore.getState().setNetwork('mainnet');

    const state = useStore.getState();
    expect(state.accountLoading).toBe(false);
    expect(state.txLoading).toBe(false);
    expect(state.opsLoading).toBe(false);
  });

  it('still performs the network switch itself', () => {
    accountRequests.begin(AccountLanes.Connect);
    useStore.getState().setNetwork('mainnet');
    expect(useStore.getState().network).toBe('mainnet');
  });

  it('lets a read started after the switch commit normally', () => {
    accountRequests.begin(AccountLanes.Connect);
    useStore.getState().setNetwork('mainnet');

    const fresh = accountRequests.begin(AccountLanes.Connect);
    expect(fresh.active).toBe(true);
    expect(fresh.commit(() => undefined)).toBe(true);
  });
});
