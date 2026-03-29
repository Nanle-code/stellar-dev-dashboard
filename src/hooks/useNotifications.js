import { useCallback } from 'react';
import { useStore } from '../lib/store';
import { generateId, NOTIFICATION_DEFAULT_TIMEOUT } from '../lib/notifications';

export const useNotifications = () => {
  const { notifications, addNotification, removeNotification } = useStore();

  const notify = useCallback(
    (type, title, message, timeout = NOTIFICATION_DEFAULT_TIMEOUT) => {
      const id = generateId();
      
      addNotification({
        id,
        type,
        title,
        message,
        timeout
      });

      if (timeout !== 0) {
        setTimeout(() => {
          removeNotification(id);
        }, timeout);
      }
      
      return id;
    },
    [addNotification, removeNotification]
  );

  const success = useCallback((title, message, timeout) => notify('success', title, message, timeout), [notify]);
  const error = useCallback((title, message, timeout) => notify('error', title, message, timeout), [notify]);
  const info = useCallback((title, message, timeout) => notify('info', title, message, timeout), [notify]);
  const warning = useCallback((title, message, timeout) => notify('warning', title, message, timeout), [notify]);

  return {
    notifications,
    notify,
    success,
    error,
    info,
    warning,
    remove: removeNotification
  };
};

export default useNotifications;
