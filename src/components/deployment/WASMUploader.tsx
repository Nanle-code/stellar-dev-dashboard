import React, { useMemo, useRef, useState } from 'react';
import { MAX_WASM_BYTES, WASMProcessor } from '../../lib/deployment/WASMProcessor';
import { analyzeWasmSize, formatSize, getSeverityColor, getSeverityIcon } from '../../lib/wasmOptimization';

const DEFAULT_MAX_BYTES = MAX_WASM_BYTES;

export default function WASMUploader({
  onFile,
  onError,
  file,
  maxSizeBytes = DEFAULT_MAX_BYTES,
}) {
  const inputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [showOptimizationTips, setShowOptimizationTips] = useState(false);

  const maxSizeMb = useMemo(() => (maxSizeBytes / (1024 * 1024)).toFixed(0), [maxSizeBytes]);
  
  const sizeAnalysis = useMemo(() => {
    if (!file) return null;
    return analyzeWasmSize(file.sizeBytes);
  }, [file]);

  const emitError = (message) => {
    setLocalError(message);
    onError?.(message);
    onFile?.(null);
  };

  const processFile = async (selectedFile) => {
    if (!selectedFile) {
      onFile?.(null);
      return;
    }

    setIsLoading(true);
    setLocalError(null);

    try {
      if (!selectedFile.name.endsWith('.wasm') && selectedFile.type !== 'application/wasm') {
        throw new Error('Please select a compiled Soroban WASM file (.wasm)');
      }

      const metadata = await WASMProcessor.inspectFile(selectedFile);

      if (metadata.sizeBytes > maxSizeBytes) {
        throw new Error(
          `WASM file is too large (${metadata.sizeMb.toFixed(2)} MB). The helper supports files up to ${maxSizeMb} MB.`
        );
      }

      onFile?.({
        file: selectedFile,
        bytes: metadata.bytes,
        sizeBytes: metadata.sizeBytes,
        sizeKb: metadata.sizeKb,
        sizeMb: metadata.sizeMb,
        checksum: metadata.artifactHash,
        mimeType: metadata.mimeType,
        lastModified: metadata.lastModified,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to process WASM file';
      emitError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files?.[0] || null;
    await processFile(selectedFile);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    const selectedFile = event.dataTransfer.files?.[0] || null;
    await processFile(selectedFile);
  };

  const displayError = localError || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={() => setIsDragging(true)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '22px',
          border: `2px dashed ${
            displayError ? 'var(--red)' : file ? 'var(--green)' : isDragging ? 'var(--cyan)' : 'var(--border-bright)'
          }`,
          borderRadius: 'var(--radius-lg)',
          background: displayError
            ? 'rgba(220, 38, 38, 0.08)'
            : file
              ? 'rgba(34, 197, 94, 0.08)'
              : isDragging
                ? 'rgba(34, 211, 238, 0.08)'
                : 'var(--bg-elevated)',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'all var(--transition)',
          opacity: isLoading ? 0.75 : 1,
          alignItems: 'center',
          textAlign: 'center',
          minHeight: '180px',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '30px' }}>📦</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            {file
              ? `Uploaded ${file.file.name}`
              : isLoading
                ? 'Inspecting WASM...'
                : 'Drop a WASM file here or click to browse'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Supports large Soroban artifacts up to {maxSizeMb} MB
          </div>
        </div>

        {file && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '8px',
              width: '100%',
              marginTop: '4px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Size
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '4px' }}>
                {file.sizeMb.toFixed(2)} MB
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Checksum
              <div
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  marginTop: '4px',
                  fontFamily: 'var(--font-mono)',
                  wordBreak: 'break-all',
                }}
              >
                {file.checksum.slice(0, 16)}…
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Type
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '4px' }}>
                {file.mimeType}
              </div>
            </div>
            {sizeAnalysis && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Network Limit
                <div
                  style={{
                    color: getSeverityColor(sizeAnalysis.severity),
                    fontWeight: 600,
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {getSeverityIcon(sizeAnalysis.severity)} {sizeAnalysis.percentageOfLimit.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        )}

        {sizeAnalysis && sizeAnalysis.severity !== 'safe' && (
          <div
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '10px',
              background:
                sizeAnalysis.severity === 'exceeded'
                  ? 'rgba(220, 38, 38, 0.1)'
                  : sizeAnalysis.severity === 'critical'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(245, 158, 11, 0.1)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${getSeverityColor(sizeAnalysis.severity)}`,
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: getSeverityColor(sizeAnalysis.severity),
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {getSeverityIcon(sizeAnalysis.severity)} Size{' '}
              {sizeAnalysis.severity === 'exceeded'
                ? 'Exceeded'
                : sizeAnalysis.severity === 'critical'
                  ? 'Warning'
                  : 'Notice'}
            </div>
            {sizeAnalysis.warnings.map((warning, idx) => (
              <div key={idx} style={{ fontSize: '11px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                • {warning}
              </div>
            ))}
            <button
              onClick={() => setShowOptimizationTips(!showOptimizationTips)}
              style={{
                marginTop: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.1)',
                border: `1px solid ${getSeverityColor(sizeAnalysis.severity)}`,
                borderRadius: 'var(--radius-sm)',
                color: getSeverityColor(sizeAnalysis.severity),
                cursor: 'pointer',
              }}
            >
              {showOptimizationTips ? 'Hide' : 'Show'} Optimization Tips
            </button>
          </div>
        )}

        {showOptimizationTips && sizeAnalysis && (
          <div
            style={{
              width: '100%',
              marginTop: '8px',
              padding: '12px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-bright)',
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
              Optimization Tips ({sizeAnalysis.optimizationTips.length})
            </div>
            {sizeAnalysis.optimizationTips.map((tip, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px',
                  marginBottom: '8px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background:
                        tip.impact === 'high'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : tip.impact === 'medium'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(107, 114, 128, 0.2)',
                      color:
                        tip.impact === 'high'
                          ? '#22c55e'
                          : tip.impact === 'medium'
                            ? '#f59e0b'
                            : '#6b7280',
                      fontWeight: 600,
                    }}
                  >
                    {tip.impact.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {tip.category.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {tip.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {tip.description}
                </div>
                {tip.command && (
                  <div
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {tip.command}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".wasm,application/wasm"
          onChange={handleFileChange}
          disabled={isLoading}
          style={{ display: 'none' }}
        />
      </div>

      {displayError && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--red)',
            background: 'rgba(220, 38, 38, 0.1)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            lineHeight: 1.5,
          }}
        >
          {displayError}
        </div>
      )}
    </div>
  );
}
