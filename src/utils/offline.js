/**
 * src/utils/offline.js
 *
 * PWA offline utilities:
 *  - registerServiceWorker()   — registers /sw.js, fires callbacks on update ready
 *  - onUpdateReady(cb)         — subscribe to SW update events
 *  - applyUpdate()             — tell the waiting SW to take over
 *  - captureInstallPrompt()    — store the beforeinstallprompt event
 *  - canInstall()              — true when a deferred prompt is waiting
 *  - promptInstall()           — trigger the native install dialog
 *  - isOffline()               — true when navigator.onLine === false
 *  - onNetworkChange(cb)       — subscribe to online/offline events
 */

// ─── Internal state ───────────────────────────────────────────────────────────

let _registration = null;
let _waitingSW = null;
let _deferredInstallPrompt = null;
const _updateListeners = new Set();
const _networkListeners = new Set();

// ─── Service Worker registration ─────────────────────────────────────────────

/**
 * Register the service worker and wire up update detection.
 * Safe to call multiple times — skips if SW is unsupported.
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    _registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // A new SW is waiting to activate (user already has an old version)
    if (_registration.waiting) {
      _waitingSW = _registration.waiting;
      _notifyUpdateListeners();
    }

    // A new SW finishes installing while the page is open
    _registration.addEventListener('updatefound', () => {
      const newWorker = _registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // New version is ready, old version still in control
          _waitingSW = newWorker;
          _notifyUpdateListeners();
        }
      });
    });

    // When the SW controller changes (after skipWaiting), reload to apply update
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    console.log('[SW] Registered, scope:', _registration.scope);
  } catch (err) {
    console.error('[SW] Registration failed:', err);
  }
}

function _notifyUpdateListeners() {
  _updateListeners.forEach((cb) => cb());
}

/**
 * Subscribe to "a new app version is ready" events.
 * @param {() => void} cb
 * @returns {() => void} unsubscribe function
 */
export function onUpdateReady(cb) {
  _updateListeners.add(cb);
  // Fire immediately if an update is already waiting
  if (_waitingSW) cb();
  return () => _updateListeners.delete(cb);
}

/**
 * Tell the waiting SW to skip waiting and take over.
 * The page will automatically reload via the controllerchange listener above.
 */
export function applyUpdate() {
  if (_waitingSW) {
    _waitingSW.postMessage({ type: 'SKIP_WAITING' });
  }
}

// ─── Install prompt ───────────────────────────────────────────────────────────

/**
 * Call once (e.g. in main.jsx) to capture the browser's install prompt.
 * The event must be captured before it fires to defer it for later.
 */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // suppress the automatic mini-infobar
    _deferredInstallPrompt = event;
  });

  // Clear the prompt once the app is installed
  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    console.log('[PWA] App installed');
  });
}

/** Returns true when a deferred install prompt is available. */
export function canInstall() {
  return _deferredInstallPrompt !== null;
}

/**
 * Show the native "Add to home screen" / install dialog.
 * @returns {Promise<'accepted'|'dismissed'|null>}
 */
export async function promptInstall() {
  if (!_deferredInstallPrompt) return null;
  _deferredInstallPrompt.prompt();
  const { outcome } = await _deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    _deferredInstallPrompt = null;
  }
  return outcome;
}

// ─── Network status ───────────────────────────────────────────────────────────

/** Returns true when the browser reports no network connectivity. */
export function isOffline() {
  return !navigator.onLine;
}

/**
 * Subscribe to online/offline changes.
 * @param {(online: boolean) => void} cb
 * @returns {() => void} unsubscribe function
 */
export function onNetworkChange(cb) {
  const handleOnline = () => cb(true);
  const handleOffline = () => cb(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  _networkListeners.add({ handleOnline, handleOffline });
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}