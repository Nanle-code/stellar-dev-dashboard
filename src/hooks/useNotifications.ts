import { useCallback } from 'react';
import { useStore } from '../lib/store';
import { generateId, NOTIFICATION_DEFAULT_TIMEOUT } from '../lib/notifications';
import type { Notification } from '../lib/store';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface UseNotificationsReturn {
  notifications: Notification[];
  notify: (type: NotificationType, title: string, message: string, timeout?: number) => string;
  success: (title: string, message: string, timeout?: number) => string;
  error: (title: string, message: string, timeout?: number) => string;
  info: (title: string, message: string, timeout?: number) => string;
  warning: (title: string, message: string, timeout?: number) => string;
  remove: (id: string) => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const { notifications, addNotification, removeNotification } = useStore();

  const notify = useCallback(
    (type: NotificationType, title: string, message: string, timeout = NOTIFICATION_DEFAULT_TIMEOUT): string => {
      const id = generateId();
      addNotification({ id, type, title, message, timeout });
      if (timeout !== 0) {
        setTimeout(() => removeNotification(id), timeout);
      }
      return id;
    },
    [addNotification, removeNotification],
  );

  const success = useCallback((title: string, message: string, timeout?: number) => notify('success', title, message, timeout), [notify]);
  const error = useCallback((title: string, message: string, timeout?: number) => notify('error', title, message, timeout), [notify]);
  const info = useCallback((title: string, message: string, timeout?: number) => notify('info', title, message, timeout), [notify]);
  const warning = useCallback((title: string, message: string, timeout?: number) => notify('warning', title, message, timeout), [notify]);

  return { notifications, notify, success, error, info, warning, remove: removeNotification };
};

export default useNotifications;
