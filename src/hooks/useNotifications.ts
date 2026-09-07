import { useCallback } from 'react';
import { useStore } from '../lib/store';
import { generateId, NOTIFICATION_DEFAULT_TIMEOUT, playSound } from '../lib/notifications';

export const useNotifications = () => {
  const { notifications, addNotification, removeNotification, addNotificationHistory } = useStore();

  const notify = useCallback(
    (type, title, message, timeout = NOTIFICATION_DEFAULT_TIMEOUT, silent = false) => {
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

  const success = useCallback((title, message, timeout, silent) => notify('success', title, message, timeout, silent), [notify]);
  const error = useCallback((title, message, timeout, silent) => notify('error', title, message, timeout, silent), [notify]);
  const info = useCallback((title, message, timeout, silent) => notify('info', title, message, timeout, silent), [notify]);
  const warning = useCallback((title, message, timeout, silent) => notify('warning', title, message, timeout, silent), [notify]);
  const txConfirm = useCallback((title, message, timeout, silent) => notify('tx_confirm', title, message, timeout, silent), [notify]);
  const accountChange = useCallback((title, message, timeout, silent) => notify('account_change', title, message, timeout, silent), [notify]);
  const networkEvent = useCallback((title, message, timeout, silent) => notify('network_event', title, message, timeout, silent), [notify]);
  const priceAlert = useCallback((title, message, timeout, silent) => notify('price_alert', title, message, timeout, silent), [notify]);

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
