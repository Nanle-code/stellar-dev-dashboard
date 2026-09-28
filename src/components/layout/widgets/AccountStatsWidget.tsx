import React from 'react';
import { useStore } from '../../../lib/store';
import { shortAddress } from '../../../lib/stellar';
import CopyableValue from '../../dashboard/CopyableValue';
import WidgetBase from './WidgetBase';

export interface BaseWidgetProps {
  onRefresh?: () => void;
}

export default function AccountStatsWidget({ onRefresh }: BaseWidgetProps) {
  const { accountData, transactions, operations, connectedAddress, txLoading, opsLoading } = useStore();

  const stats = [
    {
      label: 'Sequence Number',
      value: accountData?.sequence ? `...${accountData.sequence.slice(-8)}` : '—',
      fullValue: accountData?.sequence,
      icon: '🔢',
      color: 'var(--cyan)',
      copyable: true
    },
    {
      label: 'Subentry Count',
      value: accountData?.subentry_count?.toString() || '0',
      icon: '📋',
      color: 'var(--amber)'
    },
    {
      label: 'Transactions',
      value: txLoading ? '...' : (transactions?.length || 0).toString(),
      subtitle: 'recent',
      icon: '⇄',
      color: 'var(--green)',
      loading: txLoading
    },
    {
      label: 'Operations',
      value: opsLoading ? '...' : (operations?.length || 0).toString(),
      subtitle: 'recent',
      icon: '⚙️',
      color: 'var(--text-secondary)',
      loading: opsLoading
    }
  ];

  const thresholds = accountData?.thresholds;
  const signers = accountData?.signers || [];

  return (
    <WidgetBase
      title="Account Stats"
      subtitle={connectedAddress ? shortAddress(connectedAddress, 6) : ''}
      icon="👤"
      onRefresh={onRefresh}
      loading={!accountData}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%'
      }}>
        {/* Main Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px'
        }}>
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '10px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                transition: 'var(--transition)'
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.borderColor = stat.color;
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div style={{ fontSize: '16px', marginBottom: '4px' }}>
                {stat.icon}
              </div>

              <div style={{
                fontSize: '14px',
                fontWeight: 700,
                color: stat.loading ? 'var(--text-muted)' : stat.color,
                fontFamily: 'var(--font-mono)',
                marginBottom: '2px'
              }}>
                {stat.loading ? (
                  <div className="spinner" style={{ width: '12px', height: '12px', margin: '0 auto' }} />
                ) : stat.copyable && stat.fullValue ? (
                  <CopyableValue
                    value={stat.fullValue}
                    title={`Copy ${stat.label.toLowerCase()}`}
                    textStyle={{ color: stat.color }}
                  >
                    {stat.value}
                  </CopyableValue>
                ) : (
                  stat.value
                )}
              </div>

              <div style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {stat.label}
                {stat.subtitle && ` (${stat.subtitle})`}
              </div>
            </div>
          ))}
        </div>

        {/* Account Security Info */}
        {thresholds && (
          <div style={{
            padding: '12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              🔐 Security Thresholds
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              fontSize: '11px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {thresholds.low_threshold}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>Low</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {thresholds.med_threshold}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>Med</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {thresholds.high_threshold}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>High</div>
              </div>
            </div>
          </div>
        )}

        {/* Signers Info */}
        {signers.length > 1 && (
          <div style={{
            padding: '12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              ✍️ Signers ({signers.length})
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {signers.slice(0, 3).map((signer: any) => (
                <div key={signer.key} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px'
                }}>
                  <CopyableValue
                    value={signer.key}
                    title="Copy signer key"
                    textStyle={{
                      color: signer.key === connectedAddress ? 'var(--cyan)' : 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {shortAddress(signer.key, 4)}
                    {signer.key === connectedAddress && ' (you)'}
                  </CopyableValue>
                  <span style={{
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {signer.weight}
                  </span>
                </div>
              ))}
              {signers.length > 3 && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  marginTop: '4px'
                }}>
                  +{signers.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </WidgetBase>
  );
}