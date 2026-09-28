import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isQuotaExceededError,
  selectEvictionCandidates,
  isStorageEstimateSupported,
  getStorageEstimate,
  onQuotaExceeded,
  notifyQuotaExceeded,
  _resetQuotaListeners,
} from '../../../src/lib/storageQuota.js';

describe('isQuotaExceededError', () => {
  it('detects the modern DOMException name (primary flow)', () => {
    const err = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    expect(isQuotaExceededError(err)).toBe(true);
  });

  it('detects the legacy Firefox error name', () => {
    expect(isQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
  });

  it('detects the legacy numeric error codes', () => {
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError({ code: 1014 })).toBe(true);
  });

  it('falls back to sniffing the message when name/code are absent', () => {
    expect(isQuotaExceededError({ message: 'Storage quota exceeded for this origin' })).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isQuotaExceededError(new TypeError('boom'))).toBe(false);
    expect(isQuotaExceededError({ name: 'NotFoundError' })).toBe(false);
  });

  it('handles invalid input without throwing (boundary case)', () => {
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
    expect(isQuotaExceededError('QuotaExceededError')).toBe(false);
    expect(isQuotaExceededError(42)).toBe(false);
  });
});

describe('selectEvictionCandidates', () => {
  const now = 1_000_000;

  it('prefers expired entries over the oldest alive ones (primary flow)', () => {
    const records = [
      { key: 'alive-old', expiresAt: now + 10_000, cachedAt: now - 5_000 },
      { key: 'expired-1', expiresAt: now - 1_000, cachedAt: now - 20_000 },
      { key: 'alive-new', expiresAt: now + 20_000, cachedAt: now - 1_000 },
      { key: 'expired-2', expiresAt: now - 500, cachedAt: now - 10_000 },
    ];

    const evicted = selectEvictionCandidates(records, 3, now);

    expect(evicted.map((r) => r.key)).toEqual(['expired-1', 'expired-2', 'alive-old']);
  });

  it('returns an empty array when there is nothing to evict (boundary case)', () => {
    expect(selectEvictionCandidates([], 10, now)).toEqual([]);
    expect(selectEvictionCandidates([{ key: 'a', expiresAt: now + 1, cachedAt: now }], 0, now)).toEqual([]);
  });

  it('handles invalid input without throwing (failure case)', () => {
    expect(selectEvictionCandidates(null, 5, now)).toEqual([]);
    expect(selectEvictionCandidates(undefined, 5, now)).toEqual([]);
  });
});

describe('storage estimate', () => {
  const originalStorage = globalThis.navigator?.storage;

  afterEach(() => {
    if (globalThis.navigator) {
      Object.defineProperty(globalThis.navigator, 'storage', {
        value: originalStorage,
        configurable: true,
      });
    }
  });

  it('reports supported and returns usage/quota when available (primary flow)', async () => {
    Object.defineProperty(globalThis.navigator, 'storage', {
      value: { estimate: vi.fn().mockResolvedValue({ usage: 50, quota: 200 }) },
      configurable: true,
    });

    expect(isStorageEstimateSupported()).toBe(true);
    await expect(getStorageEstimate()).resolves.toEqual({ usage: 50, quota: 200, usageRatio: 0.25 });
  });

  it('reports unsupported and returns null in environments without navigator.storage (failure case)', async () => {
    Object.defineProperty(globalThis.navigator, 'storage', { value: undefined, configurable: true });

    expect(isStorageEstimateSupported()).toBe(false);
    await expect(getStorageEstimate()).resolves.toBeNull();
  });

  it('returns null instead of throwing if estimate() rejects', async () => {
    Object.defineProperty(globalThis.navigator, 'storage', {
      value: { estimate: vi.fn().mockRejectedValue(new Error('nope')) },
      configurable: true,
    });

    await expect(getStorageEstimate()).resolves.toBeNull();
  });
});

describe('quota event pub/sub', () => {
  afterEach(() => _resetQuotaListeners());

  it('delivers events to subscribers (primary flow)', () => {
    const listener = vi.fn();
    onQuotaExceeded(listener);

    const event = { store: 'api-cache', recovered: true, evictedCount: 3 };
    notifyQuotaExceeded(event);

    expect(listener).toHaveBeenCalledWith(event);
  });

  it('stops delivering events after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = onQuotaExceeded(listener);
    unsubscribe();

    notifyQuotaExceeded({ store: 'api-cache', recovered: false, evictedCount: 0 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('never lets a broken subscriber throw out of notifyQuotaExceeded (failure case)', () => {
    onQuotaExceeded(() => { throw new Error('broken listener'); });

    expect(() => notifyQuotaExceeded({ store: 'api-cache', recovered: false, evictedCount: 0 })).not.toThrow();
  });
});
