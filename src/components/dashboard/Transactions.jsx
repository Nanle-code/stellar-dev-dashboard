import React, { useState, useMemo, useCallback, useRef } from 'react'
import { useStore } from '../../lib/store'
import { shortAddress, getOperationLabel, fetchTransactions, fetchOperations } from '../../lib/stellar'
import CopyableValue from './CopyableValue'
import { format } from 'date-fns'
import GlobalSearch from '../search/GlobalSearch'
import SearchFilters from '../search/SearchFilters'
import useSearch from '../../hooks/useSearch'
import { applyTransactionFilters, applyOperationFilters } from '../../lib/filters'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import { useVirtualScroll, VIRTUAL_SCROLL_THRESHOLD } from '../../hooks/useVirtualScroll'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50
const TX_ROW_HEIGHT = 72   // px — approximate fixed height per transaction row
const OP_ROW_HEIGHT = 80   // px — approximate fixed height per operation row
const VIRTUAL_CONTAINER_HEIGHT = 520 // px — max height of the scrollable list container

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingRows({ count = 5, height = TX_ROW_HEIGHT }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: `${height}px`,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid var(--border)',
            opacity: 1 - i * 0.15,
          }}
        >
          <div className="skeleton-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border-bright)', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="skeleton-pulse" style={{ height: '10px', width: '60%', borderRadius: '4px', background: 'var(--border-bright)' }} />
            <div className="skeleton-pulse" style={{ height: '8px', width: '35%', borderRadius: '4px', background: 'var(--border-bright)', opacity: 0.6 }} />
          </div>
          <div className="skeleton-pulse" style={{ width: '50px', height: '10px', borderRadius: '4px', background: 'var(--border-bright)' }} />
        </div>
      ))}
    </>
  )
}

function ScrollProgress({ loaded, hasMore, loading }) {
  return (
    <div
      style={{
        padding: '6px 18px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}
    >
      <span>{loaded.toLocaleString()} loaded</span>
      {hasMore && (
        <>
          <span style={{ color: 'var(--border-bright)' }}>·</span>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  border: '1.5px solid var(--cyan)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.6s linear infinite',
                }}
              />
              fetching more…
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>scroll to load more</span>
          )}
        </>
      )}
      {!hasMore && loaded > 0 && (
        <>
          <span style={{ color: 'var(--border-bright)' }}>·</span>
          <span>all loaded</span>
        </>
      )}
    </div>
  )
}

// ─── Transaction Row ──────────────────────────────────────────────────────────

function TxRow({ tx, network, style }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '12px',
        alignItems: 'center',
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        transition: 'background var(--transition)',
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
            ↗
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
  )
}

// ─── Operation Row ────────────────────────────────────────────────────────────

function OpRow({ op, style }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '12px',
        alignItems: 'center',
        padding: '12px 18px',
        borderBottom: '1px solid var(--border)',
        transition: 'background var(--transition)',
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
            from:{' '}
            <CopyableValue value={op.from} title="Copy source public key" textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {shortAddress(op.from)}
            </CopyableValue>
          </div>
        )}
        {op.to && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            to:{' '}
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
  )
}

// ─── Virtualised list (tx + ops) ─────────────────────────────────────────────
// useVirtualScroll already attaches its own scroll listener for virtualisation.
// We piggyback load-more detection in the same onScroll pass via a second
// passive listener attached AFTER the hook mounts — both listeners run
// in the same microtask frame so there is no double render.

function VirtualTxList({ items, network, onLoadMore, hasMore, loading }) {
  const { containerRef, virtualItems, totalHeight, offsetTop } = useVirtualScroll({
    items,
    itemHeight: TX_ROW_HEIGHT,
    containerHeight: VIRTUAL_CONTAINER_HEIGHT,
  })

  const lastLoadRef = useRef(0)
  const loadingRef = useRef(loading)
  const hasMoreRef = useRef(hasMore)
  // Keep refs current so the stable scroll handler reads fresh values
  React.useEffect(() => { loadingRef.current = loading }, [loading])
  React.useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])

  const onLoadMoreRef = useRef(onLoadMore)
  React.useEffect(() => { onLoadMoreRef.current = onLoadMore }, [onLoadMore])

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const check = () => {
      if (!hasMoreRef.current || loadingRef.current) return
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - TX_ROW_HEIGHT * 4
      if (nearBottom) {
        const now = Date.now()
        if (now - lastLoadRef.current >= 300) {
          lastLoadRef.current = now
          onLoadMoreRef.current()
        }
      }
    }
    el.addEventListener('scroll', check, { passive: true })
    return () => el.removeEventListener('scroll', check)
  }, [containerRef]) // stable ref — only re-attach if container mounts

  return (
    <div
      ref={containerRef}
      style={{ height: `${VIRTUAL_CONTAINER_HEIGHT}px`, overflowY: 'auto', position: 'relative' }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: `${offsetTop}px`, width: '100%' }}>
          {virtualItems.map(({ item: tx, index }) => (
            <TxRow key={tx.id || index} tx={tx} network={network} />
          ))}
          {loading && <LoadingRows count={3} height={TX_ROW_HEIGHT} />}
        </div>
      </div>
    </div>
  )
}

function VirtualOpList({ items, onLoadMore, hasMore, loading }) {
  const { containerRef, virtualItems, totalHeight, offsetTop } = useVirtualScroll({
    items,
    itemHeight: OP_ROW_HEIGHT,
    containerHeight: VIRTUAL_CONTAINER_HEIGHT,
  })

  const lastLoadRef = useRef(0)
  const loadingRef = useRef(loading)
  const hasMoreRef = useRef(hasMore)
  const onLoadMoreRef = useRef(onLoadMore)
  React.useEffect(() => { loadingRef.current = loading }, [loading])
  React.useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])
  React.useEffect(() => { onLoadMoreRef.current = onLoadMore }, [onLoadMore])

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const check = () => {
      if (!hasMoreRef.current || loadingRef.current) return
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - OP_ROW_HEIGHT * 4
      if (nearBottom) {
        const now = Date.now()
        if (now - lastLoadRef.current >= 300) {
          lastLoadRef.current = now
          onLoadMoreRef.current()
        }
      }
    }
    el.addEventListener('scroll', check, { passive: true })
    return () => el.removeEventListener('scroll', check)
  }, [containerRef])

  return (
    <div
      ref={containerRef}
      style={{ height: `${VIRTUAL_CONTAINER_HEIGHT}px`, overflowY: 'auto', position: 'relative' }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: `${offsetTop}px`, width: '100%' }}>
          {virtualItems.map(({ item: op, index }) => (
            <OpRow key={op.id || index} op={op} />
          ))}
          {loading && <LoadingRows count={3} height={OP_ROW_HEIGHT} />}
        </div>
      </div>
    </div>
  )
}

// ─── Non-virtual (small list) renderers ──────────────────────────────────────

function TxList({ items, network, onLoadMore, hasMore, loading }) {
  const sentinelRef = useInfiniteScroll(onLoadMore, hasMore, loading)

  return (
    <div style={{ overflowY: 'auto', maxHeight: `${VIRTUAL_CONTAINER_HEIGHT}px` }}>
      {items.map((tx, i) => (
        <TxRow key={tx.id} tx={tx} network={network} style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }} />
      ))}
      {loading && <LoadingRows count={3} height={TX_ROW_HEIGHT} />}
      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: '1px' }} aria-hidden="true" />
    </div>
  )
}

function OpList({ items, onLoadMore, hasMore, loading }) {
  const sentinelRef = useInfiniteScroll(onLoadMore, hasMore, loading)

  return (
    <div style={{ overflowY: 'auto', maxHeight: `${VIRTUAL_CONTAINER_HEIGHT}px` }}>
      {items.map((op, i) => (
        <OpRow key={op.id} op={op} style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }} />
      ))}
      {loading && <LoadingRows count={3} height={OP_ROW_HEIGHT} />}
      <div ref={sentinelRef} style={{ height: '1px' }} aria-hidden="true" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  } = useStore()

  const [view, setView] = useState('transactions')
  const { query, setQuery, filters, setFilters } = useSearch()
  const [showFilters, setShowFilters] = useState(false)

  // Track in-flight requests to prevent duplicate calls
  const txLoadingRef = useRef(false)
  const opsLoadingRef = useRef(false)

  const filteredTransactions = useMemo(() => {
    let list = transactions
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(tx =>
        tx.hash.toLowerCase().includes(q) ||
        (tx.memo && tx.memo.toLowerCase().includes(q))
      )
    }
    return applyTransactionFilters(list, filters)
  }, [transactions, query, filters])

  const filteredOperations = useMemo(() => {
    let list = operations
    if (query) {
      const q = query.toLowerCase()
      list = list.filter(op =>
        (op.from && op.from.toLowerCase().includes(q)) ||
        (op.to && op.to.toLowerCase().includes(q)) ||
        getOperationLabel(op.type).toLowerCase().includes(q)
      )
    }
    return applyOperationFilters(list, filters)
  }, [operations, query, filters])

  // Debounced load-more — guards against rapid duplicate calls from
  // both IntersectionObserver and scroll handlers firing together
  const handleLoadMoreTransactions = useCallback(async () => {
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

  const handleLoadMoreOperations = useCallback(async () => {
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

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'status') return value !== 'all'
    if (key === 'type') return value !== 'all'
    if (key === 'memoOnly') return value === true
    if (key === 'minFee' || key === 'maxFee') return value !== ''
    return false
  })

  const useVirtualTx = filteredTransactions.length >= VIRTUAL_SCROLL_THRESHOLD
  const useVirtualOp = filteredOperations.length >= VIRTUAL_SCROLL_THRESHOLD

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
    >{label}</button>
  )

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '300px' }}>
          <GlobalSearch value={query} onChange={setQuery} />
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
            <span style={{ fontSize: '16px' }}>⚙</span>
            <span>Filters</span>
            {hasActiveFilters && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan)' }} />
            )}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Tab id="transactions" label="Transactions" />
          <Tab id="operations" label="Operations" />
        </div>
      </div>

      {showFilters && (
        <SearchFilters filters={filters} onChange={setFilters} />
      )}

      {/* Transactions panel */}
      {view === 'transactions' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <span>Hash</span>
            <span>Ops · Time</span>
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
            // Normal infinite scroll for smaller lists
            <TxList
              items={filteredTransactions}
              network={network}
              onLoadMore={handleLoadMoreTransactions}
              hasMore={txHasMore}
              loading={txPagingLoading}
            />
          )}

          {/* Footer progress bar */}
          {!txLoading && filteredTransactions.length > 0 && (
            <ScrollProgress
              loaded={filteredTransactions.length}
              hasMore={txHasMore}
              loading={txPagingLoading}
            />
          )}
        </div>
      )}

      {/* Operations panel */}
      {view === 'operations' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <span>Type · Details</span>
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
            <OpList
              items={filteredOperations}
              onLoadMore={handleLoadMoreOperations}
              hasMore={opsHasMore}
              loading={opsPagingLoading}
            />
          )}

          {!opsLoading && filteredOperations.length > 0 && (
            <ScrollProgress
              loaded={filteredOperations.length}
              hasMore={opsHasMore}
              loading={opsPagingLoading}
            />
          )}
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
