import React, { useState } from 'react';
import { Download, RefreshCw, Trash2, Wifi, WifiOff, HardDrive, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useDocsCache } from '../../hooks/useDocsCache';

export default function DocsCacheManager() {
  const {
    isCached,
    isUpdating,
    lastUpdated,
    error,
    cachedDocs,
    cacheDocs,
    clearDocsCache,
    updateDocsCache,
    checkCacheStatus,
  } = useDocsCache();

  const [showDetails, setShowDetails] = useState(false);

  const handleUpdateCache = async () => {
    await updateDocsCache();
  };

  const handleClearCache = async () => {
    if (window.confirm('Are you sure you want to clear all cached documentation? This will make docs unavailable offline.')) {
      await clearDocsCache();
    }
  };

  const handleRefreshStatus = async () => {
    await checkCacheStatus();
  };

  const calculateCacheSize = () => {
    const totalSize = cachedDocs.reduce((sum, doc) => sum + doc.size, 0);
    if (totalSize < 1024) return `${totalSize} B`;
    if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`;
    return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Status Banner */}
      <div
        style={{
          padding: '16px',
          background: isCached ? 'var(--cyan-glow-sm)' : 'var(--bg-elevated)',
          border: `1px solid ${isCached ? 'var(--cyan-dim)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {isCached ? (
          <Wifi size={24} style={{ color: 'var(--cyan)' }} />
        ) : (
          <WifiOff size={24} style={{ color: 'var(--amber)' }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {isCached ? 'Documentation Cached for Offline Use' : 'Documentation Not Cached'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {isCached
              ? `Last updated: ${lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Unknown'}`
              : 'Cache documentation to access it offline'}
          </div>
        </div>
        {isCached && (
          <button
            onClick={handleRefreshStatus}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--red-glow-sm)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertCircle size={18} style={{ color: 'var(--red)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleUpdateCache}
          disabled={isUpdating}
          style={{
            padding: '10px 16px',
            background: isUpdating ? 'var(--bg-elevated)' : 'var(--cyan)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: isUpdating ? 'var(--text-muted)' : 'white',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isUpdating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Download size={16} />
          <span>{isUpdating ? 'Updating...' : 'Update Cache'}</span>
        </button>

        {isCached && (
          <button
            onClick={handleClearCache}
            style={{
              padding: '10px 16px',
              background: 'var(--red-glow-sm)',
              border: '1px solid var(--red)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--red)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Trash2 size={16} />
            <span>Clear Cache</span>
          </button>
        )}

        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            padding: '10px 16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <HardDrive size={16} />
          <span>{showDetails ? 'Hide Details' : 'Show Details'}</span>
        </button>
      </div>

      {/* Cache Details */}
      {showDetails && isCached && (
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Cache Statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div
              style={{
                padding: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Documents</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {cachedDocs.length}
              </div>
            </div>
            <div
              style={{
                padding: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Cache Size</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {calculateCacheSize()}
              </div>
            </div>
            <div
              style={{
                padding: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Last Updated</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {lastUpdated ? new Date(lastUpdated).toLocaleDateString() : 'Unknown'}
              </div>
            </div>
          </div>

          {/* Cached Documents List */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Cached Documents
            </div>
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {cachedDocs.map((doc, index) => (
                <div
                  key={index}
                  style={{
                    padding: '10px 12px',
                    borderBottom: index < cachedDocs.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.url}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} />
                        {doc.timestamp ? new Date(doc.timestamp).toLocaleString() : 'Unknown'}
                      </span>
                      <span>{doc.size > 0 ? `${(doc.size / 1024).toFixed(1)} KB` : 'Unknown size'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}