import React from 'react';
import { useStore } from '../../lib/store';
import NotificationItem from './NotificationItem';

const NotificationCenter = () => {
  const { notifications, removeNotification } = useStore();

  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-50 overflow-hidden"
    >
      <div className="w-full h-full flex flex-col items-center sm:items-end gap-y-4">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={removeNotification}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationCenter;
