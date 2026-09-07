/**
 * Sync Status Indicator Component
 * Displays real-time synchronization status with visual indicators
 */

import React, { useEffect, useState } from 'react';
import { createDataSyncManager } from '../../lib/sync/dataSyncManager';
import { Wifi, WifiOff, Sync, AlertCircle, CheckCircle } from 'lucide-react';

const SyncStatusIndicator = ({
  position = 'top-right',
  showDetails = false,
  onConflict
}) => {
  const [syncManager] = useState(() => createDataSyncManager());
  const [status, setStatus] = useState({
    connected: false,
    syncing: false,
    lastSyncTime: null,
    pendingItems: 0,
    failedItems: 0,
    conflicts: 0,
    progress: 0,
    error: null
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    syncManager.initialize();

    const unsubscribeStatus = syncManager.on('statusChange', (newStatus) => {
      setStatus(newStatus);
    });

    const unsubscribeConflict = syncManager.on('conflict', (conflict) => {
      if (onConflict) {
        onConflict(conflict);
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeConflict();
      syncManager.disconnect();
    };
  }, [syncManager, onConflict]);

  const getPositionClasses = () => {
    const positions = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4'
    };
    return positions[position];
  };

  const getStatusColor = () => {
    if (status.error) return 'text-red-500';
    if (status.syncing) return 'text-blue-500';
    if (status.connected) return 'text-green-500';
    return 'text-gray-500';
  };

  const getStatusIcon = () => {
    if (status.error) return <AlertCircle className="w-5 h-5" />;
    if (status.syncing) return <Sync className="w-5 h-5 animate-spin" />;
    if (status.connected) return <CheckCircle className="w-5 h-5" />;
    return <WifiOff className="w-5 h-5" />;
  };

  const formatLastSync = () => {
    if (!status.lastSyncTime) return 'Never';
    const diff = Date.now() - status.lastSyncTime;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div className={`fixed ${getPositionClasses()} z-50`}>
      <div
        className={`bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl p-3 cursor-pointer transition-all duration-200 ${getStatusColor()}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">
            {status.error ? 'Sync Error' : status.syncing ? 'Syncing...' : status.connected ? 'Synced' : 'Offline'}
          </span>
          {(status.pendingItems > 0 || status.failedItems > 0 || status.conflicts > 0) && (
            <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-0.5 rounded-full">
              {status.pendingItems + status.failedItems + status.conflicts}
            </span>
          )}
        </div>

        {expanded && showDetails && (
          <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Connection</span>
              <span className={status.connected ? 'text-green-500' : 'text-red-500'}>
                {status.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Last Sync</span>
              <span className="text-gray-300">{formatLastSync()}</span>
            </div>

            {status.syncing && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-gray-300">{Math.round(status.progress)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              </div>
            )}

            {status.pendingItems > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Pending</span>
                <span className="text-blue-400">{status.pendingItems} items</span>
              </div>
            )}

            {status.failedItems > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Failed</span>
                <span className="text-red-400">{status.failedItems} items</span>
              </div>
            )}

            {status.conflicts > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Conflicts</span>
                <span className="text-yellow-400">{status.conflicts} items</span>
              </div>
            )}

            {status.error && (
              <div className="text-xs text-red-400 mt-2 p-2 bg-red-500/10 rounded">
                {status.error}
              </div>
            )}

            {(status.failedItems > 0 || status.conflicts > 0) && (
              <button
                className="w-full mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  syncManager.retryFailedSyncs();
                }}
              >
                Retry Failed
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncStatusIndicator;
