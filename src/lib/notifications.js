export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
};

export const NOTIFICATION_DEFAULT_TIMEOUT = 5000;

const STORAGE_KEY = 'stellar_notification_history';
const MAX_HISTORY = 50;

// dedupe window — same title+type within this many ms gets swallowed
const DEDUPE_WINDOW_MS = 2000;

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// --- localStorage persistence ---

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveHistory(items) {
  try {
    const trimmed = items.slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // storage full or blocked — not critical
  }
}

export function getNotificationHistory() {
  return loadHistory();
}

export function clearNotificationHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

function pushToHistory(notification) {
  const history = loadHistory();
  // avoid writing dupes that somehow ended up in the queue before a reload
  if (history.some((n) => n.id === notification.id)) return;
  const entry = {
    ...notification,
    readAt: null,
    persistedAt: Date.now(),
  };
  saveHistory([entry, ...history]);
}

// --- Sound system (Web Audio API) ---

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

const SOUND_PROFILES = {
  success: { freq: 880, duration: 0.12, type: 'sine' },
  error: { freq: 320, duration: 0.25, type: 'square' },
  warning: { freq: 520, duration: 0.18, type: 'triangle' },
  info: { freq: 660, duration: 0.1, type: 'sine' },
};

function playTone(profile) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = profile.type;
    osc.frequency.setValueAtTime(profile.freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + profile.duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + profile.duration);
  } catch {
    // audio blocked or unsupported — silently skip
  }
}

// --- Notification manager ---
// This is the singleton that ties everything together.
// Components don't talk to this directly — they go through useNotifications / the store.
// But other non-React code (streaming callbacks, websocket handlers) can call
// notificationManager.send() to push events without needing a hook.

let _storeRef = null;
const _recentKeys = new Map(); // deduplication cache

export const notificationManager = {
  // called once from the store init so we have a reference
  _bindStore(store) {
    _storeRef = store;
  },

  send({
    type = 'info',
    title,
    message = '',
    timeout = NOTIFICATION_DEFAULT_TIMEOUT,
    sound = false,
    persist = true,
  }) {
    if (!title) return null;

    // dedupe — skip if an identical notification fired very recently
    const dedupeKey = `${type}::${title}`;
    const lastSeen = _recentKeys.get(dedupeKey);
    if (lastSeen && Date.now() - lastSeen < DEDUPE_WINDOW_MS) return null;
    _recentKeys.set(dedupeKey, Date.now());

    const id = generateId();
    const notification = {
      id,
      type,
      title,
      message,
      timeout,
      createdAt: Date.now(),
    };

    if (_storeRef) {
      _storeRef.getState().addNotification(notification);

      // auto-dismiss
      if (timeout > 0) {
        setTimeout(() => {
          _storeRef.getState().removeNotification(id);
        }, timeout);
      }
    }

    if (persist) {
      pushToHistory(notification);
    }

    if (sound) {
      const profile = SOUND_PROFILES[type] || SOUND_PROFILES.info;
      playTone(profile);
    }

    return id;
  },

  // shortcuts for the common event categories
  txConfirmed(hash) {
    return this.send({
      type: 'success',
      title: 'Transaction confirmed',
      message: hash ? `Hash: ${hash.slice(0, 8)}…${hash.slice(-8)}` : '',
      sound: true,
    });
  },

  txFailed(reason) {
    return this.send({
      type: 'error',
      title: 'Transaction failed',
      message: reason || 'Check the console for details',
      sound: true,
      timeout: 8000,
    });
  },

  accountChanged(address) {
    return this.send({
      type: 'info',
      title: 'Account updated',
      message: address ? `${address.slice(0, 6)}…${address.slice(-6)}` : '',
    });
  },

  networkEvent(msg) {
    return this.send({
      type: 'warning',
      title: 'Network event',
      message: msg,
    });
  },

  priceAlert(asset, direction, pct) {
    return this.send({
      type: direction === 'up' ? 'success' : 'warning',
      title: `${asset} ${direction === 'up' ? '↑' : '↓'} ${pct}%`,
      message: 'Price alert triggered',
      sound: true,
    });
  },
};
