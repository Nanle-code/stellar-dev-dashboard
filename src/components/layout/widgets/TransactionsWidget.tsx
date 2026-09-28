import React from 'react';
import { useStore } from '../../../lib/store';
import CopyableValue from '../../dashboard/CopyableValue';
import WidgetBase from './WidgetBase';
import { format } from 'date-fns';

export interface TransactionsWidgetProps {
  onRefresh?: () => void;
  maxTransactions?: number;
}

export default function TransactionsWidget({ onRefresh, maxTransactions = 5 }: TransactionsWidgetProps) {
  const { transactions, txLoading, network } = useStore();

  const displayTransactions = transactions?.slice(0, maxTransactions) || [];
  const hasMore = (transactions?.length || 0) > maxTransactions;

  return (
    <WidgetBase
      title="Recent Transactions"
      subtitle={`Latest ${Math.min(transactions?.length || 0, maxTransactions)} transaction${Math.min(transactions?.length || 0, maxTransactions) !== 1 ? 's' : ''}`}
      icon="⇄"
      onRefresh={onRefresh}
      loading={txLoading}
      contentPadding={false}
    >
      {!transactions || transactions.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⇄</div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '4px'
          }}>
            No Transactions
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: 1.4
          }}>
            Transaction history will appear here
          </div>
        </div>
      ) : (
        <div style={{ padding: '4px 0' }}>
          {displayTransactions.map((tx: any, i: number) => (
            <div
              key={tx.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 18px',
                borderBottom: i < displayTransactions.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => e.currentTarget.style.background = 'transparent'}
            >
              {/* Status Indicator */}
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: tx.successful ? 'var(--green)' : 'var(--red)',
                flexShrink: 0,
              }} />

              {/* Transaction Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <CopyableValue
                  value={tx.hash}
                  title="Copy transaction hash"
                  containerStyle={{
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: '4px'
                  }}
                  textStyle={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '200px'
                  }}
                >
                  {tx.hash}
                </CopyableValue>

                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>
                    {tx.operation_count} op{tx.operation_count !== 1 ? 's' : ''}
                  </span>
                  <span>•</span>
                  <span>
                    {format(new Date(tx.created_at), 'MMM d, HH:mm')}
                  </span>
                </div>
              </div>

              {/* External Link */}
              <a
                href={`https://stellar.expert/explorer/${network}/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '14px',
                  color: 'var(--cyan)',
                  flexShrink: 0,
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'var(--transition)'
                }}
                title="View on Stellar Expert"
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.background = 'var(--cyan-glow)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                ↗
              </a>
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
                +{(transactions?.length || 0) - maxTransactions} more transaction{(transactions?.length || 0) - maxTransactions !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetBase>
  );
}