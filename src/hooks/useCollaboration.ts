import { useState, useEffect, useCallback, useRef } from 'react';
import { getCollaborationSocket } from '../lib/websocket';
import {
  createPresenceRecord,
  mergePresence,
  pruneStalePresence,
  buildCursorPayload,
  mergeSharedViewState,
} from '../utils/collaboration';

export interface PresenceRecord {
  sessionId: string;
  address: string | null;
  joinedAt: number;
  lastSeen: number;
  cursor: { x: number; y: number } | null;
}

export interface UseCollaborationReturn {
  connected: boolean;
  peers: Map<string, PresenceRecord>;
  sharedState: Record<string, unknown>;
  broadcastTab: (tab: string) => void;
  broadcastCursor: (x: number, y: number) => void;
}

export function useCollaboration(
  wsUrl: string | null,
  connectedAddress: string | null,
): UseCollaborationReturn {
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<Map<string, PresenceRecord>>(new Map());
  const [sharedState, setSharedState] = useState<Record<string, unknown>>({});
  const socketRef = useRef<ReturnType<typeof getCollaborationSocket> | null>(null);

  useEffect(() => {
    if (!wsUrl) return;

    const socket = getCollaborationSocket(wsUrl);
    socketRef.current = socket;

    const unsubConnected = socket.on('connected', ({ sessionId }: { sessionId: string }) => {
      setConnected(true);
      socket.send('presence:join', createPresenceRecord(sessionId, connectedAddress));
    });

    const unsubDisconnected = socket.on('disconnected', () => setConnected(false));

    const unsubPresenceJoin = socket.on('presence:join', (msg: { payload: PresenceRecord }) => {
      setPeers((prev) => mergePresence(prev, msg.payload));
    });

    const unsubPresenceLeave = socket.on('presence:leave', (msg: { payload?: { sessionId: string } }) => {
      setPeers((prev) => {
        const next = new Map(prev);
        next.delete(msg.payload?.sessionId ?? '');
        return next;
      });
    });

    const unsubHeartbeat = socket.on('presence:heartbeat', (msg: { payload: PresenceRecord }) => {
      setPeers((prev) => mergePresence(prev, { ...msg.payload, lastSeen: Date.now() }));
    });

    const unsubViewState = socket.on('view:state', (msg: { payload?: Record<string, unknown> }) => {
      setSharedState((prev) => mergeSharedViewState(prev, msg.payload ?? {}));
    });

    const pruneInterval = setInterval(() => {
      setPeers((prev) => pruneStalePresence(prev, 30_000));
    }, 15_000);

    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.send('presence:heartbeat', {
          sessionId: socket.sessionId,
          address: connectedAddress ?? null,
          lastSeen: Date.now(),
        });
      }
    }, 10_000);

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubPresenceJoin();
      unsubPresenceLeave();
      unsubHeartbeat();
      unsubViewState();
      clearInterval(pruneInterval);
      clearInterval(heartbeatInterval);
    };
  }, [wsUrl, connectedAddress]);

  const broadcastTab = useCallback((tab: string) => {
    socketRef.current?.send('view:state', { activeTab: tab });
  }, []);

  const broadcastCursor = useCallback((x: number, y: number) => {
    socketRef.current?.send('cursor:move', buildCursorPayload(x, y));
  }, []);

  return { connected, peers, sharedState, broadcastTab, broadcastCursor };
}
