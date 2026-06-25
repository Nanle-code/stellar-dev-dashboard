/**
 * Example usage of the Data Export/Import system
 * Demonstrates all four implementation steps
 */

import React, { useState } from 'react';
import { useDataExportEnhanced } from '../hooks/useDataExportEnhanced';
import { ExportDialog } from '../components/common/ExportDialog';
import { ImportDialog } from '../components/common/ImportDialog';
import { TransformationBuilder } from '../components/common/TransformationBuilder';
import { ScheduleManager } from '../components/common/ScheduleManager';
import { TRANSFORMATION_TEMPLATES } from '../lib/transformationPipeline';

/**
 * Example: Complete data export/import interface
 */
export function DataExportImportExample() {
  const [data, setData] = useState([
    {
      id: '1',
      date: '2024-01-15',
      amount: 1500.00,
      asset: 'XLM',
      type: 'send',
    },
    {
      id: '2',
      date: '2024-01-16',
      amount: 2500.00,
      asset: 'USDC',
      type: 'receive',
    },
    {
      id: '3',
      date: '2024-01-17',
      amount: 500.00,
      asset: 'XLM',
      type: 'send',
    },
  ]);

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const {
    isExporting,
    exportError,
    exportHistory,
    isImporting,
    importError,
    importSuccess,
    importPreview,
    exportData,
    previewImport,
    importData,
    transformations,
    activeTemplate,
    addTransformation,
    removeTransformation,
    applyTemplate,
    exportJobs,
    scheduleExport,
    updateScheduledJob,
    removeScheduledJob,
  } = useDataExportEnhanced();

  const handleExport = async (dataToExport, format, filename) => {
    try {
      await exportData(dataToExport, format, filename);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleScheduleExport = (name, format, schedule) => {
    scheduleExport(name, format, schedule);
  };

  const handleImport = async (file, format) => {
    try {
      const result = await importData(file, format);
      if (result) {
        setData((prev) => [...prev, ...result.data]);
      }
    } catch (error) {
      console.error('Import failed:', error);
    }
  };

  return (
    <div className="data-export-import-container">
      <h1>Data Export/Import Management</h1>

      {/* Control Panel */}
      <div className="control-panel">
        <button
          className="btn btn-primary"
          onClick={() => setShowExportDialog(true)}
        >
          📤 Export Data
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setShowImportDialog(true)}
        >
          📥 Import Data
        </button>
      </div>

      {/* Status Messages */}
      {exportError && (
        <div className="alert alert-error">
          <strong>Export Error:</strong> {exportError}
        </div>
      )}
      {importError && (
        <div className="alert alert-error">
          <strong>Import Error:</strong> {importError}
        </div>
      )}
      {importSuccess && (
        <div className="alert alert-success">
          Data imported successfully!
        </div>
      )}

      {/* Step 1: Export Formats - Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        data={data}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        onSchedule={handleScheduleExport}
        defaultFilename="stellar-export"
      />

      {/* Step 2: Transformation Pipeline */}
      <div className="section">
        <TransformationBuilder
          transformations={transformations}
          templates={Object.values(TRANSFORMATION_TEMPLATES)}
          onAddRule={addTransformation}
          onRemoveRule={removeTransformation}
          onApplyTemplate={applyTemplate}
        />
      </div>

      {/* Step 3: Scheduling */}
      <div className="section">
        <ScheduleManager
          jobs={exportJobs}
          onAddJob={scheduleExport}
          onUpdateJob={updateScheduledJob}
          onRemoveJob={removeScheduledJob}
          history={exportHistory}
        />
      </div>

      {/* Step 4: Import Dialog with Preview */}
      <ImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onPreview={previewImport}
        onImport={handleImport}
        supportedFormats={['json', 'csv', 'xml', 'parquet']}
      />

      {/* Data Preview */}
      <div className="section">
        <h2>Current Data ({data.length} records)</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Asset</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.date}</td>
                <td>${row.amount}</td>
                <td>{row.asset}</td>
                <td>{row.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export History */}
      {exportHistory.length > 0 && (
        <div className="section">
          <h2>Export History</h2>
          <div className="history-list">
            {exportHistory.map((entry) => (
              <div key={entry.id} className="history-entry">
                <span className={`status ${entry.status}`}>
                  {entry.status === 'success' ? '✓' : '✗'}
                </span>
                <span className="filename">{entry.filename}</span>
                <span className="format">{entry.format.toUpperCase()}</span>
                <span className="date">
                  {new Date(entry.exportedAt).toLocaleString()}
                </span>
                <span className="size">
                  {formatBytes(entry.fileSize)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Step 1: Export Formats
 * Example: Exporting data in different formats
 */
export async function exampleExportFormats() {
  const { exportData } = useDataExportEnhanced();

  const data = [
    { name: 'Alice', balance: 1000, asset: 'XLM' },
    { name: 'Bob', balance: 2000, asset: 'USDC' },
  ];

  // CSV Export
  await exportData(data, 'csv', 'balances');

  // JSON Export
  await exportData(data, 'json', 'balances');

  // XML Export
  await exportData(data, 'xml', 'balances');

  // Parquet Export
  await exportData(data, 'parquet', 'balances');

  // PDF Export
  await exportData(data, 'pdf', 'balances');
}

/**
 * Step 2: Transformation Pipeline
 * Example: Building custom transformation rules
 */
export function exampleTransformationPipeline() {
  const { addTransformation, applyTemplate } = useDataExportEnhanced();

  // Add filter rule
  addTransformation({
    id: 'filter_large',
    name: 'Large Transactions',
    type: 'filter',
    config: {
      field: 'amount',
      operator: 'greaterThan',
      value: 1000,
    },
    order: 0,
    enabled: true,
  });

  // Add map rule
  addTransformation({
    id: 'map_fields',
    name: 'Rename Fields',
    type: 'map',
    config: {
      operations: [
        { type: 'rename', field: 'amount', newField: 'value' },
        { type: 'add', field: 'processed', value: true },
      ],
    },
    order: 1,
    enabled: true,
  });

  // Apply template
  applyTemplate(TRANSFORMATION_TEMPLATES.anonymize);
}

/**
 * Step 3: Scheduling
 * Example: Creating scheduled export jobs
 */
export function exampleScheduling() {
  const { scheduleExport } = useDataExportEnhanced();

  // Daily export at midnight
  scheduleExport('Daily Backup', 'json', {
    expression: '0 0 * * *', // Daily at midnight
    timezone: 'UTC',
    retryOnFailure: true,
    maxRetries: 3,
  });

  // Weekly export on Sundays at 10 AM
  scheduleExport('Weekly Report', 'csv', {
    expression: '0 10 * * 0', // Sunday at 10 AM
    timezone: 'America/New_York',
  });

  // Hourly export
  scheduleExport('Hourly Sync', 'parquet', {
    expression: '0 * * * *', // Every hour at :00
  });
}

/**
 * Step 4: Import with Validation
 * Example: Importing data with preview and validation
 */
export async function exampleImport() {
  const { previewImport, importData } = useDataExportEnhanced();

  // Get file from user
  const input = document.createElement('input');
  input.type = 'file';

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];

    // Preview before import
    const preview = await previewImport(file, 'json');
    console.log('Preview:', preview);

    // Define validation schema
    const schema = {
      amount: {
        type: 'number',
        required: true,
        min: 0,
      },
      asset: {
        type: 'string',
        required: true,
        enum: ['XLM', 'USDC', 'EUR'],
      },
      date: {
        type: 'string',
        required: true,
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      },
    };

    // Import with validation
    const result = await importData(file, 'json', schema);
    console.log('Import result:', result);
  });

  input.click();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
