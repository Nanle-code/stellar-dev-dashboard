import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { notifyQuotaExceeded, _resetQuotaListeners } from '../../../src/lib/storageQuota';
import { useStore } from '../../../src/lib/store';
import { useStorageQuotaAlerts } from '../../../src/hooks/useStorageQuotaAlerts';

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
