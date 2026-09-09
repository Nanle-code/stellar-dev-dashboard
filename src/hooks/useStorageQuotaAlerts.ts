/**
 * Subscribes to storage quota-exceeded events (see lib/storageQuota.js) and
 * surfaces them as a toast notification explaining what happened and how to
 * recover. Mount once near the app root.
 */
import { useEffect, useRef } from 'react';
import { onQuotaExceeded } from '../lib/storageQuota';
import { useNotifications } from './useNotifications';

interface QuotaEvent {
  store: string;
  key?: string;
  recovered: boolean;
  evictedCount: number;
  fallback?: string;
}

// Avoid spamming the user if several writes fail in a short window.
const NOTIFY_THROTTLE_MS = 60_000;

export function useStorageQuotaAlerts(): void {
  const { warning } = useNotifications();
  const lastNotifiedAt = useRef(0);

  useEffect(() => {
    return onQuotaExceeded((event: QuotaEvent) => {
      const now = Date.now();
      if (now - lastNotifiedAt.current < NOTIFY_THROTTLE_MS) return;
      lastNotifiedAt.current = now;

      if (event.recovered) {
        const entries = event.evictedCount === 1 ? 'entry' : 'entries';
        warning(
          'Storage space freed up',
          `Your browser's storage was full, so we cleared ${event.evictedCount} cached ${entries} to make room. Your data was saved.`,
        );
      } else {
        warning(
          'Storage is full',
          "Your browser's storage is full and we couldn't free up enough space automatically. Try clearing this site's data in your browser settings, or free up disk space and reload.",
          0,
        );
      }
    });
  }, [warning]);
}

export default useStorageQuotaAlerts;
