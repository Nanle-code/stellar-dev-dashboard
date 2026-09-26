import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  X,
  Activity,
  TrendingUp,
  Wallet,
  AlertOctagon,
} from 'lucide-react';
import '../../styles/accessibility.css';
import {
  normalizeSeverity,
  resolveAccessibilityConfig,
  resolveDismissDuration,
  SEVERITY_TAXONOMY,
} from '../../lib/notificationTaxonomy';

const ICONS = {
  success: <CheckCircle2 className="w-5 h-5 text-green" />,
  error: <XCircle className="w-5 h-5 text-red" />,
  critical: <AlertOctagon className="w-5 h-5 text-purple" style={{ color: 'var(--purple, #a855f7)' }} />,
  warning: <AlertCircle className="w-5 h-5 text-amber" />,
  info: <Info className="w-5 h-5 text-cyan" />,
  tx_confirm: <CheckCircle2 className="w-5 h-5 text-green" />,
  account_change: <Wallet className="w-5 h-5 text-cyan" />,
  network_event: <Activity className="w-5 h-5 text-cyan" />,
  price_alert: <TrendingUp className="w-5 h-5 text-amber" />,
};

const BORDERS = {
  success: 'border-green',
  error: 'border-red',
  critical: 'border-purple',
  warning: 'border-amber',
  info: 'border-cyan',
  tx_confirm: 'border-green',
  account_change: 'border-cyan',
  network_event: 'border-cyan',
  price_alert: 'border-amber',
};

const NotificationItem = ({ notification, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const severity = normalizeSeverity(notification.severity || notification.type);
  const a11y = resolveAccessibilityConfig(severity);
  const dismissDuration = resolveDismissDuration(severity, notification.timeout);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(notification.id);
    }, 300); // Matches transition duration
  };

  useEffect(() => {
    if (dismissDuration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
      }, Math.max(100, dismissDuration - 300));

      return () => clearTimeout(timer);
    }
  }, [dismissDuration, notification]);

  return (
    <div
      role={a11y.role}
      aria-live={a11y['aria-live']}
      aria-atomic={a11y['aria-atomic']}
      className={`pointer-events-auto flex w-full max-w-md bg-bg-surface overflow-hidden rounded-lg shadow-lg ring-1 ring-border border-l-4 ${
        BORDERS[notification.type] || BORDERS[severity] || BORDERS.info
      } transition-all duration-300 ease-in-out ${
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
    >
      <div className="p-4 flex items-start w-full">
        <div className="flex-shrink-0 pt-0.5">
          {ICONS[notification.type] || ICONS[severity] || ICONS.info}
        </div>
        <div className="ml-3 w-0 flex-1 flex flex-col pt-0.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-primary">
              {notification.title}
            </p>
            {severity === 'critical' && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(168, 85, 247, 0.2)',
                  color: 'var(--purple, #a855f7)',
                }}
              >
                Critical
              </span>
            )}
          </div>
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
