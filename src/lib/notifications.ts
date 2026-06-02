// src/lib/notifications.js
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
};

export const NOTIFICATION_DEFAULT_TIMEOUT = 5000;

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};
