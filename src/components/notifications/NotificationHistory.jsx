import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Trash2 } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const NotificationHistory = () => {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const { history, clearHistory, refreshHistory, notifications } = useNotifications();

  const handleOpen = useCallback(() => {
    refreshHistory();
    setOpen(true);
    setClosing(false);
  }, [refreshHistory]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  }, []);

  // close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  const unreadCount = history.filter((n) => !n.readAt).length;

  return (
    <>
      <button
        className="notification-history-toggle"
        onClick={open ? handleClose : handleOpen}
        aria-label="Notification history"
        title="Notification history"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="history-overlay" onClick={handleClose} />
          <div
            className={`notification-history-panel${closing ? ' closing' : ''}`}
          >
            <div className="history-header">
              <span className="history-header-title">Notifications</span>
              <div className="history-actions">
                <button
                  className="history-action-btn danger"
                  onClick={() => {
                    clearHistory();
                  }}
                >
                  <Trash2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Clear
                </button>
                <button className="history-action-btn" onClick={handleClose}>
                  <X size={12} />
                </button>
              </div>
            </div>

            <div className="history-list">
              {history.length === 0 ? (
                <div className="history-empty">No notifications yet</div>
              ) : (
                history.map((item) => (
                  <div className="history-item" key={item.id}>
                    <div
                      className="history-item-dot"
                      data-type={item.type}
                    />
                    <div className="history-item-content">
                      <div className="history-item-title">{item.title}</div>
                      {item.message && (
                        <div className="history-item-message">{item.message}</div>
                      )}
                      <div className="history-item-time">
                        {formatTimeAgo(item.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default NotificationHistory;
