import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { notifyQuotaExceeded, _resetQuotaListeners } from '../../../src/lib/storageQuota';
import { useStore } from '../../../src/lib/store';
import { useStorageQuotaAlerts } from '../../../src/hooks/useStorageQuotaAlerts';

// store.ts now imports cacheInit and requestCancellation — mock both so the
// cache stack does not load in jsdom.
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
vi.mock('../../../src/lib/requestCancellation', () => ({
  accountRequests: { abortAll: vi.fn(), begin: vi.fn(() => ({ active: true, commit: vi.fn(() => true), abort: vi.fn() })) },
  AccountLanes: { Connect: 'account:connect', Offers: 'account:offers', CreationDate: 'account:creation-date' },
  isCancellation: vi.fn(() => false),
  isStaleRequestError: vi.fn(() => false),
  StaleRequestError: class StaleRequestError extends Error {},
}));

describe('useStorageQuotaAlerts', () => {
  beforeEach(() => {
    useStore.setState({ notifications: [], notificationHistory: [] });
  });

  afterEach(() => {
    _resetQuotaListeners();
    vi.restoreAllMocks();
  });

  it('shows a recovery notification when eviction freed enough space (primary flow)', () => {
    renderHook(() => useStorageQuotaAlerts());

    act(() => {
      notifyQuotaExceeded({ store: 'api-cache', key: 'account:GABC', recovered: true, evictedCount: 5 });
    });

    const { notifications } = useStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: 'warning', title: 'Storage space freed up' });
    expect(notifications[0].message).toContain('5');
  });

  it('shows a persistent recovery-options notification when eviction could not free enough space (failure case)', () => {
    renderHook(() => useStorageQuotaAlerts());

    act(() => {
      notifyQuotaExceeded({ store: 'app-state', key: 'theme', recovered: false, evictedCount: 0 });
    });

    const { notifications } = useStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: 'warning', title: 'Storage is full', timeout: 0 });
  });

  it('throttles repeated events so the user is not spammed (boundary case)', () => {
    renderHook(() => useStorageQuotaAlerts());

    act(() => {
      notifyQuotaExceeded({ store: 'api-cache', recovered: true, evictedCount: 1 });
      notifyQuotaExceeded({ store: 'api-cache', recovered: true, evictedCount: 2 });
      notifyQuotaExceeded({ store: 'api-cache', recovered: true, evictedCount: 3 });
    });

    expect(useStore.getState().notifications).toHaveLength(1);
  });

  it('unsubscribes on unmount so later events produce no notification', () => {
    const { unmount } = renderHook(() => useStorageQuotaAlerts());
    unmount();

    act(() => {
      notifyQuotaExceeded({ store: 'api-cache', recovered: true, evictedCount: 1 });
    });

    expect(useStore.getState().notifications).toHaveLength(0);
  });
});
