import React, { useEffect } from 'react';
import { useStore } from '../../../lib/store';
import { fetchNetworkStats } from '../../../lib/stellar';
import { useErrorHandler } from '../../../hooks/useErrorHandler';
import WidgetBase from './WidgetBase';
import { format } from 'date-fns';

export interface BaseWidgetProps {
  onRefresh?: () => void;
}

export default function NetworkStatsWidget({ onRefresh }: BaseWidgetProps) {
  const {
    network,
    networkStats,
    setNetworkStats,
    statsLoading,
    setStatsLoading
  } = useStore();

  const { handleError } = useErrorHandler('NetworkStatsWidget');

  const loadNetworkStats = async () => {
    try {
      setStatsLoading(true);
      const stats = await fetchNetworkStats(network);
      setNetworkStats(stats);
    } catch (error) {
      handleError(error, { network });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadNetworkStats();
  }, [network]);

  const handleRefresh = () => {
    loadNetworkStats();
    onRefresh?.();
  };

  const ledger = networkStats?.latestLedger;
  const feeStats = networkStats?.feeStats;

  const stats = [
    {
      label: 'Latest Ledger',
      value: ledger?.sequence?.toLocaleString() ?? '—',
      icon: '📊',
      color: 'var(--cyan)'
    },
    {
      label: 'Base Fee',
      value: feeStats ? `${feeStats.last_ledger_base_fee} stroops` : '—',
      icon: '💰',
      color: 'var(--amber)'
    },
    {
      label: 'Ledger Close',
      value: ledger ? format(new Date(ledger.closed_at), 'HH:mm:ss') : '—',
      subtitle: ledger ? format(new Date(ledger.closed_at), 'MMM d, yyyy') : '',
      icon: '⏰',
      color: 'var(--green)'
    }
  ];

  return (
    <WidgetBase
      title="Network Stats"
      subtitle={`${network} network`}
      icon="🌐"
      onRefresh={handleRefresh}
      loading={statsLoading}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        height: '100%'
      }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              transition: 'var(--transition)'
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
              e.currentTarget.style.borderColor = stat.color;
              e.currentTarget.style.boxShadow = `0 0 0 1px ${stat.color}20`;
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              fontSize: '20px',
              flexShrink: 0
            }}>
              {stat.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '4px'
              }}>
                {stat.label}
              </div>

              <div style={{
                fontSize: '16px',
                fontWeight: 700,
                color: stat.color,
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {stat.value}
              </div>

              {stat.subtitle && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '2px'
                }}>
                  {stat.subtitle}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Network Status Indicator */}
        <div style={{
          marginTop: 'auto',
          padding: '8px 12px',
          background: network === 'testnet' ? 'var(--amber-glow)' : 'var(--green-glow)',
          border: `1px solid ${network === 'testnet' ? 'var(--amber)' : 'var(--green)'}`,
          borderRadius: 'var(--radius-md)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: network === 'testnet' ? 'var(--amber)' : 'var(--green)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {network} Network
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '2px'
          }}>
            {network === 'testnet' ? 'Development & Testing' : 'Production Network'}
          </div>
        </div>
      </div>
    </WidgetBase>
  );
}