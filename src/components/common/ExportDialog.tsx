/**
 * Export Dialog Component
 * Handles data export with format selection, transformations, and scheduling
 */

import React, { useState, useCallback } from 'react';
import './ExportDialog.css';

interface ExportDialogProps {
  isOpen: boolean;
  data: any[];
  onClose: () => void;
  onExport: (data: any[], format: string, filename: string) => Promise<void>;
  onSchedule?: (name: string, format: string, schedule: any) => void;
  defaultFilename?: string;
}

export function ExportDialog({
  isOpen,
  data,
  onClose,
  onExport,
  onSchedule,
  defaultFilename = 'export',
}: ExportDialogProps) {
  const [format, setFormat] = useState('json');
  const [filename, setFilename] = useState(defaultFilename);
  const [isExporting, setIsExporting] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [cronExpression, setCronExpression] = useState('0 0 * * *'); // Daily

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await onExport(data, format, filename);
    } finally {
      setIsExporting(false);
    }
  }, [data, format, filename, onExport]);

  const handleSchedule = useCallback(() => {
    if (onSchedule) {
      onSchedule(filename, format, { expression: cronExpression });
      setShowSchedule(false);
    }
  }, [filename, format, cronExpression, onSchedule]);

  if (!isOpen) return null;

  return (
    <div className="export-dialog-overlay">
      <div className="export-dialog">
        <div className="export-dialog-header">
          <h2>Export Data</h2>
          <button
            className="export-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="export-dialog-content">
          <div className="export-form-group">
            <label htmlFor="export-format">Format</label>
            <select
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="xml">XML</option>
              <option value="parquet">Parquet</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          <div className="export-form-group">
            <label htmlFor="export-filename">Filename</label>
            <input
              id="export-filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Enter filename"
            />
            <small>.{format} will be added automatically</small>
          </div>

          <div className="export-info">
            <p>
              Records to export: <strong>{data.length}</strong>
            </p>
            <p>
              Estimated size:{' '}
              <strong>{formatBytes(JSON.stringify(data).length)}</strong>
            </p>
          </div>

          {onSchedule && (
            <div className="export-schedule-section">
              <button
                className="export-toggle-schedule"
                onClick={() => setShowSchedule(!showSchedule)}
              >
                {showSchedule ? '▼' : '▶'} Schedule Regular Exports
              </button>

              {showSchedule && (
                <div className="export-schedule-form">
                  <label htmlFor="cron-expression">Cron Expression</label>
                  <input
                    id="cron-expression"
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 0 * * * (daily at midnight)"
                  />
                  <small>Format: minute hour day month dayOfWeek</small>
                  <button
                    className="export-schedule-button"
                    onClick={handleSchedule}
                    disabled={isExporting}
                  >
                    Create Scheduled Job
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="export-dialog-footer">
          <button
            className="export-button-cancel"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            className="export-button-primary"
            onClick={handleExport}
            disabled={isExporting || !filename.trim()}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
