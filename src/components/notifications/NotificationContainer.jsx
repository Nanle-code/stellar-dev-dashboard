import React from 'react';
import { useStore } from '../../lib/store';
import NotificationItem from './NotificationItem';

const NotificationContainer = () => {
  const notifications = useStore((s) => s.notifications);
  const removeNotification = useStore((s) => s.removeNotification);

  if (!notifications.length) return null;

  return (
    <div className="notification-container" aria-live="polite">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} onClose={removeNotification} />
      ))}
    </div>
  );
};

export default NotificationContainer;
