/**
 * useCollaboration.js
 * React hook that wires up:
 *  - BroadcastChannel cross-tab sync (via stateSync.js)
 *  - URL hash encoding / decoding for shareable read-only sessions
 *  - Privacy warning logic for public-key URLs
 *  - Optional WebSocket stub (no external server required)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  initStateSync,
  destroyStateSync,
  buildShareableURL,
  decodeSessionFromHash,
  broadcastStateChange,
} from '../utils/stateSync';

/**
 * @param {object} store - Raw Zustand store object (not the hook)
 *   Must expose: .getState(), .setState(), .subscribe()
 * @param {object} [options]
 * @param {boolean} [options.enableWebSocket=false] - If true, enables WS stub
 * @param {string}  [options.wsUrl]                 - WebSocket URL when stub is active
 */
export function useCollaboration(store, options = {}) {
  const { enableWebSocket = false, wsUrl } = options;

  // ── Sync status ─────────────────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'active' | 'error'
  const [connectedTabs, setConnectedTabs] = useState(1);

  // ── Share link ───────────────────────────────────────────────────────────────
  const [shareURL, setShareURL] = useState('');
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // ── WebSocket stub ───────────────────────────────────────────────────────────
  const wsRef = useRef(null);
  const [wsStatus, setWsStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'

  // ── Init BroadcastChannel sync ───────────────────────────────────────────────
  useEffect(() => {
    if (!store) return;

    try {
      initStateSync(store);
      setSyncStatus('active');
    } catch (err) {
      console.warn('[useCollaboration] Could not init stateSync:', err);
      setSyncStatus('error');
    }

    // Count tabs via a dedicated ping channel
    const pingChannel = 'BroadcastChannel' in window ? new BroadcastChannel('stellar-tab-count') : null;

    if (pingChannel) {
      // Announce this tab's presence
      pingChannel.postMessage({ type: 'TAB_OPEN' });

      const tabSet = new Set();
      tabSet.add('self');

      pingChannel.onmessage = (e) => {
        if (e.data?.type === 'TAB_OPEN') {
          tabSet.add(e.data.tabId || Math.random());
          setConnectedTabs(tabSet.size);
          // Reply so the new tab knows about us
          pingChannel.postMessage({ type: 'TAB_ACK', tabId: 'self' });
        } else if (e.data?.type === 'TAB_ACK') {
          tabSet.add(e.data.tabId || Math.random());
          setConnectedTabs(tabSet.size);
        } else if (e.data?.type === 'TAB_CLOSE') {
          tabSet.delete(e.data.tabId);
          setConnectedTabs(Math.max(1, tabSet.size));
        }
      };

      // Clean up on unload
      const handleUnload = () => {
        pingChannel.postMessage({ type: 'TAB_CLOSE', tabId: 'self' });
      };
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        handleUnload();
        pingChannel.close();
        destroyStateSync();
        window.removeEventListener('beforeunload', handleUnload);
      };
    }

    return () => {
      destroyStateSync();
    };
  }, [store]);

  // ── Restore state from URL hash on mount ────────────────────────────────────
  useEffect(() => {
    if (!store) return;
    const sessionState = decodeSessionFromHash(window.location.hash);
    if (sessionState) {
      store.setState(sessionState);
    }
  }, [store]);

  // ── WebSocket stub ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enableWebSocket || !wsUrl || !store) return;

    setWsStatus('connecting');
    let ws;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        // Send current safe state on connect
        const state = store.getState();
        ws.send(JSON.stringify({ type: 'STATE_HELLO', payload: buildShareableURL(state) }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE_UPDATE' && msg.payload) {
            // Apply remote state update via store
            store.setState(msg.payload);
            broadcastStateChange(msg.payload); // also propagate to local tabs
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => setWsStatus('error');
      ws.onclose = () => setWsStatus('disconnected');
    } catch (err) {
      setWsStatus('error');
      console.warn('[useCollaboration] WebSocket error:', err);
    }

    return () => {
      if (ws && ws.readyState < 2) ws.close();
      wsRef.current = null;
    };
  }, [enableWebSocket, wsUrl, store]);

  // ── Generate share link ──────────────────────────────────────────────────────
  const generateShareLink = useCallback(() => {
    if (!store) return;
    const state = store.getState();
    const url = buildShareableURL(state);
    setShareURL(url);

    // Show privacy warning: a watch address (public key) is in the URL.
    // Public keys are NOT secrets (they are addresses), but users may not
    // want to share which address they are watching. Let them decide.
    if (state.connectedAddress) {
      setShowPrivacyWarning(true);
    } else {
      setShowPrivacyWarning(false);
    }

    return url;
  }, [store]);

  const copyShareLink = useCallback(async () => {
    const url = generateShareLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      // Fallback: select the text if clipboard API fails
      console.warn('[useCollaboration] Clipboard write failed');
    }
  }, [generateShareLink]);

  const dismissPrivacyWarning = useCallback(() => {
    setShowPrivacyWarning(false);
  }, []);

  return {
    // Sync
    syncStatus,
    connectedTabs,

    // Share link
    shareURL,
    generateShareLink,
    copyShareLink,
    copySuccess,

    // Privacy
    showPrivacyWarning,
    dismissPrivacyWarning,

    // WebSocket stub
    wsStatus,
  };
}