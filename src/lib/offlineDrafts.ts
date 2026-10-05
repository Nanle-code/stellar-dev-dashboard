/**
 * Offline Transaction Draft Queue & Sync Manager
 *
 * Implements offline transaction draft lifecycle:
 *  - Queue drafts created while offline
 *  - Clear sync indicators: 'draft' | 'syncing' | 'synced' | 'failed' | 'conflict'
 *  - Auto-sync on network reconnection via connectivity listener
 *  - Input validation, boundary quota handling (FIFO pruning), and error recovery
 *  - Pub/sub subscriber model for real-time UI indicator updates
 *  - In-memory fallback for SSR and non-browser environments
 */

import { isOnline, subscribeToConnectivity } from './offlineReadOnly';

export type DraftSyncStatus = 'draft' | 'syncing' | 'synced' | 'failed' | 'conflict';

export interface TxSnapshot {
  sourceAccount: string;
  memo?: string;
  memoType?: string;
  baseFee?: string | number;
  timeout?: string | number;
  operations?: any[];
  network?: string;
  [key: string]: any;
}

export interface OfflineDraft {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  network: string;
  syncStatus: DraftSyncStatus;
  syncError?: string;
  lastSyncedAt?: number;
  snapshot: TxSnapshot;
  offlineOrigin: boolean;
  tags?: string[];
  version?: number;
}

export interface DraftSyncSummary {
  total: number;
  offlineCount: number;
  syncingCount: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  hasPendingSync: boolean;
}

export interface DraftValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface SaveDraftOptions {
  id?: string;
  name?: string;
  snapshot: Partial<TxSnapshot>;
  network?: string;
  tags?: string[];
  forceOffline?: boolean;
}

export interface SyncOptions {
  draftIds?: string[];
  force?: boolean;
  mockValidator?: (_draft: OfflineDraft) => Promise<{ valid: boolean; error?: string }>;
}

export const DRAFT_STORAGE_KEY = 'stellar_offline_tx_drafts_v1';
export const MAX_OFFLINE_DRAFTS = 50;

// In-memory fallback store for environments without localStorage or on quota errors
let _memoryDrafts: OfflineDraft[] | null = null;
let _usingMemoryFallback = false;
const _listeners = new Set<(_summary: DraftSyncSummary, _drafts: OfflineDraft[]) => void>();
let _autoSyncInitialized = false;
let _cleanupAutoSync: (() => void) | null = null;

function clone<T>(val: T): T {
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return val;
  }
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && window.localStorage !== null;
  } catch {
    return false;
  }
}

export function loadStoredDrafts(): OfflineDraft[] {
  if (_usingMemoryFallback || !hasLocalStorage()) {
    return _memoryDrafts ? [..._memoryDrafts] : [];
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return _memoryDrafts ? [..._memoryDrafts] : [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return _memoryDrafts ? [..._memoryDrafts] : [];
    }
    // Update memory cache
    _memoryDrafts = parsed;
    return parsed;
  } catch {
    _usingMemoryFallback = true;
    return _memoryDrafts ? [..._memoryDrafts] : [];
  }
}

export function persistStoredDrafts(drafts: OfflineDraft[]): boolean {
  // Always update memory store
  _memoryDrafts = clone(drafts);

  if (_usingMemoryFallback || !hasLocalStorage()) {
    return true;
  }

  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    // LocalStorage quota or access error - fallback to memory store
    _usingMemoryFallback = true;
    return false;
  }
}

function notifySubscribers(drafts?: OfflineDraft[]): void {
  const currentDrafts = drafts ?? loadStoredDrafts();
  const summary = calculateSyncSummary(currentDrafts);
  _listeners.forEach((listener) => {
    try {
      listener(summary, clone(currentDrafts));
    } catch {
      /* ignore subscriber errors */
    }
  });
}

export function calculateSyncSummary(drafts: OfflineDraft[]): DraftSyncSummary {
  let offlineCount = 0;
  let syncingCount = 0;
  let syncedCount = 0;
  let failedCount = 0;
  let conflictCount = 0;

  for (const d of drafts) {
    switch (d.syncStatus) {
      case 'draft':
        offlineCount++;
        break;
      case 'syncing':
        syncingCount++;
        break;
      case 'synced':
        syncedCount++;
        break;
      case 'failed':
        failedCount++;
        break;
      case 'conflict':
        conflictCount++;
        break;
    }
  }

  return {
    total: drafts.length,
    offlineCount,
    syncingCount,
    syncedCount,
    failedCount,
    conflictCount,
    hasPendingSync: offlineCount > 0 || failedCount > 0,
  };
}

/**
 * Validate a draft snapshot structure before saving or syncing
 */
export function validateDraftForSync(input: OfflineDraft | TxSnapshot | Partial<TxSnapshot>): DraftValidationResult {
  const warnings: string[] = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Draft payload must be an object' };
  }

  const snapshot: Partial<TxSnapshot> = 'snapshot' in input && (input as OfflineDraft).snapshot
    ? (input as OfflineDraft).snapshot
    : (input as Partial<TxSnapshot>);

  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, error: 'Draft must include a valid transaction snapshot' };
  }

  // Validate source account format if present
  if (snapshot.sourceAccount) {
    const trimmed = String(snapshot.sourceAccount).trim();
    if (trimmed.length > 0 && (!trimmed.startsWith('G') || trimmed.length !== 56)) {
      warnings.push('Source account is not a standard 56-character Stellar public key (G...)');
    }
  } else {
    warnings.push('No source account specified in draft snapshot');
  }

  // Validate operations if provided
  if (snapshot.operations !== undefined) {
    if (!Array.isArray(snapshot.operations)) {
      return { valid: false, error: 'Operations must be an array' };
    }
  }

  // Validate memo constraints
  if (snapshot.memo && snapshot.memoType === 'text') {
    const byteLength = new TextEncoder().encode(String(snapshot.memo)).length;
    if (byteLength > 28) {
      return { valid: false, error: `Text memo exceeds 28 bytes (${byteLength} bytes)` };
    }
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Save or update an offline draft
 */
export function saveOfflineDraft(opts: SaveDraftOptions): OfflineDraft {
  if (!opts || typeof opts !== 'object') {
    throw new Error('Invalid draft options: expected an object');
  }

  if (!opts.snapshot || typeof opts.snapshot !== 'object') {
    throw new Error('Invalid draft options: snapshot object is required');
  }

  const now = Date.now();
  const online = isOnline();
  const isOfflineMode = !online || opts.forceOffline === true;

  const currentDrafts = loadStoredDrafts();
  const existingIndex = opts.id ? currentDrafts.findIndex((d) => d.id === opts.id) : -1;

  let draft: OfflineDraft;

  if (existingIndex >= 0) {
    const existing = currentDrafts[existingIndex];
    draft = {
      ...existing,
      name: opts.name?.trim() || existing.name,
      network: opts.network || opts.snapshot.network || existing.network,
      updatedAt: now,
      snapshot: clone(opts.snapshot as TxSnapshot),
      tags: opts.tags || existing.tags || [],
      offlineOrigin: existing.offlineOrigin || isOfflineMode,
      syncStatus: isOfflineMode ? 'draft' : 'synced',
      lastSyncedAt: isOfflineMode ? existing.lastSyncedAt : now,
      syncError: isOfflineMode ? existing.syncError : undefined,
    };
    currentDrafts[existingIndex] = draft;
  } else {
    const id = opts.id || `draft_${now}_${Math.random().toString(36).slice(2, 9)}`;
    const name = opts.name?.trim() || `Draft ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const network = opts.network || opts.snapshot.network || 'testnet';

    draft = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      network,
      syncStatus: isOfflineMode ? 'draft' : 'synced',
      syncError: undefined,
      lastSyncedAt: isOfflineMode ? undefined : now,
      snapshot: clone(opts.snapshot as TxSnapshot),
      offlineOrigin: isOfflineMode,
      tags: opts.tags || [],
      version: 1,
    };

    // Prepend new draft; cap maximum capacity to MAX_OFFLINE_DRAFTS
    currentDrafts.unshift(draft);
    if (currentDrafts.length > MAX_OFFLINE_DRAFTS) {
      // Prune oldest synced drafts first, then oldest overall
      const syncedIdx = currentDrafts.map((d, i) => ({ d, i })).reverse().find((x) => x.d.syncStatus === 'synced');
      if (syncedIdx) {
        currentDrafts.splice(syncedIdx.i, 1);
      } else {
        currentDrafts.pop();
      }
    }
  }

  persistStoredDrafts(currentDrafts);
  notifySubscribers(currentDrafts);
  return draft;
}

/**
 * Retrieve a draft by its ID
 */
export function getOfflineDraft(id: string): OfflineDraft | null {
  if (!id) return null;
  const drafts = loadStoredDrafts();
  return drafts.find((d) => d.id === id) || null;
}

/**
 * List drafts with optional filtering
 */
export function listOfflineDrafts(filters?: {
  network?: string;
  syncStatus?: DraftSyncStatus | DraftSyncStatus[];
  offlineOriginOnly?: boolean;
}): OfflineDraft[] {
  let drafts = loadStoredDrafts();

  if (!filters) return drafts;

  if (filters.network) {
    drafts = drafts.filter((d) => d.network.toLowerCase() === filters.network!.toLowerCase());
  }

  if (filters.syncStatus) {
    const statuses = Array.isArray(filters.syncStatus) ? filters.syncStatus : [filters.syncStatus];
    drafts = drafts.filter((d) => statuses.includes(d.syncStatus));
  }

  if (filters.offlineOriginOnly) {
    drafts = drafts.filter((d) => d.offlineOrigin);
  }

  return drafts;
}

/**
 * Delete a draft by ID
 */
export function deleteOfflineDraft(id: string): boolean {
  if (!id) return false;
  const currentDrafts = loadStoredDrafts();
  const initialLength = currentDrafts.length;
  const filtered = currentDrafts.filter((d) => d.id !== id);

  if (filtered.length === initialLength) {
    return false;
  }

  persistStoredDrafts(filtered);
  notifySubscribers(filtered);
  return true;
}

export function clearOfflineDrafts(): void {
  _memoryDrafts = [];
  _usingMemoryFallback = false;
  if (hasLocalStorage()) {
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  notifySubscribers([]);
}

/**
 * Get current sync summary statistics
 */
export function getDraftSyncSummary(): DraftSyncSummary {
  const drafts = loadStoredDrafts();
  return calculateSyncSummary(drafts);
}

/**
 * Sync pending offline drafts
 * Transitions drafts through 'syncing' -> 'synced' (or 'failed')
 */
export async function syncPendingDrafts(options: SyncOptions = {}): Promise<DraftSyncSummary> {
  const online = isOnline();
  if (!online && !options.force) {
    return getDraftSyncSummary();
  }

  const drafts = loadStoredDrafts();
  const targetIds = options.draftIds;

  // Filter candidates for sync: 'draft' or 'failed'
  const candidates = drafts.filter((d) => {
    if (targetIds && !targetIds.includes(d.id)) return false;
    return d.syncStatus === 'draft' || d.syncStatus === 'failed';
  });

  if (candidates.length === 0) {
    return calculateSyncSummary(drafts);
  }

  // 1. Mark target drafts as 'syncing'
  candidates.forEach((d) => {
    d.syncStatus = 'syncing';
    d.updatedAt = Date.now();
  });
  persistStoredDrafts(drafts);
  notifySubscribers(drafts);

  // 2. Validate and sync each candidate
  for (const draft of candidates) {
    try {
      const validation = validateDraftForSync(draft);
      if (!validation.valid) {
        draft.syncStatus = 'failed';
        draft.syncError = validation.error || 'Validation failed';
        draft.updatedAt = Date.now();
        continue;
      }

      if (options.mockValidator) {
        const mockResult = await options.mockValidator(draft);
        if (!mockResult.valid) {
          draft.syncStatus = 'failed';
          draft.syncError = mockResult.error || 'Remote sync rejected';
          draft.updatedAt = Date.now();
          continue;
        }
      }

      // Successful sync
      draft.syncStatus = 'synced';
      draft.syncError = undefined;
      draft.lastSyncedAt = Date.now();
      draft.updatedAt = Date.now();
    } catch (err: any) {
      draft.syncStatus = 'failed';
      draft.syncError = err?.message || 'Sync failed due to an unexpected error';
      draft.updatedAt = Date.now();
    }
  }

  // 3. Persist final results and notify
  persistStoredDrafts(drafts);
  notifySubscribers(drafts);
  return calculateSyncSummary(drafts);
}

/**
 * Retry all failed drafts
 */
export async function retryFailedDrafts(network?: string): Promise<DraftSyncSummary> {
  const failed = listOfflineDrafts({
    syncStatus: 'failed',
    network,
  });
  if (failed.length === 0) {
    return getDraftSyncSummary();
  }
  return syncPendingDrafts({ draftIds: failed.map((d) => d.id) });
}

/**
 * Subscribe to draft changes and sync status updates
 */
export function subscribeToDraftSync(
  listener: (_summary: DraftSyncSummary, _drafts: OfflineDraft[]) => void
): () => void {
  _listeners.add(listener);
  // Trigger immediately with current state
  try {
    const drafts = loadStoredDrafts();
    listener(calculateSyncSummary(drafts), clone(drafts));
  } catch {
    /* swallow error */
  }

  return () => {
    _listeners.delete(listener);
  };
}

/**
 * Automatically triggers sync when connectivity returns
 */
export function initDraftAutoSync(): () => void {
  if (_autoSyncInitialized && _cleanupAutoSync) {
    return _cleanupAutoSync;
  }

  _autoSyncInitialized = true;

  const unsub = subscribeToConnectivity((online) => {
    if (online) {
      syncPendingDrafts().catch(() => {});
    }
  });

  _cleanupAutoSync = () => {
    unsub();
    _autoSyncInitialized = false;
    _cleanupAutoSync = null;
  };

  return _cleanupAutoSync;
}
