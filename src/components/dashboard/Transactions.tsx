import React, { useMemo, useState, lazy, Suspense } from 'react'
import { Download, Filter, Search, X } from 'lucide-react'

const TransactionGraph = lazy(() => import('./TransactionGraph'))
const TimeAnalysis = lazy(() => import('./TimeAnalysis'))
const CrossNetworkPanel = lazy(() => import('./CrossNetworkPanel'))
import { format } from 'date-fns'
import { useStore } from '../../lib/store'
import { shortAddress, getOperationLabel, fetchTransactions, fetchOperations } from '../../lib/stellar'
import CopyableValue from './CopyableValue'
import useSearch from '../../hooks/useSearch'
import { filterRecords, countActiveFilters } from '../../lib/transactionFilters'
import { exportCsv, flattenTransaction } from '../../utils/export'
import { VirtualTxList, VirtualOpList, TX_ROW_HEIGHT, OP_ROW_HEIGHT } from './VirtualizedLists'
import TransactionFilterPanel from '../filters/TransactionFilterPanel'
import AddressLabelBadge from '../addressLabels/AddressLabelBadge'
import { useAddressLabels } from '../../hooks/useAddressLabels'

const VIRTUAL_SCROLL_THRESHOLD = 200
const PAGE_SIZE = 100

function normalizeSearch(value) {
  return String(value || '').toLowerCase().trim()
}

function searchableText(values) {
  return values.filter(Boolean).join(' ').toLowerCase()
}

function getOperationAccounts(op) {
  return [
    op.from,
    op.to,
    op.source_account,
    op.account,
    op.funder,
    op.into,
    op.trustor,
    op.trustee,
    op.seller,
    op.buyer,
    op.selling_asset_issuer,
    op.buying_asset_issuer,
    op.asset_issuer,
  ].filter(Boolean)
}

function flattenOperation(op) {
  return {
    id: op.id,
    transaction_hash: op.transaction_hash || '',
    type: op.type,
    type_label: getOperationLabel(op.type),
    created_at: op.created_at,
    from: op.from || '',
    to: op.to || '',
    source_account: op.source_account || '',
    account: op.account || '',
    amount: op.amount || '',
    asset_code: op.asset_code || 'XLM',
    asset_issuer: op.asset_issuer || '',
  }
}

function LoadingRows({ count, height }) {
  return (
    <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-pulse"
          style={{
            height: `${height}px`,
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      ))}
    </div>
  )
}

export default function Transactions() {
  const {
    connectedAddress,
    transactions,
    txLoading,
    appendTransactions,
    txNextCursor,
    txHasMore,
    txPagingLoading,
    setTxNextCursor,
    setTxHasMore,
    setTxPagingLoading,
    operations,
    opsLoading,
    appendOperations,
    opsNextCursor,
    opsHasMore,
    opsPagingLoading,
    setOpsNextCursor,
    setOpsHasMore,
    setOpsPagingLoading,
    network,
    filterExpressions,
  } = useStore()

  const [view, setView] = useState('transactions')
  const [showFilters, setShowFilters] = useState(false)
  const {
    query,
    setQuery,
    savedSearches,
    saveCurrentSearch,
    removeSavedSearch,
    applySavedSearch,
  } = useSearch()
  const { labelMap } = useAddressLabels()

  const addressLabels = useMemo(() => {
    const labels = {}
    Object.keys(labelMap).forEach((addr) => {
      labels[addr] = labelMap[addr].label
    })
    return labels
  }, [labelMap])

  // Track in-flight requests to prevent duplicate calls
  const txLoadingRef = React.useRef(false)
  const opsLoadingRef = React.useRef(false)

  const filteredTransactions = useMemo(() => {
    let list = transactions
    const q = normalizeSearch(query)

    if (q) {
      list = list.filter((tx) => searchableText([
        tx.hash,
        tx.memo,
        tx.source_account,
        addressLabels[tx.source_account],
        tx.ledger,
        tx.operation_count,
      ]).includes(q))
    }

    return filterRecords(list, filterExpressions)
  }, [transactions, query, filterExpressions, addressLabels])

  const filteredOperations = useMemo(() => {
    let list = operations
    const q = normalizeSearch(query)

    if (q) {
      list = list.filter((op) => {
        const accounts = getOperationAccounts(op)
        const labels = accounts.map((account) => addressLabels[account])

        return searchableText([
          op.id,
          op.transaction_hash,
          op.type,
          getOperationLabel(op.type),
          op.amount,
          op.asset_code,
          ...accounts,
          ...labels,
        ]).includes(q)
      })
    }

    return filterRecords(list, filterExpressions)
  }, [operations, query, filterExpressions, addressLabels])

  const visibleRows = view === 'transactions' ? filteredTransactions : filteredOperations

  // Debounced load-more — guards against rapid duplicate calls from
  // both IntersectionObserver and scroll handlers firing together
  const handleLoadMoreTransactions = React.useCallback(async () => {
    if (!connectedAddress || !txHasMore || !txNextCursor || txPagingLoading || txLoadingRef.current) return
    txLoadingRef.current = true
    setTxPagingLoading(true)
    try {
      const { records, nextCursor, hasMore } = await fetchTransactions(
        connectedAddress, network, PAGE_SIZE, txNextCursor
      )
      appendTransactions(records)
      setTxNextCursor(nextCursor)
      setTxHasMore(hasMore)
    } finally {
      setTxPagingLoading(false)
      txLoadingRef.current = false
    }
  }, [connectedAddress, txHasMore, txNextCursor, txPagingLoading, network, appendTransactions, setTxNextCursor, setTxHasMore, setTxPagingLoading])

  const handleLoadMoreOperations = React.useCallback(async () => {
    if (!connectedAddress || !opsHasMore || !opsNextCursor || opsPagingLoading || opsLoadingRef.current) return
    opsLoadingRef.current = true
    setOpsPagingLoading(true)
    try {
      const { records, nextCursor, hasMore } = await fetchOperations(
        connectedAddress, network, PAGE_SIZE, opsNextCursor
      )
      appendOperations(records)
      setOpsNextCursor(nextCursor)
      setOpsHasMore(hasMore)
    } finally {
      setOpsPagingLoading(false)
      opsLoadingRef.current = false
    }
  }, [connectedAddress, opsHasMore, opsNextCursor, opsPagingLoading, network, appendOperations, setOpsNextCursor, setOpsHasMore, setOpsPagingLoading])


  const useVirtualTx = filteredTransactions.length >= VIRTUAL_SCROLL_THRESHOLD
  const useVirtualOp = filteredOperations.length >= VIRTUAL_SCROLL_THRESHOLD

  function handleExportCsv() {
    if (view === 'transactions') {
      exportCsv(
        filteredTransactions.map(flattenTransaction),
        `stellar-${network}-filtered-transactions`,
        ['id', 'hash', 'ledger', 'created_at', 'source_account', 'fee_charged', 'operation_count', 'successful', 'memo_type', 'memo']
      )
      return
    }

    exportCsv(
      filteredOperations.map(flattenOperation),
      `stellar-${network}-filtered-operations`,
      ['id', 'transaction_hash', 'type', 'type_label', 'created_at', 'from', 'to', 'source_account', 'account', 'amount', 'asset_code', 'asset_issuer']
    )
  }

  const Tab = ({ id, label }) => (
    <button
      onClick={() => setView(id)}
      style={{
        padding: '7px 16px',
        background: view === id ? 'var(--cyan-glow)' : 'transparent',
        border: `1px solid ${view === id ? 'var(--cyan-dim)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        color: view === id ? 'var(--cyan)' : 'var(--text-secondary)',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        transition: 'var(--transition)',
      }}
    >
      {label}
    </button>
  )

  const hasActiveFilters = countActiveFilters(filterExpressions) > 0

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '300px' }}>
          {view !== 'time' && (<>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 10px',
            flex: 1,
          }}>
            <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by account name, address, hash, memo, or operation"
              aria-label="Search transaction history"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                minWidth: 0,
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear transaction history search"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '8px 14px',
              background: showFilters ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
              border: `1px solid ${showFilters ? 'var(--cyan-dim)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: showFilters ? 'var(--cyan)' : 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'var(--transition)',
              height: '38px',
            }}
          >
            <Filter size={14} />
            <span>Filters</span>
            {hasActiveFilters && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--cyan)',
                boxShadow: '0 0 8px var(--cyan)',
              }} />
            )}
          </button>

          <button
            onClick={handleExportCsv}
            style={{
              padding: '8px 14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'var(--transition)',
              height: '38px',
            }}
          >
            <Download size={14} />
            <span>CSV</span>
          </button>
          </>)}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <Tab id="transactions" label="Transactions" />
          <Tab id="operations" label="Operations" />
          <Tab id="graph" label="Graph" />
          <Tab id="time" label="Time" />
          <Tab id="networks" label="Networks" />
        </div>
      </div>

      {showFilters && (
        <TransactionFilterPanel view={view} />
      )}

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        {view === 'graph' ? (
          'Visual transaction graph — hover for details, click to explore'
        ) : view === 'time' ? (
          'Time-based analysis of operations and transactions'
        ) : view === 'networks' ? (
          'Cross-network status and account comparison'
        ) : (
          <>Showing {visibleRows.length} filtered {view === 'transactions' ? 'transaction' : 'operation'}{visibleRows.length !== 1 ? 's' : ''}</>
        )}
      </div>

      {view === 'transactions' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <span>Hash</span>
            <span>Ops / Time</span>
          </div>

          {/* Initial loading skeleton */}
          {txLoading ? (
            <LoadingRows count={8} height={TX_ROW_HEIGHT} />
          ) : filteredTransactions.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              {transactions.length === 0 ? 'No transactions found' : 'No transactions match your filters'}
            </div>
          ) : useVirtualTx ? (
            // Virtual scroll for large lists (≥200 items)
            <VirtualTxList
              items={filteredTransactions}
              network={network}
              onLoadMore={handleLoadMoreTransactions}
              hasMore={txHasMore}
              loading={txPagingLoading}
            />
          ) : (
            <>
              {filteredTransactions.map((tx, index) => (
                <div
                  key={tx.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '12px 18px',
                    borderBottom: index < filteredTransactions.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={(event) => event.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(event) => event.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tx.successful ? 'var(--green)' : 'var(--red)', flexShrink: 0, display: 'inline-block' }} />
                      <CopyableValue
                        value={tx.hash}
                        title="Copy transaction hash"
                        containerStyle={{ fontSize: '12px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', minWidth: 0, flex: 1 }}
                        textStyle={{ display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
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
                      <div style={{ fontSize: '11px', color: 'var(--amber)', marginLeft: '15px' }}>
                        memo: {tx.memo}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '15px' }}>
                      fee: {tx.fee_charged} stroops
                    </div>
                    {tx.source_account && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '15px' }}>
                        source:
                        <AddressLabelBadge address={tx.source_account} />
                        <CopyableValue value={tx.source_account} title="Copy source account" textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
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
                      {format(new Date(tx.created_at), 'MMM d, HH:mm')}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
                {txHasMore || txPagingLoading ? (
                  <button
                    onClick={handleLoadMoreTransactions}
                    disabled={txPagingLoading}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-bright)',
                      background: txPagingLoading ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      cursor: txPagingLoading ? 'not-allowed' : 'pointer',
                      opacity: txPagingLoading ? 0.8 : 1,
                    }}
                  >
                    {txPagingLoading ? 'Loading...' : 'Load More'}
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No more transactions</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Operations panel */}
      {view === 'operations' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <span>Type / Details</span>
            <span>Time</span>
          </div>

          {opsLoading ? (
            <LoadingRows count={8} height={OP_ROW_HEIGHT} />
          ) : filteredOperations.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              {operations.length === 0 ? 'No operations found' : 'No operations match your filters'}
            </div>
          ) : useVirtualOp ? (
            <VirtualOpList
              items={filteredOperations}
              onLoadMore={handleLoadMoreOperations}
              hasMore={opsHasMore}
              loading={opsPagingLoading}
            />
          ) : (
            <>
              {filteredOperations.map((op, index) => (
                <div
                  key={op.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '12px 18px',
                    borderBottom: index < filteredOperations.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={(event) => event.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(event) => event.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                      <span style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-bright)',
                        borderRadius: '3px',
                        padding: '2px 6px',
                        fontSize: '11px',
                        color: 'var(--cyan)',
                        marginRight: '8px',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {getOperationLabel(op.type)}
                      </span>
                    </div>
                    {op.from && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        from:
                        <AddressLabelBadge address={op.from} />
                        <CopyableValue value={op.from} title="Copy source public key" textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {shortAddress(op.from)}
                        </CopyableValue>
                      </div>
                    )}
                    {op.to && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        to:
                        <AddressLabelBadge address={op.to} />
                        <CopyableValue value={op.to} title="Copy destination public key" textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {shortAddress(op.to)}
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
              ))}
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
                {opsHasMore || opsPagingLoading ? (
                  <button
                    onClick={handleLoadMoreOperations}
                    disabled={opsPagingLoading}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-bright)',
                      background: opsPagingLoading ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      cursor: opsPagingLoading ? 'not-allowed' : 'pointer',
                      opacity: opsPagingLoading ? 0.8 : 1,
                    }}
                  >
                    {opsPagingLoading ? 'Loading...' : 'Load More'}
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No more operations</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {view === 'graph' && (
        <div style={{ height: '500px', minHeight: '500px' }}>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px', background: '#0a0e17', borderRadius: '8px' }}>
              Loading graph...
            </div>
          }>
            <TransactionGraph />
          </Suspense>
        </div>
      )}

      {view === 'time' && (
        <Suspense fallback={
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            Loading time analysis...
          </div>
        }>
          <TimeAnalysis />
        </Suspense>
      )}

      {view === 'networks' && (
        <div style={{ background: '#0d1520', border: '1px solid #1a2332', borderRadius: '8px', overflow: 'hidden', maxWidth: '420px' }}>
          <Suspense fallback={
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Loading network status...
            </div>
          }>
            <CrossNetworkPanel />
          </Suspense>
        </div>
      )}

      {/* Keyframe animation for spinner — injected once */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .skeleton-pulse { animation: skeleton-pulse 1.5s ease-in-out infinite; }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </div>
  )
}
