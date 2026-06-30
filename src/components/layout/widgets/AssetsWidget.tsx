import React from 'react';
import { useStore } from '../../../lib/store';
import { formatXLM, shortAddress } from '../../../lib/stellar';
import useAssetUsdEstimates, { formatEstimatedUsd } from '../../../hooks/useAssetUsdEstimates';
import CopyableValue from '../../dashboard/CopyableValue';
import WidgetBase from './WidgetBase';

export interface AssetsWidgetProps {
  onRefresh?: () => void;
  maxAssets?: number;
}

export interface AssetBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

export default function AssetsWidget({ onRefresh, maxAssets = 5 }: AssetsWidgetProps) {
  const { accountData, connectedAddress, network } = useStore();
  
  const { getEstimate } = useAssetUsdEstimates({
    balances: accountData?.balances || [],
    connectedAddress,
    network,
    refreshKey: accountData,
  });

  const otherAssets: AssetBalance[] = accountData?.balances?.filter((b: AssetBalance) => b.asset_type !== 'native') || [];
  const displayAssets = otherAssets.slice(0, maxAssets);
  const hasMore = otherAssets.length > maxAssets;

  return (
    <WidgetBase
      title="Asset Holdings"
      subtitle={`${otherAssets.length} non-native asset${otherAssets.length !== 1 ? 's' : ''}`}
      icon="💎"
      onRefresh={onRefresh}
      loading={!accountData}
      contentPadding={false}
    >
      {otherAssets.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>💎</div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '4px'
          }}>
            No Assets
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: 1.4
          }}>
            Create trustlines to hold other assets
          </div>
        </div>
      ) : (
        <div style={{ padding: '4px 0' }}>
          {displayAssets.map((asset, i) => (
            <div 
              key={`${asset.asset_code}-${asset.asset_issuer}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: i < displayAssets.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <span style={{ 
                    color: 'var(--text-primary)', 
                    fontWeight: 600,
                    fontSize: '14px'
                  }}>
                    {asset.asset_code || asset.asset_type}
                  </span>
                  {parseFloat(asset.balance) === 0 && (
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: 'var(--amber-glow)',
                      color: 'var(--amber)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--amber)'
                    }}>
                      EMPTY
                    </span>
                  )}
                </div>
                {asset.asset_issuer && (
                  <CopyableValue
                    value={asset.asset_issuer}
                    title="Copy asset issuer public key"
                    containerStyle={{ 
                      color: 'var(--text-muted)', 
                      fontSize: '11px', 
                      fontFamily: 'var(--font-mono)' 
                    }}
                    textStyle={{ 
                      maxWidth: '180px', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}
                  >
                    {shortAddress(asset.asset_issuer, 4)}
                  </CopyableValue>
                )}
              </div>
              
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'flex-end', 
                gap: '4px',
                minWidth: '80px'
              }}>
                <span style={{ 
                  color: parseFloat(asset.balance) > 0 ? 'var(--cyan)' : 'var(--text-muted)', 
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 600
                }}>
                  {formatXLM(asset.balance)}
                </span>
                {getEstimate(asset) && (
                  <span style={{ 
                    color: 'var(--text-muted)', 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '11px' 
                  }}>
                    {formatEstimatedUsd(getEstimate(asset)!.usd)}
                  </span>
                )}
              </div>
            </div>
          ))}
          
          {hasMore && (
            <div style={{
              padding: '12px 18px',
              textAlign: 'center',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-elevated)'
            }}>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-muted)'
              }}>
                +{(otherAssets.length) - maxAssets} more asset{(otherAssets.length) - maxAssets !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetBase>
  );
}