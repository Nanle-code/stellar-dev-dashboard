import React from 'react';
import { useStore } from '../../../lib/store';
import { formatXLM } from '../../../lib/stellar';
import useAssetUsdEstimates, { formatEstimatedUsd } from '../../../hooks/useAssetUsdEstimates';
import WidgetBase from './WidgetBase';

export interface BaseWidgetProps {
  onRefresh?: () => void;
}

export default function BalanceWidget({ onRefresh }: BaseWidgetProps) {
  const { accountData, connectedAddress, network } = useStore();

  const { getEstimate } = useAssetUsdEstimates({
    balances: accountData?.balances || [],
    connectedAddress,
    network,
    refreshKey: accountData,
  });

  const xlmBalance = accountData?.balances?.find((b: any) => b.asset_type === 'native');
  const xlmEstimate = xlmBalance ? getEstimate(xlmBalance) : null;

  const totalUsdValue = accountData?.balances?.reduce((total: number, balance: any) => {
    const estimate = getEstimate(balance);
    return total + (estimate?.usd || 0);
  }, 0) || 0;

  return (
    <WidgetBase
      title="XLM Balance"
      subtitle={xlmEstimate ? `Est. ${formatEstimatedUsd(xlmEstimate.usd)}` : 'Lumens'}
      icon="💰"
      onRefresh={onRefresh}
      loading={!accountData}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center'
      }}>
        {/* Main Balance */}
        <div style={{
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <div style={{
            fontSize: '32px',
            fontWeight: 800,
            color: 'var(--cyan)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '8px'
          }}>
            {xlmBalance ? formatXLM(xlmBalance.balance) : '—'}
          </div>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Stellar Lumens
          </div>
        </div>

        {/* USD Estimate */}
        {xlmEstimate && (
          <div style={{
            textAlign: 'center',
            padding: '12px',
            background: 'var(--cyan-glow-sm)',
            border: '1px solid var(--cyan)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '4px'
            }}>
              {formatEstimatedUsd(xlmEstimate.usd)}
            </div>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}>
              USD Estimate
            </div>
          </div>
        )}

        {/* Total Portfolio Value */}
        {totalUsdValue > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderTop: '1px solid var(--border)',
            fontSize: '12px'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Total Portfolio:
            </span>
            <span style={{
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)'
            }}>
              {formatEstimatedUsd(totalUsdValue)}
            </span>
          </div>
        )}

        {/* Available Balance Info */}
        {xlmBalance && (
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: '8px',
            lineHeight: 1.4
          }}>
            Available balance excluding reserves and offers
          </div>
        )}
      </div>
    </WidgetBase>
  );
}