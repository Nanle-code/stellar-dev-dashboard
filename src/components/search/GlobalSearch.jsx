import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useStore } from '../../lib/store'
import { getServer, isValidPublicKey, isValidContractId } from '../../lib/stellar'

// Result type icons
const TYPE_ICON = {
  account: '◉',
  transaction: '⇄',
  contract: '◻',
}

const TYPE_LABEL = {
  account: 'Account',
  transaction: 'Transaction',
  contract: 'Contract',
}

/**
 * Detect what kind of query the user typed.
 * Stellar public keys start with G and are 56 chars.
 * Transaction hashes are 64-char hex strings.
 * Contract IDs are also Stellar addresses (C...).
 */
function classifyQuery(q) {
  const trimmed = q.trim()
  if (!trimmed) return null
  if (isValidPublicKey(trimmed)) return 'account'
  if (isValidContractId(trimmed)) return 'contract'
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return 'transaction'
  return 'text'
}

/**
 * Search Horizon for the given query.
 * Returns an array of { id, type, label, meta, raw } objects.
 */
async function horizonSearch(query, network) {
  const server = getServer(network)
  const trimmed = query.trim()
  const kind = classifyQuery(trimmed)
  const results = []

  if (kind === 'account') {
    try {
      const account = await server.loadAccount(trimmed)
      const xlmBalance = account.balances.find(b => b.asset_type === 'native')
      results.push({
        id: `account:${trimmed}`,
        type: 'account',
        label: trimmed,
        meta: xlmBalance ? `${parseFloat(xlmBalance.balance).toFixed(2)} XLM` : '',
        raw: account,
      })
    } catch {
      // Not found – no result
    }
    return results
  }

  if (kind === 'transaction') {
    try {
      const tx = await server.transactions().transaction(trimmed).call()
      results.push({
        id: `tx:${trimmed}`,
        type: 'transaction',
        label: trimmed,
        meta: `${tx.operation_count} op${tx.operation_count !== 1 ? 's' : ''} · ${tx.successful ? '✓' : '✗'}`,
        raw: tx,
      })
    } catch {
      // Not found
    }
    return results
  }

  if (kind === 'contract') {
    results.push({
      id: `contract:${trimmed}`,
      type: 'contract',
      label: trimmed,
      meta: 'Soroban contract',
      raw: { contractId: trimmed },
    })
    return results
  }

  // Free-text: search accounts by federation-like prefix (best-effort)
  // Horizon doesn't support full-text search, so we return a hint.
  if (trimmed.length >= 3) {
    results.push({
      id: `hint:${trimmed}`,
      type: 'transaction',
      label: `Search for "${trimmed}"`,
      meta: 'Enter a full account ID, tx hash, or contract ID for exact results',
      raw: null,
      isHint: true,
    })
  }

  return results
}

export default function GlobalSearch({ onSelectResult }) {
  const { network } = useStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  const runSearch = useCallback(async (q) => {
    if (!q.trim() || q.trim().length < 3) {
      setResults([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const found = await horizonSearch(q, network)
      setResults(found)
    } catch (err) {
      setError('Search failed. Check your network connection.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [network])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, runSearch])

  const handleSelect = (result) => {
    if (result.isHint) return
    setOpen(false)
    setQuery('')
    onSelectResult?.(result)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setError(null)
    inputRef.current?.focus()
  }

  const showDropdown = open && (query.trim().length >= 3)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Input row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 10px',
      }}>
        {loading
          ? <div className="spinner" style={{ width: 15, height: 15, flexShrink: 0 }} />
          : <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        }
        <input
          ref={inputRef}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by account ID, tx hash, or contract ID…"
          aria-label="Global search"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        />
        {query && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
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

      {/* Dropdown */}
      {showDropdown && (
        <div
          role="listbox"
          aria-label="Search results"
          style={{
            position: 'absolute',
            zIndex: 1200,
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            maxHeight: '320px',
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          {error && (
            <div style={{ padding: '12px', fontSize: '12px', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          {!error && results.length === 0 && !loading && (
            <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
              No results. Try a full account ID, 64-char tx hash, or contract address.
            </div>
          )}

          {results.map((result) => (
            <button
              key={result.id}
              role="option"
              aria-selected="false"
              onClick={() => handleSelect(result)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: 'transparent',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: result.isHint ? 'default' : 'pointer',
                opacity: result.isHint ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!result.isHint) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '16px', flexShrink: 0 }}>
                {TYPE_ICON[result.type] || '◈'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {result.label}
                </div>
                {result.meta && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                    {TYPE_LABEL[result.type] || result.type}
                    {result.meta ? ` · ${result.meta}` : ''}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
