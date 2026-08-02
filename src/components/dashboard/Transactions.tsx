import React, { useMemo, useState, lazy, Suspense } from 'react'
import { Download, Filter, Search, X, ShieldAlert, Cpu, Sparkles, RefreshCw } from 'lucide-react'

const TransactionGraph = lazy(() => import('./TransactionGraph'))
const TimeAnalysis = lazy(() => import('./TimeAnalysis'))
const CrossNetworkPanel = lazy(() => import('./CrossNetworkPanel'))
const TransactionClusterView = lazy(() => import('./TransactionClusterView'))
import { format } from 'date-fns'
import { useStore } from '../../lib/store'
import { shortAddress, getOperationLabel, fetchTransactions, fetchOperations } from '../../lib/stellar'
import CopyableValue from './CopyableValue'
import useSearch from '../../hooks/useSearch'
import { filterRecords, countActiveFilters } from '../../lib/transactionFilters'
import { exportCsv, flattenTransaction } from '../../utils/export'
import { VirtualTxList, VirtualOpList, TX_ROW_HEIGHT, OP_ROW_HEIGHT } from './VirtualizedLists'
import { priorityScoringService } from '../../lib/priorityScoring'

function PriorityBadge({ tx, onUpdate }) {
  const details = priorityScoringService.scoreTransaction(tx)
  const [isOpen, setIsOpen] = useState(false)

  const colors = {
    Low: { text: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)', border: 'var(--border)' },
    Medium: { text: 'var(--amber)', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)' },
    High: { text: 'var(--red)', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)' }
  }

  const { text, bg, border } = colors[details.level]

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        title="Click to adjust priority manually"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 600,
          background: bg,
          color: text,
          border: `1px solid ${border}`,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          transition: 'var(--transition)'
        }}
      >
        <span>{details.level}</span>
        <span style={{ opacity: 0.7 }}>({details.score})</span>
        <span style={{ fontSize: '10px', opacity: 0.8 }} role="img" aria-label="priority-type">
          {details.isSuggested ? '🤖' : '👤'}
        </span>
      </button>

      {isOpen && (
        <>
          <div 
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
            }} 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1000,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-bright)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            marginTop: '4px',
            minWidth: '100px'
          }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', padding: '2px 6px', fontFamily: 'var(--font-mono)' }}>SET PRIORITY:</div>
            {(['Low', 'Medium', 'High'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={(e) => {
                  e.stopPropagation()
                  priorityScoringService.updatePriority(tx, lvl)
                  setIsOpen(false)
                  onUpdate()
                }}
                style={{
                  padding: '5px 8px',
                  fontSize: '10px',
                  background: details.level === lvl ? 'var(--bg-hover)' : 'transparent',
                  border: 'none',
                  color: details.level === lvl ? 'var(--cyan)' : 'var(--text-primary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--radius-xs)',
                  width: '100%',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = details.level === lvl ? 'var(--bg-hover)' : 'transparent'}
              >
                {lvl} {details.level === lvl ? '✓' : ''}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
import TransactionFilterPanel from '../filters/TransactionFilterPanel'
import AddressLabelBadge from '../addressLabels/AddressLabelBadge'
import { useAddressLabels } from '../../hooks/useAddressLabels'
import { generateTransactionDescription } from '../../lib/aiTransactionDescription'

const VIRTUAL_SCROLL_THRESHOLD = 200
const PAGE_SIZE = 50

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

function InfiniteScrollSentinel({ onIntersect, hasMore, loading, label = 'items' }: { onIntersect: () => void, hasMore: boolean, loading: boolean, label?: string }) {
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!hasMore || loading) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onIntersect()
      }
    }, { rootMargin: '200px' })

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current)
    }

    return () => observer.disconnect()
  }, [onIntersect, hasMore, loading])

  return (
    <div ref={sentinelRef} style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center' }}>
      {loading ? (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loading more...</span>
      ) : hasMore ? (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Scroll for more</span>
      ) : (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No more {label}</span>
      )}
    </div>
  )
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

  const [view, setView] = useState<'transactions' | 'priority-queue' | 'operations' | 'graph' | 'time' | 'networks' | 'clusters'>('transactions')
  const [showFilters, setShowFilters] = useState(false)
  const [priorityUpdateCount, setPriorityUpdateCount] = useState(0)
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
      list = list.filter((tx) => {
        const descRes = generateTransactionDescription(tx as any, addressLabels)
        return searchableText([
          tx.hash,
          tx.memo,
          tx.source_account,
          addressLabels[tx.source_account],
          tx.ledger,
          tx.operation_count,
          descRes.description,
          descRes.summary,
          descRes.category,
        ]).includes(q)
      })
    }

    return filterRecords(list, filterExpressions)
  }, [transactions, query, filterExpressions, addressLabels, priorityUpdateCount])

  const prioritySortedQueue = useMemo(() => {
    return [...filteredTransactions].map(tx => {
      const scoring = priorityScoringService.scoreTransaction(tx);
      return { ...tx, priorityDetails: scoring };
    }).sort((a, b) => b.priorityDetails.score - a.priorityDetails.score);
  }, [filteredTransactions, priorityUpdateCount])

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

  const visibleRows = view === 'transactions' || view === 'priority-queue' ? filteredTransactions : filteredOperations

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
          <Tab id="priority-queue" label="Priority Queue" />
          <Tab id="operations" label="Operations" />
          <Tab id="graph" label="Graph" />
          <Tab id="time" label="Time" />
          <Tab id="networks" label="Networks" />
          <Tab id="clusters" label="Clusters" />
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
        ) : view === 'priority-queue' ? (
          'Intelligent transaction priority scoring queue & live learning parameters'
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
                      <PriorityBadge tx={tx} onUpdate={() => setPriorityUpdateCount(c => c + 1)} />
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
              <InfiniteScrollSentinel 
                onIntersect={handleLoadMoreTransactions}
                hasMore={txHasMore}
                loading={txPagingLoading}
                label="transactions"
              />
            </>
          )}
        </div>
      )}

      {view === 'priority-queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metrics & Weights Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Queue Metrics Card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Sparkles size={16} color="var(--cyan)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>QUEUE SUMMARY</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '80px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--red)' }}>
                      {prioritySortedQueue.filter(t => t.priorityDetails.level === 'High').length}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>HIGH PRIORITY</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '80px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--amber)' }}>
                      {prioritySortedQueue.filter(t => t.priorityDetails.level === 'Medium').length}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>MEDIUM</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '80px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                      {prioritySortedQueue.filter(t => t.priorityDetails.level === 'Low').length}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>LOW</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                User Overrides: {Object.keys(priorityScoringService.getOverrides()).length} active corrections
              </div>
            </div>

            {/* AI Model Weights Card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={16} color="var(--cyan)" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>AI ENGINE PARAMETERS</span>
                </div>
                <button
                  onClick={() => {
                    priorityScoringService.resetModel();
                    setPriorityUpdateCount(c => c + 1);
                  }}
                  title="Reset learning weights to defaults"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <RefreshCw size={10} />
                  Reset
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                {[
                  { label: 'Amount Size', val: priorityScoringService.getWeights().amountWeight },
                  { label: 'Transaction Fee', val: priorityScoringService.getWeights().feeWeight },
                  { label: 'Operation Count', val: priorityScoringService.getWeights().operationsWeight },
                  { label: 'Counterparty Relationship', val: priorityScoringService.getWeights().relationshipWeight },
                  { label: 'Urgency / Timing', val: priorityScoringService.getWeights().timingWeight },
                ].map((w, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', width: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.label}</span>
                    <div style={{ flex: 1, height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, w.val)}%`, height: '100%', background: 'var(--cyan)' }} />
                    </div>
                    <span style={{ color: 'var(--cyan)', width: '35px', textAlign: 'right' }}>{Math.round(w.val)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sorted Priority Queue Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <span>Priority Rank & Hash</span>
              <span>Ops / Score</span>
            </div>

            {prioritySortedQueue.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No transactions found
              </div>
            ) : (
              <>
                {prioritySortedQueue.map((tx, index) => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '12px 18px',
                      borderBottom: index < prioritySortedQueue.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'var(--transition)',
                    }}
                    onMouseEnter={(event) => event.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={(event) => event.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          width: '24px',
                        }}>
                          #{index + 1}
                        </span>
                        <PriorityBadge tx={tx} onUpdate={() => setPriorityUpdateCount(c => c + 1)} />
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
                        <div style={{ fontSize: '11px', color: 'var(--amber)', marginLeft: '32px' }}>
                          memo: {tx.memo}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '32px' }}>
                        fee: {tx.fee_charged} stroops
                      </div>
                      {tx.source_account && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '32px' }}>
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
              </>
            )}
          </div>
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
              <InfiniteScrollSentinel 
                onIntersect={handleLoadMoreOperations}
                hasMore={opsHasMore}
                loading={opsPagingLoading}
                label="operations"
              />
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

      {view === 'clusters' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', padding: '16px' }}>
          <Suspense fallback={
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Loading clusters...
            </div>
          }>
            <TransactionClusterView />
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
