import React, { useState, useEffect } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { fetchIssuerInfo, fetchAssetMarketData, formatXLM, shortAddress } from '../../lib/stellar';
import { getAssetTrustlineStatus } from '../../lib/assetTrustlineValidation';
import CopyableValue from '../dashboard/CopyableValue';
import AssetTrustStatus from './AssetTrustStatus';

export default function AssetCard({ asset, network, onClick }) {
  const [issuerInfo, setIssuerInfo] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { isMobile } = useResponsive();
  const { handleError } = useErrorHandler('AssetCard');
  const trustStatus = getAssetTrustlineStatus({ issuer: asset.issuer, flags: asset.flags });

  useEffect(() => {
    loadAssetDetails();
  }, [asset.issuer, network]);

  const loadAssetDetails = async () => {
    if (trustStatus.issuer.state !== 'valid') {
      setIssuerInfo(null);
      setMarketData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load issuer info and market data in parallel
      const [issuer, market] = await Promise.all([
        fetchIssuerInfo(asset.issuer, network),
        fetchAssetMarketData(asset.code, asset.issuer, network)
      ]);
      
      setIssuerInfo(issuer);
      setMarketData(market);
    } catch (error) {
      handleError(error, { assetCode: asset.code, assetIssuer: asset.issuer });
    } finally {
      setLoading(false);
    }
  };

  const getVerificationBadge = () => {
    if (trustStatus.issuer.state === 'missing') {
      return { icon: '⛔', text: 'Missing issuer', color: 'var(--red)' };
    }
    if (trustStatus.issuer.state === 'invalid') {
      return { icon: '⛔', text: 'Invalid issuer', color: 'var(--red)' };
    }
    if (asset.is_verified || issuerInfo?.verification_level === 'domain') {
      return {
        icon: '✅',
        text: 'Verified',
        color: 'var(--green)'
      };
    }
    return {
      icon: '⚠️',
      text: 'Unverified',
      color: 'var(--amber)'
    };
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatPrice = (price) => {
    if (!price) return 'N/A';
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };

  const verification = getVerificationBadge();

  const cardStyles = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: isMobile ? '16px' : '20px',
    transition: 'var(--transition)',
    cursor: onClick ? 'pointer' : 'default',
    position: 'relative',
    height: 'fit-content'
  };

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  };

  const assetInfoStyles = {
    flex: 1,
    minWidth: 0
  };

  const assetCodeStyles = {
    fontSize: isMobile ? '18px' : '20px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const badgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px',
    fontWeight: 600,
    background: `${verification.color}20`,
    color: verification.color,
    border: `1px solid ${verification.color}40`
  };

  const statsGridStyles = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '16px'
  };

  const statItemStyles = {
    textAlign: 'center',
    padding: '8px',
    background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)'
  };

  const statValueStyles = {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '2px'
  };

  const statLabelStyles = {
    fontSize: '11px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  return (
    <div
      style={cardStyles}
      onClick={onClick}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.borderColor = 'var(--cyan)'
          e.currentTarget.style.boxShadow = '0 4px 12px var(--cyan-glow-sm)'
        }
      }}
      onMouseLeave={e => {
        if (onClick) {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      {/* Header */}
      <div style={headerStyles}>
        <div style={assetInfoStyles}>
          <div style={assetCodeStyles}>
            {asset.code}
            <span style={badgeStyles}>
              {verification.icon} {verification.text}
            </span>
          </div>
          
          {(asset.name || issuerInfo?.name) && (
            <div style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
              fontWeight: 500
            }}>
              {asset.name || issuerInfo?.name}
            </div>
          )}
          
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}>
            {asset.issuer ? (
              <CopyableValue value={asset.issuer} title="Copy issuer address">
                {shortAddress(asset.issuer, 4)}
              </CopyableValue>
            ) : (
              <span style={{ color: 'var(--red)' }}>Issuer missing</span>
            )}
            {(asset.domain || issuerInfo?.domain) && (
              <span style={{ marginLeft: '8px', color: 'var(--cyan)' }}>
                🌐 {asset.domain || issuerInfo?.domain}
              </span>
            )}
          </div>
        </div>

        {/* Price (if available) */}
        {marketData?.price_usd && (
          <div style={{
            textAlign: 'right',
            minWidth: 'fit-content'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)'
            }}>
              ${formatPrice(marketData.price_usd)}
            </div>
            {marketData.change_24h !== undefined && (
              <div style={{
                fontSize: '12px',
                color: marketData.change_24h >= 0 ? 'var(--green)' : 'var(--red)',
                fontWeight: 600
              }}>
                {marketData.change_24h >= 0 ? '+' : ''}{marketData.change_24h.toFixed(2)}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={statsGridStyles}>
        <div style={statItemStyles}>
          <div style={statValueStyles}>
            {formatNumber(asset.num_accounts)}
          </div>
          <div style={statLabelStyles}>Accounts</div>
        </div>
        
        <div style={statItemStyles}>
          <div style={statValueStyles}>
            {asset.amount ? formatXLM(asset.amount) : 'N/A'}
          </div>
          <div style={statLabelStyles}>Supply</div>
        </div>
        
        {marketData?.volume_24h_usd && (
          <div style={statItemStyles}>
            <div style={statValueStyles}>
              ${formatNumber(marketData.volume_24h_usd)}
            </div>
            <div style={statLabelStyles}>24h Volume</div>
          </div>
        )}
      </div>

      {/* Asset Flags */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        marginBottom: '12px'
      }}>
        <AssetTrustStatus issuer={asset.issuer} flags={asset.flags} />
          {asset.flags?.auth_revocable && (
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--red-glow)',
              color: 'var(--red)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--red)'
            }}>
              AUTH_REVOCABLE
            </span>
          )}
      </div>

      {/* Description */}
      {(asset.description || issuerInfo?.description) && (
        <div style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          marginBottom: '12px'
        }}>
          {asset.description || issuerInfo?.description}
        </div>
      )}

      {/* Expand/Collapse Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        style={{
          width: '100%',
          padding: '8px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'var(--transition)',
          fontFamily: 'var(--font-mono)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--bg-hover)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--bg-elevated)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
      >
        {expanded ? '🔼 Less Details' : '🔽 More Details'}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          fontSize: '12px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '8px'
          }}>
            <div>
              <strong>Issuer:</strong>
              <div style={{ 
                fontFamily: 'var(--font-mono)', 
                wordBreak: 'break-all',
                marginTop: '2px'
              }}>
                {asset.issuer || 'Missing issuer'}
              </div>
            </div>
            
            {issuerInfo?.website && (
              <div>
                <strong>Website:</strong>
                <div style={{ marginTop: '2px' }}>
                  <a
                    href={issuerInfo.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--cyan)',
                      textDecoration: 'none'
                    }}
                  >
                    {issuerInfo.website}
                  </a>
                </div>
              </div>
            )}
            
            {marketData?.price_xlm && (
              <div>
                <strong>Price (XLM):</strong>
                <div style={{ marginTop: '2px' }}>
                  {formatPrice(marketData.price_xlm)} XLM
                </div>
              </div>
            )}
            
            {marketData?.market_cap_usd && (
              <div>
                <strong>Market Cap:</strong>
                <div style={{ marginTop: '2px' }}>
                  ${formatNumber(marketData.market_cap_usd)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.1)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="spinner" style={{ width: '24px', height: '24px' }} />
        </div>
      )}
    </div>
  );
}
