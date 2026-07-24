/**
 * Time Travel Debugger Component - D-025
 * UI for state history navigation, diff visualization, and analytics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTimeTravel, StateSnapshot, StateDiff } from '../../lib/state/timeTravel';

interface TimeTravelDebuggerProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: unknown;
  onStateRestore: (state: unknown) => void;
}

export function TimeTravelDebugger({ isOpen, onClose, currentState, onStateRestore }: TimeTravelDebuggerProps) {
  const { history, currentIndex, undo, redo, goToIndex, clearHistory, getAnalytics, getDiff, exportHistory } = useTimeTravel();
  const [selectedDiffIndex, setSelectedDiffIndex] = useState<number | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const handleUndo = useCallback(() => {
    const state = undo();
    if (state !== null) {
      onStateRestore(state);
    }
  }, [undo, onStateRestore]);

  const handleRedo = useCallback(() => {
    const state = redo();
    if (state !== null) {
      onStateRestore(state);
    }
  }, [redo, onStateRestore]);

  const handleGoToIndex = useCallback((index: number) => {
    const state = goToIndex(index);
    if (state !== null) {
      onStateRestore(state);
      setSelectedDiffIndex(index);
    }
  }, [goToIndex, onStateRestore]);

  const handleExport = useCallback(() => {
    const data = exportHistory();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `state-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportHistory]);

  const diffs = selectedDiffIndex !== null && currentIndex !== selectedDiffIndex
    ? getDiff(Math.min(selectedDiffIndex, currentIndex), Math.max(selectedDiffIndex, currentIndex))
    : [];

  const analytics = getAnalytics();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1318] border border-[#1e2d3d] rounded-lg w-full max-w-6xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1e2d3d]">
          <h2 className="text-xl font-bold text-[#e8f4f8]">Time Travel Debugger</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="px-3 py-1 bg-[#1a2530] text-[#e8f4f8] rounded hover:bg-[#2a3f55] transition"
            >
              {showAnalytics ? 'Hide' : 'Show'} Analytics
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1 bg-[#1a2530] text-[#e8f4f8] rounded hover:bg-[#2a3f55] transition"
            >
              Export
            </button>
            <button
              onClick={clearHistory}
              className="px-3 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition"
            >
              Clear History
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-[#1a2530] text-[#e8f4f8] rounded hover:bg-[#2a3f55] transition"
            >
              Close
            </button>
          </div>
        </div>

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="p-4 border-b border-[#1e2d3d] bg-[#0f1820]">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-[#7a9bb0] text-sm">Total Changes</div>
                <div className="text-2xl font-bold text-[#e8f4f8]">{analytics.totalChanges}</div>
              </div>
              <div>
                <div className="text-[#7a9bb0] text-sm">Avg State Size</div>
                <div className="text-2xl font-bold text-[#00e5ff]">{Math.round(analytics.averageStateSize / 1024)} KB</div>
              </div>
              <div>
                <div className="text-[#7a9bb0] text-sm">Current Index</div>
                <div className="text-2xl font-bold text-[#e8f4f8]">{currentIndex + 1} / {history.length}</div>
              </div>
              <div>
                <div className="text-[#7a9bb0] text-sm">Time Range</div>
                <div className="text-sm text-[#e8f4f8]">
                  {analytics.timeRange ? `${Math.round((analytics.timeRange.end - analytics.timeRange.start) / 1000)}s` : 'N/A'}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[#7a9bb0] text-sm mb-2">Change Frequency</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(analytics.changeFrequency).map(([action, count]) => (
                  <span key={action} className="bg-[#1a2530] px-2 py-1 rounded text-sm text-[#e8f4f8]">
                    {action}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4 p-4 border-b border-[#1e2d3d] bg-[#0f1820]">
          <button
            onClick={handleUndo}
            disabled={currentIndex <= 0}
            className="px-4 py-2 bg-[#1a2530] text-[#e8f4f8] rounded hover:bg-[#2a3f55] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <span>←</span> Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={currentIndex >= history.length - 1}
            className="px-4 py-2 bg-[#1a2530] text-[#e8f4f8] rounded hover:bg-[#2a3f55] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            Redo <span>→</span>
          </button>
          <div className="flex-1" />
          <div className="text-[#7a9bb0] text-sm">
            {history.length > 0 && (
              <span>Snapshot: {currentIndex >= 0 ? new Date(history[currentIndex].timestamp).toLocaleTimeString() : 'None'}</span>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* History Timeline */}
          <div className="w-1/3 border-r border-[#1e2d3d] overflow-auto p-4">
            <h3 className="text-lg font-semibold text-[#e8f4f8] mb-4">History</h3>
            <div className="space-y-2">
              {history.map((snapshot, index) => (
                <button
                  key={snapshot.id}
                  onClick={() => handleGoToIndex(index)}
                  className={`w-full text-left p-3 rounded border transition ${
                    index === currentIndex
                      ? 'bg-[#00e5ff]/20 border-[#00e5ff] text-[#00e5ff]'
                      : 'bg-[#0f1820] border-[#1e2d3d] text-[#e8f4f8] hover:border-[#2a3f55]'
                  }`}
                >
                  <div className="font-medium">{snapshot.action}</div>
                  <div className="text-xs text-[#7a9bb0] mt-1">
                    {new Date(snapshot.timestamp).toLocaleTimeString()}
                  </div>
                  {snapshot.metadata && Object.keys(snapshot.metadata).length > 0 && (
                    <div className="text-xs text-[#7a9bb0] mt-1">
                      {Object.entries(snapshot.metadata).map(([k, v]) => (
                        <span key={k} className="mr-2">{k}: {String(v)}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Diff Viewer */}
          <div className="flex-1 overflow-auto p-4">
            <h3 className="text-lg font-semibold text-[#e8f4f8] mb-4">
              State Diff {selectedDiffIndex !== null && `(vs index ${selectedDiffIndex})`}
            </h3>
            {diffs.length === 0 ? (
              <div className="text-center text-[#7a9bb0] py-8">
                {selectedDiffIndex === null ? 'Select a history entry to compare' : 'No differences found'}
              </div>
            ) : (
              <div className="space-y-2">
                {diffs.map((diff, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded border ${
                      diff.type === 'added' ? 'bg-green-900/20 border-green-700' :
                      diff.type === 'removed' ? 'bg-red-900/20 border-red-700' :
                      'bg-yellow-900/20 border-yellow-700'
                    }`}
                  >
                    <div className="font-mono text-sm text-[#e8f4f8]">{diff.path}</div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <div className="text-xs text-[#7a9bb0]">Old</div>
                        <pre className="text-sm text-red-400 overflow-x-auto">
                          {JSON.stringify(diff.oldValue, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs text-[#7a9bb0]">New</div>
                        <pre className="text-sm text-green-400 overflow-x-auto">
                          {JSON.stringify(diff.newValue, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
