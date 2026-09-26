import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveOfflineDraft,
  getOfflineDraft,
  listOfflineDrafts,
  deleteOfflineDraft,
  clearOfflineDrafts,
  getDraftSyncSummary,
  syncPendingDrafts,
  retryFailedDrafts,
  validateDraftForSync,
  subscribeToDraftSync,
  initDraftAutoSync,
  persistStoredDrafts,
  loadStoredDrafts,
  MAX_OFFLINE_DRAFTS,
  type DraftSyncSummary,
} from '../offlineDrafts';
import * as offlineReadOnly from '../offlineReadOnly';

describe('offlineDrafts Queue and Sync Indicators', () => {
  beforeEach(() => {
    clearOfflineDrafts();
    vi.restoreAllMocks();
    // Default online state to true
    vi.spyOn(offlineReadOnly, 'isOnline').mockReturnValue(true);
  });

  afterEach(() => {
    clearOfflineDrafts();
  });

  describe('Primary Flow: Offline Creation -> Sync Transition -> Synced Status', () => {
    it('creates draft in offline mode and transitions to synced on network recovery', async () => {
      // 1. Simulate offline state
      vi.spyOn(offlineReadOnly, 'isOnline').mockReturnValue(false);

      const snapshot = {
        sourceAccount: 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        memo: 'Payment #101',
        memoType: 'text',
        baseFee: '100',
        timeout: '300',
        operations: [{ type: 'payment', destination: 'GA...', amount: '50' }],
        network: 'testnet',
      };

      const draft = saveOfflineDraft({
        name: 'Tx Draft #1',
        snapshot,
        network: 'testnet',
      });

      expect(draft.id).toBeDefined();
      expect(draft.name).toBe('Tx Draft #1');
      expect(draft.syncStatus).toBe('draft');
      expect(draft.offlineOrigin).toBe(true);
      expect(draft.lastSyncedAt).toBeUndefined();

      // Verify summary reflects offline draft
      const summaryBefore = getDraftSyncSummary();
      expect(summaryBefore.total).toBe(1);
      expect(summaryBefore.offlineCount).toBe(1);
      expect(summaryBefore.syncedCount).toBe(0);
      expect(summaryBefore.hasPendingSync).toBe(true);

      // 2. Attempt sync while still offline (should no-op without force)
      const offlineSyncResult = await syncPendingDrafts();
      expect(offlineSyncResult.offlineCount).toBe(1);
      expect(getOfflineDraft(draft.id)?.syncStatus).toBe('draft');

      // 3. Network comes back online
      vi.spyOn(offlineReadOnly, 'isOnline').mockReturnValue(true);

      // 4. Trigger sync
      const syncResult = await syncPendingDrafts();
      expect(syncResult.offlineCount).toBe(0);
      expect(syncResult.syncedCount).toBe(1);
      expect(syncResult.failedCount).toBe(0);
      expect(syncResult.hasPendingSync).toBe(false);

      const syncedDraft = getOfflineDraft(draft.id);
      expect(syncedDraft).not.toBeNull();
      expect(syncedDraft?.syncStatus).toBe('synced');
      expect(syncedDraft?.syncError).toBeUndefined();
      expect(typeof syncedDraft?.lastSyncedAt).toBe('number');
    });

    it('notifies subscribers reactively during draft lifecycle', async () => {
      const notifications: DraftSyncSummary[] = [];
      const unsub = subscribeToDraftSync((summary) => {
        notifications.push(summary);
      });

      // Initial subscription notification
      expect(notifications.length).toBeGreaterThanOrEqual(1);

      // Create draft offline
      saveOfflineDraft({
        name: 'Subscribed Draft',
        snapshot: { sourceAccount: 'GB...', operations: [] },
        forceOffline: true,
      });

      expect(notifications[notifications.length - 1].offlineCount).toBe(1);

      // Sync draft
      await syncPendingDrafts({ force: true });
      expect(notifications[notifications.length - 1].syncedCount).toBe(1);

      unsub();
    });

    it('updates existing draft and keeps metadata intact', () => {
      const created = saveOfflineDraft({
        name: 'Initial Name',
        snapshot: { sourceAccount: 'GB1', operations: [] },
        forceOffline: true,
      });

      const updated = saveOfflineDraft({
        id: created.id,
        name: 'Updated Name',
        snapshot: { sourceAccount: 'GB2', operations: [{ type: 'setOptions' }] },
        forceOffline: true,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Updated Name');
      expect(updated.snapshot.sourceAccount).toBe('GB2');
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(created.createdAt);
      expect(listOfflineDrafts().length).toBe(1);
    });
  });

  describe('Boundary Cases', () => {
    it('handles empty queue cleanly', () => {
      expect(listOfflineDrafts()).toEqual([]);
      expect(getDraftSyncSummary()).toEqual({
        total: 0,
        offlineCount: 0,
        syncingCount: 0,
        syncedCount: 0,
        failedCount: 0,
        conflictCount: 0,
        hasPendingSync: false,
      });
      expect(getOfflineDraft('non_existent_id')).toBeNull();
      expect(deleteOfflineDraft('non_existent_id')).toBe(false);
    });

    it('enforces maximum queue capacity (FIFO eviction)', () => {
      // Populate queue with MAX_OFFLINE_DRAFTS items
      for (let i = 0; i < MAX_OFFLINE_DRAFTS + 5; i++) {
        saveOfflineDraft({
          name: `Draft ${i}`,
          snapshot: { sourceAccount: `GB_${i}`, operations: [] },
          forceOffline: true,
        });
      }

      const drafts = listOfflineDrafts();
      expect(drafts.length).toBe(MAX_OFFLINE_DRAFTS);
      // Newest draft should be at the front
      expect(drafts[0].name).toBe(`Draft ${MAX_OFFLINE_DRAFTS + 4}`);
    });

    it('filters drafts by network and sync status', () => {
      saveOfflineDraft({
        name: 'Testnet Draft',
        snapshot: { sourceAccount: 'GB1', operations: [] },
        network: 'testnet',
        forceOffline: true,
      });

      saveOfflineDraft({
        name: 'Public Draft',
        snapshot: { sourceAccount: 'GB2', operations: [] },
        network: 'public',
        forceOffline: false,
      });

      const testnetDrafts = listOfflineDrafts({ network: 'testnet' });
      expect(testnetDrafts.length).toBe(1);
      expect(testnetDrafts[0].name).toBe('Testnet Draft');

      const publicDrafts = listOfflineDrafts({ network: 'public' });
      expect(publicDrafts.length).toBe(1);
      expect(publicDrafts[0].name).toBe('Public Draft');

      const offlineOnly = listOfflineDrafts({ syncStatus: 'draft' });
      expect(offlineOnly.length).toBe(1);
      expect(offlineOnly[0].name).toBe('Testnet Draft');

      const syncedOnly = listOfflineDrafts({ syncStatus: 'synced' });
      expect(syncedOnly.length).toBe(1);
      expect(syncedOnly[0].name).toBe('Public Draft');
    });

    it('validates memo length boundaries (<= 28 bytes passes, > 28 bytes fails)', () => {
      const validMemoDraft = {
        sourceAccount: 'GB...',
        memo: 'Exact 28 bytes 1234567890123', // 28 chars
        memoType: 'text',
      };
      expect(validateDraftForSync(validMemoDraft).valid).toBe(true);

      const invalidMemoDraft = {
        sourceAccount: 'GB...',
        memo: 'This is a long memo that exceeds 28 bytes limit',
        memoType: 'text',
      };
      const result = validateDraftForSync(invalidMemoDraft);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Text memo exceeds 28 bytes');
    });

    it('initializes auto-sync listener idempotently', () => {
      const cleanup1 = initDraftAutoSync();
      const cleanup2 = initDraftAutoSync();

      expect(typeof cleanup1).toBe('function');
      expect(cleanup1).toBe(cleanup2);

      cleanup1();
    });
  });

  describe('Failure Cases and Edge Handling', () => {
    it('marks draft as failed when validation fails during sync', async () => {
      // Save draft with invalid memo length
      const draft = saveOfflineDraft({
        name: 'Invalid Draft',
        snapshot: {
          sourceAccount: 'GB...',
          memo: 'This text memo definitely exceeds twenty-eight bytes',
          memoType: 'text',
          operations: [],
        },
        forceOffline: true,
      });

      expect(draft.syncStatus).toBe('draft');

      const summary = await syncPendingDrafts({ force: true });
      expect(summary.failedCount).toBe(1);
      expect(summary.syncedCount).toBe(0);

      const failedDraft = getOfflineDraft(draft.id);
      expect(failedDraft?.syncStatus).toBe('failed');
      expect(failedDraft?.syncError).toContain('Text memo exceeds 28 bytes');
    });

    it('handles remote sync validation rejections via mockValidator', async () => {
      const draft = saveOfflineDraft({
        name: 'Remote Reject Draft',
        snapshot: { sourceAccount: 'GB...', operations: [] },
        forceOffline: true,
      });

      const summary = await syncPendingDrafts({
        force: true,
        mockValidator: async () => ({
          valid: false,
          error: 'Sequence number mismatch in account',
        }),
      });

      expect(summary.failedCount).toBe(1);
      const failedDraft = getOfflineDraft(draft.id);
      expect(failedDraft?.syncStatus).toBe('failed');
      expect(failedDraft?.syncError).toBe('Sequence number mismatch in account');
    });

    it('retries only failed drafts with retryFailedDrafts', async () => {
      const draft1 = saveOfflineDraft({
        name: 'Failed Draft 1',
        snapshot: { sourceAccount: 'GB...', memo: 'Too long text memo for stellar xdr', memoType: 'text', operations: [] },
        forceOffline: true,
      });

      const draft2 = saveOfflineDraft({
        name: 'Valid Draft 2',
        snapshot: { sourceAccount: 'GB...', memo: 'Valid', memoType: 'text', operations: [] },
        forceOffline: true,
      });

      // Run initial sync
      await syncPendingDrafts({ force: true });

      expect(getOfflineDraft(draft1.id)?.syncStatus).toBe('failed');
      expect(getOfflineDraft(draft2.id)?.syncStatus).toBe('synced');

      // Update draft1 with valid memo
      saveOfflineDraft({
        id: draft1.id,
        snapshot: { sourceAccount: 'GB...', memo: 'Fixed', memoType: 'text', operations: [] },
        forceOffline: true,
      });
      // Mark as failed to test retryFailedDrafts
      const drafts = loadStoredDrafts();
      const target = drafts.find((d) => d.id === draft1.id);
      if (target) {
        target.syncStatus = 'failed';
        persistStoredDrafts(drafts);
      }

      const retrySummary = await retryFailedDrafts();
      expect(retrySummary.failedCount).toBe(0);
      expect(retrySummary.syncedCount).toBe(2);
      expect(getOfflineDraft(draft1.id)?.syncStatus).toBe('synced');
    });

    it('throws meaningful error on invalid input to saveOfflineDraft', () => {
      expect(() => saveOfflineDraft(null as any)).toThrow('Invalid draft options');
      expect(() => saveOfflineDraft({} as any)).toThrow('snapshot object is required');
      expect(() => saveOfflineDraft({ snapshot: null } as any)).toThrow('snapshot object is required');
    });

    it('handles localStorage unavailability and quota errors gracefully', () => {
      const originalSetItem = window.localStorage.setItem;
      try {
        // Mock setItem throwing QuotaExceededError
        window.localStorage.setItem = vi.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError');
        });

        const draft = saveOfflineDraft({
          name: 'Fallback Draft',
          snapshot: { sourceAccount: 'GB...', operations: [] },
          forceOffline: true,
        });

        expect(draft).toBeDefined();
        expect(draft.name).toBe('Fallback Draft');
        expect(getOfflineDraft(draft.id)?.id).toBe(draft.id);
      } finally {
        window.localStorage.setItem = originalSetItem;
      }
    });

    it('validates malformed input in validateDraftForSync safely without throwing', () => {
      expect(validateDraftForSync(null as any).valid).toBe(false);
      expect(validateDraftForSync(undefined as any).valid).toBe(false);
      expect(validateDraftForSync({} as any).valid).toBe(true); // empty object has valid: true with warnings
      expect(validateDraftForSync({ operations: 'not-array' } as any).valid).toBe(false);
    });
  });
});
