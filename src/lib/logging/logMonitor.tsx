/**
 * Log Monitor Component - D-026
 * Real-time log viewer with filtering and analytics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { logger, LogEntry, LogLevel, LogFilter } from './logger';

interface LogMonitorProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function LogMonitor({ isOpen = false, onClose }: LogMonitorProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>({});
  const [autoScroll, setAutoScroll] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = logger.subscribe((entry) => {
      setLogs(prev => [...prev, entry]);
    });

    // Load existing logs
    setLogs(logger.getLogs());

    return unsubscribe;
  }, [isOpen]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logger.getLogs(filter);

  const handleExport = useCallback(() => {
    const data = logger.exportLogs(filter);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filter]);

  const handleClear = useCallback(() => {
    logger.clear();
    setLogs([]);
  }, []);

  const levelColors = {
    [LogLevel.DEBUG]: 'text-gray-400',
    [LogLevel.INFO]: 'text-blue-400',
    [LogLevel.WARN]: 'text-yellow-400',
    [LogLevel.ERROR]: 'text-red-400',
    [LogLevel.CRITICAL]: 'text-red-600',
  };

  const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];

  if (!isOpen) return null;

  const analytics = logger.getAnalytics();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1318] border border-[#1e2d3d] rounded-lg w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1e2d3d]">
          <h2 className="text-xl font-bold text-[#e8f4f8]">Log Monitor</h2>
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
              onClick={handleClear}
              className="px-3 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition"
            >
              Clear
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
                <div className="text-[#7a9bb0] text-sm">Total Logs</div>
                <div className="text-2xl font-bold text-[#e8f4f8]">{analytics.total}</div>
              </div>
              <div>
                <div className="text-[#7a9bb0] text-sm">Errors</div>
                <div className="text-2xl font-bold text-red-400">
                  {analytics.byLevel[LogLevel.ERROR] + analytics.byLevel[LogLevel.CRITICAL]}
                </div>
              </div>
              <div>
                <div className="text-[#7a9bb0] text-sm">Warnings</div>
                <div className="text-2xl font-bold text-yellow-400">{analytics.byLevel[LogLevel.WARN]}</div>
              </div>
              <div>
                <div className="text-[#7a9bb0] text-sm">Time Range</div>
                <div className="text-sm text-[#e8f4f8]">
                  {analytics.timeRange ? `${new Date(analytics.timeRange.start).toLocaleTimeString()} - ${new Date(analytics.timeRange.end).toLocaleTimeString()}` : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 border-b border-[#1e2d3d] bg-[#0f1820]">
          <select
            value={filter.level ?? ''}
            onChange={(e) => setFilter(f => ({ ...f, level: e.target.value ? Number(e.target.value) : undefined }))}
            className="bg-[#1a2530] text-[#e8f4f8] px-3 py-1 rounded border border-[#1e2d3d]"
          >
            <option value="">All Levels</option>
            {levelNames.map((name, i) => (
              <option key={name} value={i}>{name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search logs..."
            value={filter.search ?? ''}
            onChange={(e) => setFilter(f => ({ ...f, search: e.target.value || undefined }))}
            className="bg-[#1a2530] text-[#e8f4f8] px-3 py-1 rounded border border-[#1e2d3d] flex-1"
          />
          <label className="flex items-center gap-2 text-[#e8f4f8]">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
        </div>

        {/* Log Entries */}
        <div ref={logContainerRef} className="flex-1 overflow-auto p-4 font-mono text-sm">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-[#7a9bb0] py-8">No logs to display</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="mb-2 p-2 bg-[#0f1820] rounded border-l-2 border-[#1e2d3d] hover:border-[#00e5ff] transition">
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${levelColors[log.level]}`}>[{levelNames[log.level]}]</span>
                  <span className="text-[#7a9bb0] text-xs">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  {log.correlationId && (
                    <span className="text-[#00e5ff] text-xs">[{log.correlationId}]</span>
                  )}
                  {log.tags && log.tags.map(tag => (
                    <span key={tag} className="text-xs bg-[#1a2530] px-1 rounded text-[#7a9bb0]">#{tag}</span>
                  ))}
                </div>
                <div className="text-[#e8f4f8] mt-1">{log.message}</div>
                {log.context && Object.keys(log.context).length > 0 && (
                  <pre className="text-[#7a9bb0] text-xs mt-1 overflow-x-auto">
                    {JSON.stringify(log.context, null, 2)}
                  </pre>
                )}
                {log.stack && (
                  <pre className="text-red-400 text-xs mt-1 overflow-x-auto">
                    {log.stack}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
