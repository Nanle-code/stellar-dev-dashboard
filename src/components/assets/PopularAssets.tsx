import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import AssetCard from './AssetCard';
import { ResponsiveGrid } from '../layout/ResponsiveContainer';

export default function PopularAssets({ assets, network }) {
  const { isMobile } = useResponsive();

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: '24px',
        textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: isMobile ? '20px' : '24px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px',
          fontFamily: 'var(--font-display)'
        }}>
          🌟 Popular Assets
        </h2>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '14px',
          maxWidth: '600px',
          margin: '0 auto',
          lineHeight: 1.5
        }}>
          Curated list of well-established and widely-used assets on the Stellar network.
          These assets have been verified and are commonly used in the ecosystem.
        </p>
      </div>

      {/* Featured Assets Grid */}
      <ResponsiveGrid
        columns={{ mobile: 1, tablet: 2, desktop: 3 }}
        gap={{ mobile: '16px', tablet: '20px', desktop: '24px' }}
      >
        {assets.map((asset, index) => (
          <div key={`${asset.code}-${asset.issuer}`} className={`animate-in-delay-${Math.min(index + 1, 5)}`}>
            <AssetCard
              asset={asset}
              network={network}
            />
          </div>
        ))}
      </ResponsiveGrid>

      {/* Info Cards */}
      <div style={{
        marginTop: '40px',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {/* Verification Info */}
        <div style={{
          background: 'var(--green-glow)',
          border: '1px solid var(--green)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>✅</span>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--green)',
              margin: 0
            }}>
              Verified Assets
            </h3>
          </div>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: 0
          }}>
            All popular assets shown here have been verified through domain validation 
            or manual review. They have established stellar.toml files and proven track records.
          </p>
        </div>

        {/* Safety Info */}
        <div style={{
          background: 'var(--amber-glow)',
          border: '1px solid var(--amber)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>🛡️</span>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--amber)',
              margin: 0
            }}>
              Safety First
            </h3>
          </div>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: 0
          }}>
            Always verify asset details and issuer information before creating trustlines. 
            Check for authorization flags and understand the risks involved.
          </p>
        </div>

        {/* Community Info */}
        <div style={{
          background: 'var(--cyan-glow)',
          border: '1px solid var(--cyan)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>🌐</span>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--cyan)',
              margin: 0
            }}>
              Community Driven
            </h3>
          </div>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            margin: 0
          }}>
            These assets are widely adopted by the Stellar community and have active 
            trading pairs on decentralized exchanges and market makers.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '12px'
        }}>
          Want to explore more assets?
        </h3>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '16px',
          lineHeight: 1.5
        }}>
          Browse all available assets, use advanced filters, or get personalized recommendations.
        </p>
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => {
              // This would be handled by parent component
              const event = new CustomEvent('changeTab', { detail: 'all' });
              window.dispatchEvent(event);
            }}
            style={{
              padding: '10px 20px',
              background: 'var(--cyan)',
              color: 'var(--bg-base)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition)',
              fontFamily: 'var(--font-mono)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--cyan-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--cyan)'}
          >
            📋 Browse All Assets
          </button>
          <button
            onClick={() => {
              const event = new CustomEvent('changeTab', { detail: 'recommendations' });
              window.dispatchEvent(event);
            }}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition)',
              fontFamily: 'var(--font-mono)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-elevated)'
              e.currentTarget.style.borderColor = 'var(--cyan)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            💡 Get Recommendations
          </button>
        </div>
      </div>
    </div>
  );
}