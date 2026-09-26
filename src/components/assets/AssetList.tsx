import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import AssetCard from './AssetCard';
import { ResponsiveGrid } from '../layout/ResponsiveContainer';

export default function AssetList({ 
  assets, 
  loading, 
  hasMore, 
  onLoadMore, 
  network,
  emptyMessage = "No assets found"
}) {
  const { isMobile } = useResponsive();

  if (loading && assets.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
        <div style={{
          color: 'var(--text-secondary)',
          fontSize: '14px'
        }}>
          Loading assets...
        </div>
      </div>
    );
  }

  if (!loading && assets.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        flexDirection: 'column',
        gap: '16px',
        textAlign: 'center',
        padding: '40px 20px'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '8px'
        }}>
          🔍
        </div>
        <div style={{
          fontSize: isMobile ? '16px' : '18px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px'
        }}>
          {emptyMessage}
        </div>
        <div style={{
          color: 'var(--text-secondary)',
          fontSize: '14px',
          maxWidth: '400px',
          lineHeight: 1.5
        }}>
          Try adjusting your search terms or filters to find more assets.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Asset Grid */}
      <ResponsiveGrid
        columns={{ mobile: 1, tablet: 2, desktop: 3 }}
        gap={{ mobile: '16px', tablet: '20px', desktop: '24px' }}
        style={{ marginBottom: hasMore ? '32px' : '0' }}
      >
        {assets.map((asset, index) => (
          <AssetCard
            key={`${asset.code}-${asset.issuer}-${index}`}
            asset={asset}
            network={network}
          />
        ))}
      </ResponsiveGrid>

      {/* Load More Button */}
      {hasMore && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px'
        }}>
          <button
            onClick={onLoadMore}
            disabled={loading}
            style={{
              padding: isMobile ? '12px 24px' : '10px 20px',
              background: loading ? 'var(--bg-hover)' : 'var(--cyan)',
              color: loading ? 'var(--text-muted)' : 'var(--bg-base)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'var(--transition)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: isMobile ? 'var(--touch-target)' : 'auto',
              fontFamily: 'var(--font-mono)'
            }}
            onMouseEnter={e => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--cyan-dim)'
              }
            }}
            onMouseLeave={e => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--cyan)'
              }
            }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px' }} />
                Loading...
              </>
            ) : (
              <>
                📄 Load More Assets
              </>
            )}
          </button>
        </div>
      )}

      {/* Results Count */}
      <div style={{
        textAlign: 'center',
        marginTop: '24px',
        fontSize: '12px',
        color: 'var(--text-muted)'
      }}>
        Showing {assets.length} asset{assets.length !== 1 ? 's' : ''}
        {hasMore && ' (more available)'}
      </div>
    </div>
  );
}