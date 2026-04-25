import { useCallback, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import {
  notificationManager,
  getNotificationHistory,
  clearNotificationHistory,
} from '../lib/notifications';

export function useNotifications() {
  const notifications = useStore((s) => s.notifications);
  const removeNotification = useStore((s) => s.removeNotification);
  const clearNotifications = useStore((s) => s.clearNotifications);

  // history is read on demand rather than synced into state to avoid
  // unnecessary re-renders on every push
  const [history, setHistory] = useState(() => getNotificationHistory());

  const refreshHistory = useCallback(() => {
    setHistory(getNotificationHistory());
  }, []);

  const notify = useCallback(
    ({ type = 'info', title, message, timeout, sound, persist } = {}) => {
      const id = notificationManager.send({ type, title, message, timeout, sound, persist });
      // refresh the local history snapshot after a tick so localStorage has flushed
      setTimeout(refreshHistory, 50);
      return id;
    },
    [refreshHistory],
  );

  // convenience wrappers
  const success = useCallback(
    (title, message, opts) => notify({ type: 'success', title, message, ...opts }),
    [notify],
  );
  const error = useCallback(
    (title, message, opts) => notify({ type: 'error', title, message, ...opts }),
    [notify],
  );
  const info = useCallback(
    (title, message, opts) => notify({ type: 'info', title, message, ...opts }),
    [notify],
  );
  const warning = useCallback(
    (title, message, opts) => notify({ type: 'warning', title, message, ...opts }),
    [notify],
  );

  const clearAll = useCallback(() => {
    clearNotifications();
  }, [clearNotifications]);

  const clearHistory = useCallback(() => {
    clearNotificationHistory();
    setHistory([]);
  }, []);

  return useMemo(
    () => ({
      notifications,
      history,
      notify,
      success,
      error,
      info,
      warning,
      removeNotification,
      clearAll,
      clearHistory,
      refreshHistory,
    }),
    [
      notifications,
      history,
      notify,
      success,
      error,
      info,
      warning,
      removeNotification,
      clearAll,
      clearHistory,
      refreshHistory,
    ],
  );
}

export default useNotifications;
