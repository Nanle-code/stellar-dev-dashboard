/**
 * useSessionRecording - React hook for session recording (#410)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  startRecording, stopRecording, isRecording,
  getActiveRecording, getRecordings, deleteRecording,
  createReplay, subscribeRecording,
  type SessionRecording, type SessionSearchOptions,
} from '../lib/sessionRecording';
import { useStore } from '../lib/store';

export function useSessionRecording() {
  const userId = useStore((s) => s.walletPublicKey);
  const [active, setActive] = useState<SessionRecording | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    setActive(getActiveRecording());
    setRecording(isRecording());
    const unsub = subscribeRecording((s) => {
      setActive({ ...s });
    });
    return unsub;
  }, []);

  const start = useCallback(
    async (tags: string[] = []) => {
      const id = await startRecording(userId, tags);
      setRecording(true);
      setActive(getActiveRecording());
      return id;
    },
    [userId],
  );

  const stop = useCallback(async () => {
    const finished = await stopRecording();
    setRecording(false);
    setActive(null);
    return finished;
  }, []);

  return { recording, active, start, stop };
}

export function useSessionList(opts: SessionSearchOptions = {}) {
  const [sessions, setSessions] = useState<SessionRecording[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRecordings(opts);
      setSessions(result);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(opts)]);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteRecording(id);
    await refresh();
  }, [refresh]);

  return { sessions, loading, refresh, remove };
}

export function useReplay(session: SessionRecording | null) {
  const replay = session ? createReplay(session) : null;
  const [cursor, setCursor] = useState(0);

  const next = useCallback(() => {
    const ev = replay?.next();
    setCursor(replay?.cursor ?? 0);
    return ev ?? null;
  }, [replay]);

  const seek = useCallback((index: number) => {
    replay?.seek(index);
    setCursor(replay?.cursor ?? 0);
  }, [replay]);

  const reset = useCallback(() => {
    replay?.reset();
    setCursor(0);
  }, [replay]);

  const progress = replay ? cursor / Math.max(session!.events.length, 1) : 0;
  const currentEvent = replay?.currentEvent ?? null;
  const done = replay?.done ?? true;

  return { cursor, progress, currentEvent, done, next, seek, reset };
}
