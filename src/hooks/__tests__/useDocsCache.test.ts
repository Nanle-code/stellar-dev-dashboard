import { renderHook, act } from '@testing-library/react';
import { useDocsCache } from '../useDocsCache';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('useDocsCache', () => {
  const mockCacheName = 'stellar-docs-v1';

  beforeEach(() => {
    // Mock caches API
    (global as any).caches = {
      open: vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue([]),
        match: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
      }),
      delete: vi.fn().mockResolvedValue(true),
      keys: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore caches
    (global as any).caches = {
      open: vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue([]),
        match: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
      }),
      delete: vi.fn().mockResolvedValue(true),
      keys: vi.fn().mockResolvedValue([]),
    };
  });

  it('should initialize with no cached docs', () => {
    const { result } = renderHook(() => useDocsCache());

    expect(result.current.isCached).toBe(false);
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.lastUpdated).toBeNull();
    expect(result.current.cachedDocs).toEqual([]);
    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.cacheSize).toBe(0);
    expect(result.current.cacheSizeLimit).toBe(50 * 1024 * 1024);
  });

  it('should check cache status on mount', async () => {
    const { result } = renderHook(() => useDocsCache());

    await act(async () => {
      await result.current.checkCacheStatus();
    });

    expect((global as any).caches.open).toHaveBeenCalledWith(mockCacheName);
  });

  it('should cache documentation URLs', async () => {
    const mockCache = {
      keys: vi.fn().mockResolvedValue([]),
      match: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    };
    (global as any).caches.open = vi.fn().mockResolvedValue(mockCache);
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      body: new ReadableStream(),
    });

    const { result } = renderHook(() => useDocsCache());

    await act(async () => {
      const success = await result.current.cacheDocs(['/docs/test']);
      expect(success).toBe(true);
    });

    expect(mockCache.put).toHaveBeenCalled();
  });

  it('should handle cache errors gracefully', async () => {
    (global as any).caches.open = vi.fn().mockRejectedValue(new Error('Cache error'));

    const { result } = renderHook(() => useDocsCache());

    await act(async () => {
      await result.current.checkCacheStatus();
    });

    expect(result.current.error).toBe('Cache error');
  });

  it('should clear docs cache', async () => {
    const { result } = renderHook(() => useDocsCache());

    await act(async () => {
      const success = await result.current.clearDocsCache();
      expect(success).toBe(true);
    });

    expect((global as any).caches.delete).toHaveBeenCalledWith(mockCacheName);
  });

  it('should check if specific doc is cached', async () => {
    const mockCache = {
      keys: vi.fn().mockResolvedValue([]),
      match: vi.fn().mockResolvedValue({ ok: true }),
      put: vi.fn().mockResolvedValue(undefined),
    };
    (global as any).caches.open = vi.fn().mockResolvedValue(mockCache);

    const { result } = renderHook(() => useDocsCache());

    await act(async () => {
      const isCached = await result.current.isDocCached('/docs/test');
      expect(isCached).toBe(true);
    });

    expect(mockCache.match).toHaveBeenCalledWith('/docs/test');
  });

  it('should return null when cache API is not available', async () => {
    (global as any).caches = undefined;

    const { result } = renderHook(() => useDocsCache());

    const cached = await result.current.getCachedDoc('/docs/test');
    expect(cached).toBeNull();
  });

  it('should enforce cache size limit when caching documents', async () => {
    const mockCache = {
      keys: vi.fn().mockResolvedValue([]),
      match: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    };
    (global as any).caches.open = vi.fn().mockResolvedValue(mockCache);
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'content-length': '100', // Small size
      }),
      body: new ReadableStream(),
    });

    const { result } = renderHook(() => useDocsCache());

    await act(async () => {
      const success = await result.current.cacheDocs(['/docs/test']);
      expect(success).toBe(true);
    });

    expect(mockCache.put).toHaveBeenCalled();
  });

  it('should detect when cache update is available', async () => {
    const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    const mockCache = {
      keys: vi.fn().mockResolvedValue([
        { url: '/docs/test' }
      ]),
      match: vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'x-cache-timestamp': oldTimestamp.toString(),
          'content-length': '1024',
        }),
      }),
    };
    (global as any).caches.open = vi.fn().mockResolvedValue(mockCache);

    const { result } = renderHook(() => useDocsCache());

    await act(async () => {
      await result.current.checkCacheStatus();
    });

    expect(result.current.updateAvailable).toBe(true);
  });
});