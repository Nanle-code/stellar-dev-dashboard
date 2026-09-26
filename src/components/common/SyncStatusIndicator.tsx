import React from 'react';
import { Clock, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { DraftSyncStatus } from '../../lib/offlineDrafts';

export interface SyncStatusIndicatorProps {
  status: DraftSyncStatus;
  error?: string;
  lastSyncedAt?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  status,
  error,
  lastSyncedAt,
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;

  const config = (() => {
    switch (status) {
      case 'draft':
        return {
          label: 'Offline Draft',
          description: 'Created offline. Queued to sync when connectivity returns.',
          badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          icon: <Clock size={iconSize} className="text-amber-400 shrink-0" />,
        };
      case 'syncing':
        return {
          label: 'Syncing',
          description: 'Validating and syncing draft with Stellar network...',
          badgeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
          icon: <RefreshCw size={iconSize} className="text-sky-400 animate-spin shrink-0" />,
        };
      case 'synced':
        return {
          label: 'Synced',
          description: lastSyncedAt
            ? `Synced on ${new Date(lastSyncedAt).toLocaleTimeString()}`
            : 'Synced with network',
          badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: <CheckCircle2 size={iconSize} className="text-emerald-400 shrink-0" />,
        };
      case 'failed':
        return {
          label: 'Sync Failed',
          description: error || 'Failed to sync with network. Review draft details.',
          badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          icon: <AlertTriangle size={iconSize} className="text-rose-400 shrink-0" />,
        };
      case 'conflict':
        return {
          label: 'Conflict',
          description: 'Draft conflicts with current network sequence or state.',
          badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
          icon: <AlertCircle size={iconSize} className="text-purple-400 shrink-0" />,
        };
      default:
        return {
          label: 'Unknown',
          description: 'Draft state unknown',
          badgeBg: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
          icon: <Clock size={iconSize} className="text-gray-400 shrink-0" />,
        };
    }
  })();

  const sizeClasses =
    size === 'sm'
      ? 'text-[10px] px-2 py-0.5 gap-1'
      : size === 'lg'
        ? 'text-xs px-3 py-1.5 gap-2'
        : 'text-[11px] px-2.5 py-1 gap-1.5';

  return (
    <div
      title={config.description}
      className={`inline-flex items-center font-medium rounded-full border ${config.badgeBg} ${sizeClasses} ${className}`}
      role="status"
      aria-label={`Draft sync status: ${config.label}`}
    >
      {config.icon}
      {showLabel && <span>{config.label}</span>}
    </div>
  );
};

export default SyncStatusIndicator;
