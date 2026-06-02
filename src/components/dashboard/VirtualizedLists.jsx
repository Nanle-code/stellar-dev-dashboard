import React from 'react';
import { format } from 'date-fns';
import VirtualList from '../common/VirtualList';
import CopyableValue from './CopyableValue';
import { shortAddress, getOperationLabel } from '../../lib/stellar';

// Constants for virtualization
export const TX_ROW_HEIGHT = 86;
export const OP_ROW_HEIGHT = 74;

/**
 * Optimized Virtualized Transaction List
 */
export const VirtualTxList = ({ items, network, onLoadMore, hasMore, loading }) => {
  const rowHeight = (index, item) => {
    // Basic dynamic height estimation: add 20px if memo exists
    return item.memo ? TX_ROW_HEIGHT + 20 : TX_ROW_HEIGHT;
  };

  return (
    <VirtualList
      items={items}
      rowHeight={rowHeight}
      onLoadMore={onLoadMore}
      loading={loading}
      containerStyle={{ height: '600px' }}
    >
      {(tx, index) => (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '12px',
            alignItems: 'center',
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            transition: 'var(--transition)',
            height: '100%',
          }}
          onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: tx.successful ? 'var(--green)' : 'var(--red)',
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <CopyableValue
                value={tx.hash}
                title="Copy transaction hash"
                containerStyle={{
                  fontSize: '12px',
                  color: 'var(--cyan)',
                  fontFamily: 'var(--font-mono)',
                  minWidth: 0,
                  flex: 1,
                }}
                textStyle={{
                  display: 'inline-block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {tx.hash}
              </CopyableValue>
              <a
                href={`https://stellar.expert/explorer/${network}/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '11px', color: 'var(--cyan)', flexShrink: 0 }}
              >
                Open
              </a>
            </div>
            {tx.memo && (
              <div style={{ fontSize: '11px', color: 'var(--amber)', marginLeft: '22px', marginBottom: '2px' }}>
                memo: {tx.memo}
              </div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '22px' }}>
              fee: {tx.fee_charged} stroops
            </div>
            {tx.source_account && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '22px' }}>
                <CopyableValue
                  value={tx.source_account}
                  title="Copy source account"
                  textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  source: {shortAddress(tx.source_account)}
                </CopyableValue>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {tx.operation_count} op{tx.operation_count !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {format(new Date(tx.created_at), 'MMM d, HH:mm')}
            </div>
          </div>
        </div>
      )}
    </VirtualList>
  );
};

/**
 * Optimized Virtualized Operation List
 */
export const VirtualOpList = ({ items, network, onLoadMore, hasMore, loading }) => {
  return (
    <VirtualList
      items={items}
      rowHeight={OP_ROW_HEIGHT}
      onLoadMore={onLoadMore}
      loading={loading}
      containerStyle={{ height: '600px' }}
    >
      {(op, index) => (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '12px',
            alignItems: 'center',
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            transition: 'var(--transition)',
            height: '100%',
          }}
          onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}
        >
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginBottom: '3px' }}>
              <span
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  color: 'var(--cyan)',
                  marginRight: '8px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {getOperationLabel(op.type)}
              </span>
            </div>
            {op.from && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                <CopyableValue
                  value={op.from}
                  title="Copy source public key"
                  textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  from: {shortAddress(op.from)}
                </CopyableValue>
              </div>
            )}
            {op.to && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                <CopyableValue
                  value={op.to}
                  title="Copy destination public key"
                  textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  to: {shortAddress(op.to)}
                </CopyableValue>
              </div>
            )}
            {op.amount && (
              <div style={{ fontSize: '11px', color: 'var(--amber)' }}>
                {parseFloat(op.amount).toFixed(4)} {op.asset_code || 'XLM'}
              </div>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
            {format(new Date(op.created_at), 'MMM d, HH:mm')}
          </div>
        </div>
      )}
    </VirtualList>
  );
};
