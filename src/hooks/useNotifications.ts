import { useCallback } from 'react';
import { useStore } from '../lib/store';
import type { Notification } from '../lib/store';
import { generateId, NOTIFICATION_DEFAULT_TIMEOUT, playSound } from '../lib/notifications';

export type NotificationType =
  | 'success'
  | 'error'
  | 'info'
  | 'warning'
  | 'tx_confirm'
  | 'account_change'
  | 'network_event'
  | 'price_alert';

export type NotifyFn = (
  type: NotificationType | string,
  title: string,
  message: string,
  timeout?: number,
  silent?: boolean
) => string;

export type NotifyShortcut = (
  title: string,
  message: string,
  timeout?: number,
  silent?: boolean
) => string;

export interface UseNotificationsReturn {
  notifications: Notification[];
  notify: NotifyFn;
  success: NotifyShortcut;
  error: NotifyShortcut;
  info: NotifyShortcut;
  warning: NotifyShortcut;
  txConfirm: NotifyShortcut;
  accountChange: NotifyShortcut;
  networkEvent: NotifyShortcut;
  priceAlert: NotifyShortcut;
  remove: (id: string) => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const { notifications, addNotification, removeNotification, addNotificationHistory } = useStore();

  const notify = useCallback(
    (type: NotificationType | string, title: string, message: string, timeout: number = NOTIFICATION_DEFAULT_TIMEOUT, silent: boolean = false): string => {
      const id = generateId();
      
      const notification = {
        id,
        type,
        title,
        message,
        timeout,
        timestamp: Date.now()
      };
      
      addNotification(notification);
      addNotificationHistory(notification);
      
      if (!silent) {
        playSound(type);
      }

      if (timeout !== 0) {
        setTimeout(() => {
          removeNotification(id);
        }, timeout);
      }
      
      return id;
    },
    [addNotification, removeNotification, addNotificationHistory]
  );

  const success = useCallback((title: string, message: string, timeout?: number, silent?: boolean): string => notify('success', title, message, timeout, silent), [notify]);
  const error = useCallback((title: string, message: string, timeout?: number, silent?: boolean): string => notify('error', title, message, timeout, silent), [notify]);
  const info = useCallback((title: string, message: string, timeout?: number, silent?: boolean): string => notify('info', title, message, timeout, silent), [notify]);
  const warning = useCallback((title: string, message: string, timeout?: number, silent?: boolean): string => notify('warning', title, message, timeout, silent), [notify]);
  const txConfirm = useCallback((title: string, message: string, timeout?: number, silent?: boolean): string => notify('tx_confirm', title, message, timeout, silent), [notify]);
  const accountChange = useCallback((title: string, message: string, timeout?: number, silent?: boolean): string => notify('account_change', title, message, timeout, silent), [notify]);
  const networkEvent = useCallback((title: string, message: string, timeout?: number, silent?: boolean): string => notify('network_event', title, message, timeout, silent), [notify]);
  const priceAlert = useCallback((title: string, message: string, timeout?: number, silent?: boolean): string => notify('price_alert', title, message, timeout, silent), [notify]);

  return {
    notifications,
    notify,
    success,
    error,
    info,
    warning,
    txConfirm,
    accountChange,
    networkEvent,
    priceAlert,
    remove: removeNotification
  };
};

export default useNotifications;
