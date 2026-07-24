import React, { useMemo } from 'react';
import { format } from 'date-fns';
import type { Horizon } from '@stellar/stellar-sdk';
import VirtualList from '../common/VirtualList';
import CopyableValue from './CopyableValue';
import { shortAddress, getOperationLabel } from '../../lib/stellar';
import AddressLabelBadge from '../addressLabels/AddressLabelBadge';

export const TX_ROW_HEIGHT = 86;
export const OP_ROW_HEIGHT = 74;

interface VirtualTxListProps {
  items: Horizon.ServerApi.TransactionRecord[]
  network: string
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
}

interface VirtualOpListProps {
  items: Horizon.ServerApi.OperationRecord[]
  network: string
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
}

interface VirtualTxRowProps {
  tx: Horizon.ServerApi.TransactionRecord
  network: string
}

const VirtualTxRow = React.memo(({ tx, network }: VirtualTxRowProps) => {
  const formattedDate = useMemo(() => {
    try {
      return format(new Date(tx.created_at), 'MMM d, HH:mm');
    } catch (e) {
      return tx.created_at;
    }
  }, [tx.created_at]);

  return (
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
      onMouseEnter={(event: React.MouseEvent<HTMLDivElement>) => (event.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(event: React.MouseEvent<HTMLDivElement>) => (event.currentTarget.style.background = 'transparent')}
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
        {Boolean(tx.memo) && (
          <div style={{ fontSize: '11px', color: 'var(--amber)', marginLeft: '22px', marginBottom: '2px' }}>
            memo: {String(tx.memo)}
          </div>
        )}
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '22px' }}>
          fee: {tx.fee_charged} stroops
        </div>
        {Boolean(tx.source_account) && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '22px' }}>
            source:
            <AddressLabelBadge address={tx.source_account} />
            <CopyableValue
              value={tx.source_account}
              title="Copy source account"
              textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {shortAddress(tx.source_account)}
            </CopyableValue>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {tx.operation_count} op{tx.operation_count !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {formattedDate}
        </div>
      </div>
    </div>
  );
});

VirtualTxRow.displayName = 'VirtualTxRow';

interface VirtualOpRowProps {
  op: Horizon.ServerApi.OperationRecord
}

const VirtualOpRow = React.memo(({ op }: VirtualOpRowProps) => {
  const formattedDate = useMemo(() => {
    try {
      return format(new Date(op.created_at), 'MMM d, HH:mm');
    } catch (e) {
      return op.created_at;
    }
  }, [op.created_at]);

  const opRecord = op as Record<string, unknown>;
  const fromAddr = typeof opRecord.from === 'string' ? opRecord.from : '';
  const toAddr = typeof opRecord.to === 'string' ? opRecord.to : '';
  const amountVal = typeof opRecord.amount === 'string' ? opRecord.amount : '';
  const assetCode = typeof opRecord.asset_code === 'string' ? opRecord.asset_code : 'XLM';

  return (
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
      onMouseEnter={(event: React.MouseEvent<HTMLDivElement>) => (event.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(event: React.MouseEvent<HTMLDivElement>) => (event.currentTarget.style.background = 'transparent')}
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
        {Boolean(fromAddr) && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            from:
            <AddressLabelBadge address={fromAddr} />
            <CopyableValue
              value={fromAddr}
              title="Copy source public key"
              textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {shortAddress(fromAddr)}
            </CopyableValue>
          </div>
        )}
        {Boolean(toAddr) && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            to:
            <AddressLabelBadge address={toAddr} />
            <CopyableValue
              value={toAddr}
              title="Copy destination public key"
              textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {shortAddress(toAddr)}
            </CopyableValue>
          </div>
        )}
        {Boolean(amountVal) && (
          <div style={{ fontSize: '11px', color: 'var(--amber)' }}>
            {parseFloat(amountVal).toFixed(4)} {assetCode}
          </div>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
        {formattedDate}
      </div>
    </div>
  );
});

VirtualOpRow.displayName = 'VirtualOpRow';

export const VirtualTxList = ({ items, network, onLoadMore, hasMore, loading }: VirtualTxListProps) => {
  const rowHeight = (_index: number, item: Horizon.ServerApi.TransactionRecord) => {
    return item.memo ? TX_ROW_HEIGHT + 20 : TX_ROW_HEIGHT;
  };

  return (
    <VirtualList<Horizon.ServerApi.TransactionRecord>
      items={items}
      rowHeight={rowHeight}
      onLoadMore={onLoadMore}
      loading={loading}
      containerStyle={{ height: '600px' }}
    >
      {(tx, _index) => (
        <VirtualTxRow tx={tx} network={network} />
      )}
    </VirtualList>
  );
};

export const VirtualOpList = ({ items, network, onLoadMore, hasMore, loading }: VirtualOpListProps) => {
  return (
    <VirtualList<Horizon.ServerApi.OperationRecord>
      items={items}
      rowHeight={OP_ROW_HEIGHT}
      onLoadMore={onLoadMore}
      loading={loading}
      containerStyle={{ height: '600px' }}
    >
      {(op, _index) => (
        <VirtualOpRow op={op} />
      )}
    </VirtualList>
  );
};
