import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const TYPE_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const NotificationItem = ({ notification, onClose }) => {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  const dismiss = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => onClose(notification.id), 260);
  };

  useEffect(() => {
    if (!notification.timeout || notification.timeout <= 0) return;

    timerRef.current = setTimeout(dismiss, notification.timeout);
    return () => clearTimeout(timerRef.current);
  }, []); // intentionally run once

  const Icon = TYPE_ICONS[notification.type] || Info;

  return (
    <div
      role="alert"
      className={`notification-item${exiting ? ' exiting' : ''}`}
      data-type={notification.type}
      style={{ position: 'relative', overflow: 'hidden' }}
      onMouseEnter={() => {
        // pause auto-dismiss on hover
        if (timerRef.current) clearTimeout(timerRef.current);
      }}
      onMouseLeave={() => {
        if (!notification.timeout || notification.timeout <= 0 || exiting) return;
        timerRef.current = setTimeout(dismiss, 2000);
      }}
    >
      <div className="notification-icon">
        <Icon size={16} />
      </div>

      <div className="notification-body">
        <div className="notification-title">{notification.title}</div>
        {notification.message && (
          <div className="notification-message">{notification.message}</div>
        )}
      </div>

      <button
        className="notification-close"
        onClick={dismiss}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>

      {notification.timeout > 0 && !exiting && (
        <div
          className="notification-progress"
          style={{
            width: '100%',
            animation: `notif-shrink ${notification.timeout}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
};

export default NotificationItem;
