/**
 * Hook for managing documentation cache for offline access
 */

import { useState, useEffect, useCallback } from 'react';

const DOCS_CACHE_NAME = 'stellar-docs-v1';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB limit
const CACHE_UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface DocsCacheState {
  isCached: boolean;
  isUpdating: boolean;
  lastUpdated: Date | null;
  error: string | null;
  updateAvailable: boolean;
  cacheSize: number;
  cacheSizeLimit: number;
}

interface DocsCacheEntry {
  url: string;
  timestamp: number;
  size: number;
}

export function useDocsCache() {
  const [state, setState] = useState<DocsCacheState>({
    isCached: false,
    isUpdating: false,
    lastUpdated: null,
    error: null,
    updateAvailable: false,
    cacheSize: 0,
    cacheSizeLimit: MAX_CACHE_SIZE,
  });

  const [cachedDocs, setCachedDocs] = useState<DocsCacheEntry[]>([]);

  // Check cache status on mount
  useEffect(() => {
    checkCacheStatus();
  }, []);

  const checkCacheStatus = useCallback(async () => {
    if (!('caches' in window)) {
      setState((prev) => ({ ...prev, error: 'Cache API not available' }));
      return;
    }

    try {
      const cache = await caches.open(DOCS_CACHE_NAME);
      const keys = await cache.keys();

      if (keys.length > 0) {
        const entries: DocsCacheEntry[] = [];
        let totalSize = 0;

        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const timestamp = parseInt(response.headers.get('x-cache-timestamp') || '0');
            const size = response.headers.get('content-length')
              ? parseInt(response.headers.get('content-length')!)
              : 0;
            totalSize += size;

            entries.push({
              url: request.url,
              timestamp: timestamp || Date.now(),
              size,
            });
          }
        }

        const lastUpdated = entries.length > 0
          ? new Date(Math.max(...entries.map((e) => e.timestamp)))
          : null;

        // Check if update is available (cache is older than 24 hours)
        const updateAvailable = lastUpdated
          ? Date.now() - lastUpdated.getTime() > CACHE_UPDATE_CHECK_INTERVAL
          : false;

        setCachedDocs(entries);
        setState((prev) => ({
          ...prev,
          isCached: true,
          lastUpdated,
          cacheSize: totalSize,
          updateAvailable,
          error: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isCached: false,
          lastUpdated: null,
          cacheSize: 0,
          updateAvailable: false,
          error: null,
        }));
        setCachedDocs([]);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check cache status',
      }));
    }
  }, []);

  const cacheDocs = useCallback(async (urls: string[]) => {
    if (!('caches' in window)) {
      setState((prev) => ({ ...prev, error: 'Cache API not available' }));
      return false;
    }

    setState((prev) => ({ ...prev, isUpdating: true, error: null }));

    try {
      const cache = await caches.open(DOCS_CACHE_NAME);
      let currentSize = 0;

      // Calculate current cache size
      const existingKeys = await cache.keys();
      for (const request of existingKeys) {
        const response = await cache.match(request);
        if (response) {
          const size = response.headers.get('content-length')
            ? parseInt(response.headers.get('content-length')!)
            : 0;
          currentSize += size;
        }
      }

      for (const url of urls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const size = response.headers.get('content-length')
              ? parseInt(response.headers.get('content-length')!)
              : 0;

            // Check if adding this would exceed cache limit
            if (currentSize + size > MAX_CACHE_SIZE) {
              console.warn(`Skipping ${url}: would exceed cache limit`);
              continue;
            }

            // Add timestamp header for tracking
            const headers = new Headers(response.headers);
            headers.set('x-cache-timestamp', Date.now().toString());

            const cachedResponse = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            });

            await cache.put(url, cachedResponse);
            currentSize += size;
          }
        } catch (error) {
          console.error(`Failed to cache ${url}:`, error);
        }
      }

      await checkCacheStatus();
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to cache documentation',
        isUpdating: false,
      }));
      return false;
    } finally {
      setState((prev) => ({ ...prev, isUpdating: false }));
    }
  }, [checkCacheStatus]);

  const clearDocsCache = useCallback(async () => {
    if (!('caches' in window)) {
      setState((prev) => ({ ...prev, error: 'Cache API not available' }));
      return false;
    }

    try {
      await caches.delete(DOCS_CACHE_NAME);
      setState((prev) => ({
        ...prev,
        isCached: false,
        lastUpdated: null,
        cacheSize: 0,
        updateAvailable: false,
        error: null,
      }));
      setCachedDocs([]);
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to clear cache',
      }));
      return false;
    }
  }, []);

  const updateDocsCache = useCallback(async () => {
    const criticalDocs = [
      '/docs/getting-started',
      '/docs/api-reference',
      '/docs/soroban',
      '/docs/horizon',
      '/docs/transactions',
      '/docs/operations',
      '/docs/assets',
      '/docs/contracts',
      '/docs/offline',
      '/docs/security',
    ];

    return await cacheDocs(criticalDocs);
  }, [cacheDocs]);

  const getCachedDoc = useCallback(async (url: string): Promise<Response | null> => {
    if (!('caches' in window)) {
      return null;
    }

    try {
      const cache = await caches.open(DOCS_CACHE_NAME);
      const response = await cache.match(url);
      return response || null;
    } catch (error) {
      console.error('Failed to get cached doc:', error);
      return null;
    }
  }, []);

  const isDocCached = useCallback(async (url: string): Promise<boolean> => {
    const cached = await getCachedDoc(url);
    return cached !== null;
  }, [getCachedDoc]);

  return {
    ...state,
    cachedDocs,
    cacheDocs,
    clearDocsCache,
    updateDocsCache,
    getCachedDoc,
    isDocCached,
    checkCacheStatus,
  };
}