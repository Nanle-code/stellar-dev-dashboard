import React, { useState, useEffect } from 'react';
import {
  FileText,
  RefreshCw,
  Trash2,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  Filter,
  ArrowRight,
} from 'lucide-react';
import {
  type OfflineDraft,
  type DraftSyncSummary,
  subscribeToDraftSync,
  deleteOfflineDraft,
  syncPendingDrafts,
  retryFailedDrafts,
  clearOfflineDrafts,
} from '../../lib/offlineDrafts';
import { isOnline } from '../../lib/offlineReadOnly';
import SyncStatusIndicator from '../common/SyncStatusIndicator';

export interface OfflineDraftQueueProps {
  onSelectDraft?: (_draft: OfflineDraft) => void;
  currentNetwork?: string;
  className?: string;
}

export const OfflineDraftQueue: React.FC<OfflineDraftQueueProps> = ({
  onSelectDraft,
  currentNetwork,
  className = '',
}) => {
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [summary, setSummary] = useState<DraftSyncSummary>({
    total: 0,
    offlineCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    failedCount: 0,
    conflictCount: 0,
    hasPendingSync: false,
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [networkFilter, setNetworkFilter] = useState<string>(currentNetwork || 'all');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const online = isOnline();

  useEffect(() => {
    const unsub = subscribeToDraftSync((updatedSummary, updatedDrafts) => {
      setSummary(updatedSummary);
      setDrafts(updatedDrafts);
    });
    return unsub;
  }, []);

  const handleSyncAll = async () => {
    if (!online || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncPendingDrafts();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!online || isSyncing) return;
    setIsSyncing(true);
    try {
      await retryFailedDrafts();
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredDrafts = drafts.filter((d) => {
    if (statusFilter !== 'all' && d.syncStatus !== statusFilter) return false;
    if (networkFilter !== 'all' && d.network.toLowerCase() !== networkFilter.toLowerCase()) return false;
    return true;
  });

  return (
    <div
      className={`bg-[#181d20]/90 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-2xl ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold text-base tracking-tight">
                Transaction Draft Queue
              </h3>
              {online ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Wifi size={11} /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <WifiOff size={11} /> Offline
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs mt-0.5">
              Drafts created offline are stored locally and synced automatically when online.
            </p>
          </div>
        </div>

        {/* Sync Actions */}
        <div className="flex items-center gap-2">
          {summary.failedCount > 0 && (
            <button
              onClick={handleRetryFailed}
              disabled={!online || isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              Retry Failed ({summary.failedCount})
            </button>
          )}

          <button
            onClick={handleSyncAll}
            disabled={!online || isSyncing || !summary.hasPendingSync}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UploadCloud size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing Queue...' : 'Sync Pending'}
          </button>
        </div>
      </div>

      {/* Sync Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
        <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-amber-400" />
            <span className="text-xs text-gray-400">Offline Pending</span>
          </div>
          <span className="text-sm font-semibold text-amber-400">{summary.offlineCount}</span>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="text-sky-400" />
            <span className="text-xs text-gray-400">Syncing</span>
          </div>
          <span className="text-sm font-semibold text-sky-400">{summary.syncingCount}</span>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span className="text-xs text-gray-400">Synced</span>
          </div>
          <span className="text-sm font-semibold text-emerald-400">{summary.syncedCount}</span>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-rose-400" />
            <span className="text-xs text-gray-400">Sync Errors</span>
          </div>
          <span className="text-sm font-semibold text-rose-400">{summary.failedCount}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-gray-400" />
          <span className="text-gray-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#121619] border border-white/10 rounded-lg px-2.5 py-1 text-gray-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Statuses ({drafts.length})</option>
            <option value="draft">Offline Drafts ({summary.offlineCount})</option>
            <option value="synced">Synced ({summary.syncedCount})</option>
            <option value="failed">Failed ({summary.failedCount})</option>
          </select>

          <span className="text-gray-400 ml-2">Network:</span>
          <select
            value={networkFilter}
            onChange={(e) => setNetworkFilter(e.target.value)}
            className="bg-[#121619] border border-white/10 rounded-lg px-2.5 py-1 text-gray-200 focus:outline-none focus:border-cyan-500 uppercase"
          >
            <option value="all">All Networks</option>
            <option value="testnet">Testnet</option>
            <option value="public">Public</option>
            <option value="futurenet">Futurenet</option>
          </select>
        </div>

        {drafts.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all drafts from the queue?')) {
                clearOfflineDrafts();
              }
            }}
            className="text-gray-500 hover:text-rose-400 transition-colors flex items-center gap-1"
          >
            <Trash2 size={12} />
            Clear Queue
          </button>
        )}
      </div>

      {/* Draft List */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {filteredDrafts.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
            <FileText size={28} className="mx-auto text-gray-600 mb-2" />
            <p className="text-gray-400 text-sm font-medium">No transaction drafts found</p>
            <p className="text-gray-600 text-xs mt-1">
              Drafts saved in the Transaction Builder while offline will appear here.
            </p>
          </div>
        ) : (
          filteredDrafts.map((draft) => {
            const opCount = draft.snapshot?.operations?.length || 0;
            return (
              <div
                key={draft.id}
                className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm truncate">{draft.name}</span>
                    <SyncStatusIndicator
                      status={draft.syncStatus}
                      error={draft.syncError}
                      lastSyncedAt={draft.lastSyncedAt}
                      size="sm"
                    />
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      {draft.network}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400 flex-wrap">
                    <span>
                      {opCount} {opCount === 1 ? 'operation' : 'operations'}
                    </span>
                    {draft.snapshot?.sourceAccount && (
                      <span className="font-mono text-gray-500 truncate max-w-[140px]">
                        {draft.snapshot.sourceAccount.slice(0, 6)}...{draft.snapshot.sourceAccount.slice(-4)}
                      </span>
                    )}
                    <span>Updated {new Date(draft.updatedAt).toLocaleTimeString()}</span>
                  </div>

                  {draft.syncError && (
                    <div className="mt-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                      <AlertTriangle size={12} className="shrink-0" />
                      <span className="truncate">{draft.syncError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {onSelectDraft && (
                    <button
                      onClick={() => onSelectDraft(draft)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-xs font-medium transition-colors"
                      title="Load this draft into the Transaction Builder"
                    >
                      Load <ArrowRight size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteOfflineDraft(draft.id)}
                    className="p-1.5 text-gray-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-white/5"
                    title="Delete draft"
                    aria-label="Delete draft"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OfflineDraftQueue;
