/**
 * Import Dialog Component
 * Handles file upload, preview, validation, and import
 */

import React, { useState, useCallback, useRef } from 'react';
import './ImportDialog.css';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPreview: (file: File, format: string) => Promise<any>;
  onImport: (file: File, format: string, schema?: any) => Promise<any>;
  supportedFormats?: string[];
}

export function ImportDialog({
  isOpen,
  onClose,
  onPreview,
  onImport,
  supportedFormats = ['json', 'csv', 'xml', 'parquet'],
}: ImportDialogProps) {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState('json');
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('upload'); // upload, preview, confirm
  const [skipErrors, setSkipErrors] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback(
    async (selectedFile) => {
      setFile(selectedFile);
      setError(null);

      // Auto-detect format from filename
      const extension = selectedFile.name.split('.').pop().toLowerCase();
      if (supportedFormats.includes(extension)) {
        setFormat(extension);
      }

      // Generate preview
      setIsLoading(true);
      try {
        const previewData = await onPreview(selectedFile, format);
        setPreview(previewData);
        setStep('preview');
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [format, onPreview, supportedFormats]
  );

  const handleImport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await onImport(file, format, {}, skipErrors);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [file, format, skipErrors, onImport, onClose]);

  if (!isOpen) return null;

  return (
    <div className="import-dialog-overlay">
      <div className="import-dialog">
        <div className="import-dialog-header">
          <h2>Import Data</h2>
          <button
            className="import-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="import-dialog-content">
          {error && (
            <div className="import-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="import-upload-section">
              <div className="import-upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) =>
                    e.target.files && handleFileSelect(e.target.files[0])
                  }
                  style={{ display: 'none' }}
                  accept={supportedFormats.map((f) => `.${f}`).join(',')}
                />

                <button
                  className="import-upload-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <span className="import-upload-icon">📁</span>
                  <span>Select File to Import</span>
                </button>

                <p>Supported formats: {supportedFormats.join(', ').toUpperCase()}</p>
              </div>

              <div className="import-format-selector">
                <label htmlFor="import-format">Or specify format:</label>
                <select
                  id="import-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  {supportedFormats.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {fmt.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="import-preview-section">
              <div className="import-preview-info">
                <p>
                  <strong>File:</strong> {preview.filename}
                </p>
                <p>
                  <strong>Rows:</strong> {preview.rowCount}
                </p>
                <p>
                  <strong>Columns:</strong> {preview.columnCount}
                </p>
                <p>
                  <strong>Size:</strong> {formatBytes(preview.fileSize)}
                </p>
              </div>

              <div className="import-preview-columns">
                <strong>Columns:</strong>
                <div className="import-column-list">
                  {preview.columns.map((col) => (
                    <span key={col} className="import-column-tag">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              <div className="import-preview-sample">
                <strong>Sample Data:</strong>
                <div className="import-sample-table">
                  <table>
                    <thead>
                      <tr>
                        {preview.columns.slice(0, 5).map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row, idx) => (
                        <tr key={idx}>
                          {preview.columns.slice(0, 5).map((col) => (
                            <td key={col}>{String(row[col] || '').slice(0, 50)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="import-options">
                <label>
                  <input
                    type="checkbox"
                    checked={skipErrors}
                    onChange={(e) => setSkipErrors(e.target.checked)}
                  />
                  Skip rows with errors
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="import-dialog-footer">
          {step === 'preview' && (
            <button
              className="import-button-back"
              onClick={() => setStep('upload')}
              disabled={isLoading}
            >
              Back
            </button>
          )}

          <button
            className="import-button-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>

          {step === 'upload' && (
            <button
              className="import-button-next"
              onClick={() => {
                if (!file) setError('Please select a file');
              }}
              disabled={!file || isLoading}
            >
              Next
            </button>
          )}

          {step === 'preview' && (
            <button
              className="import-button-primary"
              onClick={handleImport}
              disabled={isLoading}
            >
              {isLoading ? 'Importing...' : 'Import'}
            </button>
          )}
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
