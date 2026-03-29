import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import '../../styles/accessibility.css'; // Just to make sure we have access to sr-only if needed

const ICONS = {
  success: <CheckCircle2 className="w-5 h-5 text-green" />,
  error: <XCircle className="w-5 h-5 text-red" />,
  warning: <AlertCircle className="w-5 h-5 text-amber" />,
  info: <Info className="w-5 h-5 text-cyan" />
};

const BORDERS = {
  success: 'border-green',
  error: 'border-red',
  warning: 'border-amber',
  info: 'border-cyan'
};

const NotificationItem = ({ notification, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 300); // Matches transition duration
  };

  useEffect(() => {
    if (notification.timeout !== 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
      }, notification.timeout - 300);
      
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-full max-w-md bg-bg-surface overflow-hidden rounded-lg shadow-lg ring-1 ring-border border-l-4 ${
        BORDERS[notification.type] || BORDERS.info
      } transition-all duration-300 ease-in-out ${
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
    >
      <div className="p-4 flex items-start w-full">
        <div className="flex-shrink-0 pt-0.5">
          {ICONS[notification.type] || ICONS.info}
        </div>
        <div className="ml-3 w-0 flex-1 flex flex-col pt-0.5">
          <p className="text-sm font-medium text-text-primary">
            {notification.title}
          </p>
          {notification.message && (
            <p className="mt-1 text-sm text-text-secondary">
              {notification.message}
            </p>
          )}
        </div>
        <div className="ml-4 flex flex-shrink-0">
          <button
            type="button"
            className="inline-flex rounded-md text-text-muted hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-cyan"
            onClick={handleClose}
          >
            <span className="sr-only">Close</span>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
