/**
 * Offline detection and sync utilities
 *
 * Enhancements (pwa-offline-resilience):
 *  - navigator.onLine + window events for real-time status
 *  - Persistent offline queue backed by IndexedDB (storage.js OFFLINE_Q store)
 *  - RetryManager-powered flush with exponential back-off when back online
 *  - Simple pub/sub so any component can react to connectivity changes
 */

import { enqueueOfflineOp, getOfflineQueue, dequeueOfflineOp } from '../lib/storage.js';
import { retryManager } from '../lib/errorHandling/RetryManager.ts';
import { createLogger } from './logger.js';

const logger = createLogger('offline');

// ─── State ────────────────────────────────────────────────────────────────────

let isOnline  = typeof navigator !== 'undefined' ? navigator.onLine : true;
let listeners = [];
let _flushing = false;

// ─── Init ─────────────────────────────────────────────────────────────────────

let deferredPrompt = null;
let installPromptListeners = [];

/**
 * Capture the beforeinstallprompt event.
 */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    logger.info('Install prompt captured');
    notifyInstallPromptListeners(true);
  });

  window.addEventListener('appinstalled', (evt) => {
    logger.info('App was installed');
    deferredPrompt = null;
    notifyInstallPromptListeners(false);
  });
}

/**
 * Triggers the install prompt.
 */
export async function promptInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  logger.info(`User response to install prompt: ${outcome}`);
  deferredPrompt = null;
  notifyInstallPromptListeners(false);
}

/**
 * Subscribe to installability changes.
 */
export const subscribeToInstallPrompt = (callback) => {
  installPromptListeners.push(callback);
  callback(!!deferredPrompt);
  return () => { installPromptListeners = installPromptListeners.filter(l => l !== callback); };
};

function notifyInstallPromptListeners(available) {
  installPromptListeners.forEach(cb => { try { cb(available); } catch { /* ignore */ } });
}

/**
 * Registers the service worker and sets up connectivity listeners.
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    logger.info('Service Worker registered with scope:', registration.scope);

    // Initialise background sync if supported
    if ('sync' in registration) {
      try {
        await registration.sync.register('sync-offline-queue');
        logger.info('Background sync registered');
      } catch (err) {
        logger.warn('Background sync registration failed:', err);
      }
    }
  } catch (error) {
    logger.error('Service Worker registration failed:', {}, error);
  }

  initOfflineDetection();
}

/**
 * Sets up online/offline event listeners.
 */
export function initOfflineDetection() {
  window.addEventListener('online', () => {
    isOnline = true;
    logger.info('Network online');
    notifyListeners(true);
    flushOfflineQueue();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    logger.info('Network offline');
    notifyListeners(false);
  });
}

// ─── Push Notifications ───────────────────────────────────────────────────────

/**
 * Request notification permission and return current status.
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    logger.warn('Notifications not supported');
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();
  logger.info(`Notification permission: ${permission}`);
  return permission;
}

/**
 * Show a local notification (minimal workaround for push).
 */
export async function showTestNotification() {
  if (Notification.permission !== 'granted') {
    const res = await requestNotificationPermission();
    if (res !== 'granted') return;
  }

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Stellar Dev Dashboard', {
      body: 'Notifications are working! 🚀',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: 'test-notification',
      vibrate: [100, 50, 100],
      data: {
        url: window.location.origin
      }
    });
  }
}

// ─── Status helpers ───────────────────────────────────────────────────────────

/** Returns current connectivity state. */
export const getOnlineStatus = () => isOnline;

/**
 * Subscribe to online/offline transitions.
 * @param {(online: boolean) => void} callback
 * @returns {() => void} unsubscribe function
 */
export const subscribeToOnlineStatus = (callback) => {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
};

function notifyListeners(online) {
  listeners.forEach(cb => { try { cb(online); } catch { /* ignore */ } });
}

// ─── Persistent offline queue ─────────────────────────────────────────────────

/**
 * Enqueue a write operation that should be replayed when back online.
 *
 * @param {string}   id        Stable identifier (used for dedup / logging)
 * @param {Function} fn        Async function that performs the actual write
 * @param {string}   [label]   Human-readable description shown in the UI
 * @param {number}   [priority=0] Higher = runs first
 */
export const queueRequest = async (id, fn, label = '', priority = 0) => {
  // Serialise the function as a string tag — the real fn lives in-memory.
  // On reload the in-memory queue is gone; callers must re-register pending ops.
  await enqueueOfflineOp({ id, label, priority, serialised: fn.toString() });

  // Also keep an in-memory reference so flushes within the same session work.
  _memoryQueue.set(id, { id, fn, label, priority });

  logger.info(`Queued offline op: ${id}`);
};

/**
 * Cancel a pending operation by id.
 * Note: IDB records without their auto-increment id cannot be deleted by our
 * custom id field alone; we mark them in the memory map for now and rely on
 * the flush to skip missing memory entries.
 */
export const cancelQueuedRequest = (id) => {
  _memoryQueue.delete(id);
};

/** Returns an array of currently queued items (memory view). */
export const getPendingRequests = () => [..._memoryQueue.values()];

/** Returns count of IDB-persisted queued ops (survives reload). */
export const getPendingCount = async () => {
  const queue = await getOfflineQueue();
  return queue.length;
};

// In-memory map: id → { id, fn, label, priority }
const _memoryQueue = new Map();

// ─── Flush ────────────────────────────────────────────────────────────────────

/**
 * Attempt to replay all queued operations using RetryManager back-off.
 * Called automatically when the network comes back online.
 */
export async function flushOfflineQueue() {
  if (_flushing || !isOnline) return;
  _flushing = true;

  logger.info('Flushing offline queue…');

  // Read IDB to find persisted ops; match them to in-memory fn references.
  const persisted = await getOfflineQueue();

  // Sort by priority desc, then queuedAt asc
  persisted.sort((a, b) => {
    if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
    return (a.queuedAt ?? 0) - (b.queuedAt ?? 0);
  });

  for (const record of persisted) {
    const entry = _memoryQueue.get(record.id);
    if (!entry) {
      // No in-memory fn (e.g. after a page reload) — remove stale IDB record
      await dequeueOfflineOp(record.id);
      continue;
    }

    try {
      await retryManager.executeWithRetry(entry.fn, {
        maxRetries: 3,
        baseDelay: 1000,
        onRetry: (attempt, err) => {
          logger.warn(`Retry ${attempt} for queued op "${entry.id}": ${err}`);
        },
      });

      // Success — remove from both stores
      _memoryQueue.delete(record.id);
      await dequeueOfflineOp(record.id);
      logger.info(`Replayed offline op: ${entry.id}`);
    } catch (err) {
      logger.error(`Failed to replay offline op "${entry.id}" after retries`, {}, err);
      // Leave in IDB; will retry next time we go online
    }
  }

  _flushing = false;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// registerServiceWorker is called from main.jsx
