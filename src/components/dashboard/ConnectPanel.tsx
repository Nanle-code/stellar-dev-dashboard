import React, { useState, type CSSProperties, type KeyboardEvent } from 'react'
import { announceToScreenReader } from '../../utils/accessibility'
import { useStore } from '../../lib/store'
import {
  isValidPublicKey,
  fetchAccount,
  fetchTransactions,
  fetchOperations,
  resolveAddress,
} from '../../lib/stellar'
import { stellarCacheManager } from '../../lib/cacheManager'
import { getOnlineStatus } from '../../utils/offline'
import { useResponsive } from '../../hooks/useResponsive'
import { ResponsiveGrid } from '../layout/ResponsiveContainer'

interface FeatureTile {
  icon: string
  label: string
  desc: string
}

const FEATURES: FeatureTile[] = [
  { icon: '◉', label: 'Account & Balances', desc: 'Assets, sequence number, thresholds' },
  { icon: '⇄', label: 'Transactions', desc: 'Full history, operations, memos' },
  { icon: '◻', label: 'Soroban Contracts', desc: 'Contract data & interaction' },
]

interface AddressInfo {
  masterAccount: string
  muxedId?: string
  federated?: string
}

export default function ConnectPanel() {
  const [input, setInput] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [addressInfo, setAddressInfo] = useState<AddressInfo | null>(null)
  const { isMobile, isTablet } = useResponsive()
  const {
    network,
    setConnectedAddress,
    setAccountData,
    setAccountLoading,
    setTransactions,
    setTxLoading,
    setOperations,
    setOpsLoading,
    setActiveTab,
    setTxNextCursor,
    setTxHasMore,
    setOpsNextCursor,
    setOpsHasMore,
  } = useStore()

  async function handleConnect(): Promise<void> {
    const addr = input.trim()
    if (!isValidPublicKey(addr)) {
      setError('Invalid Stellar address. Supported formats: G... (Ed25519), M... (muxed), or name*domain (federated)')
      setAddressInfo(null)
      return
    }
    setError('')
    setAccountLoading(true)
    
    try {
      // Resolve the address (handles G, M, and federated formats)
      const resolved = await resolveAddress(addr, network)
      
      if (!resolved) {
        setError('Failed to resolve address')
        setAddressInfo(null)
        setAccountLoading(false)
        return
      }

      // Store the resolved address info
      setAddressInfo({
        masterAccount: resolved.accountId,
        muxedId: resolved.muxedId,
        federated: resolved.federatedAddress,
      })

      // Fetch account data for the master account
      let account
      const online = getOnlineStatus()

      if (!online) {
        // Offline — try to serve from cache
        const cached = await stellarCacheManager.getWithFallback(
          `account:${resolved.accountId}:${network}`,
        )
        if (cached.value) {
          account = cached.value
        } else {
          setError('You are offline and no cached data is available for this account.')
          setAddressInfo(null)
          setAccountLoading(false)
          return
        }
      } else {
        account = await fetchAccount(resolved.accountId, network)
      }

      setConnectedAddress(resolved.accountId)
      setAccountData(account)
      setActiveTab('overview')

      // Persist account data for offline reads (TTL 5 min)
      if (online) {
        stellarCacheManager
          .set(`account:${resolved.accountId}:${network}`, account, 300_000, ['account'])
          .catch(() => {})
      }
      announceToScreenReader('Connected to account ' + resolved.accountId.slice(0, 8) + '...')

      if (!online) return  // skip background fetches when offline

      setTxLoading(true)
      setOpsLoading(true)
      
      fetchTransactions(resolved.accountId, network, 50)
        .then(({ records, nextCursor, hasMore }) => {
          setTransactions(records)
          setTxNextCursor(nextCursor)
          setTxHasMore(hasMore)
        })
        .catch(() => {
          setTransactions([])
          setTxNextCursor(null)
          setTxHasMore(false)
        })
        .finally(() => {
          setTxLoading(false)
        })

      fetchOperations(resolved.accountId, network, 50)
        .then(({ records, nextCursor, hasMore }) => {
          setOperations(records)
          setOpsNextCursor(nextCursor)
          setOpsHasMore(hasMore)
        })
        .catch(() => {
          setOperations([])
          setOpsNextCursor(null)
          setOpsHasMore(false)
        })
        .finally(() => {
          setOpsLoading(false)
        })
    } catch (err) {
      setError((err as Error)?.message || 'Account not found on ' + network)
      setAddressInfo(null)
    } finally {
      setAccountLoading(false)
    }
  }

  const containerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isMobile ? '50vh' : '60vh',
    gap: isMobile ? '24px' : '32px',
    padding: isMobile ? '20px' : '0',
  }

  const titleStyles: CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: isMobile ? '32px' : isTablet ? '36px' : '42px',
    fontWeight: 800,
    color: 'var(--cyan)',
    letterSpacing: '-1px',
    lineHeight: 1,
    marginBottom: '10px',
  }

  const subtitleStyles: CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: isMobile ? '16px' : '20px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  }

  const addressLabelStyles: CSSProperties = {
    fontSize: isMobile ? '13px' : '12px',
    color: 'var(--text-muted)',
    marginTop: '16px',
    padding: isMobile ? '12px 20px' : '0',
  }

  const addressDisplayStyles: CSSProperties = {
    fontSize: isMobile ? '12px' : '11px',
    color: 'var(--cyan)',
    marginTop: '4px',
    padding: isMobile ? '0 20px' : '0',
    fontFamily: 'var(--font-mono)',
    wordBreak: 'break-all',
  }

  const inputContainerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? '12px' : '10px',
    background: 'var(--bg-card)',
    border: `1px solid ${error ? 'var(--red)' : 'var(--border-bright)'}`,
    borderRadius: 'var(--radius-lg)',
    padding: isMobile ? '16px' : '6px 6px 6px 16px',
    transition: 'var(--transition)',
    width: '100%',
    maxWidth: isMobile ? '100%' : '540px',
  }

  const inputStyles: CSSProperties = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: isMobile ? '16px' : '13px',
    fontFamily: 'var(--font-mono)',
    padding: 0,
  }

  const buttonStyles: CSSProperties = {
    padding: isMobile ? '12px 20px' : '9px 20px',
    background: 'var(--cyan)',
    color: 'var(--bg-base)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: isMobile ? '14px' : '13px',
    cursor: 'pointer',
    transition: 'var(--transition)',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    width: isMobile ? '100%' : 'auto',
    minHeight: isMobile ? 'var(--touch-target)' : 'auto',
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleConnect()
  }

  return (
    <div style={containerStyles}>
      <div style={{ textAlign: 'center' }}>
        <div style={titleStyles}>✦ STELLAR</div>
        <div style={subtitleStyles}>Developer Dashboard</div>
        <div
          style={{
            fontSize: isMobile ? '13px' : '12px',
            color: 'var(--text-muted)',
            marginTop: '8px',
            padding: isMobile ? '0 20px' : '0',
          }}
        >
          Enter a Stellar address: G... • M... • name*domain
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: isMobile ? '100%' : '540px' }}>
        <div style={inputContainerStyles}>
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setError('')
            }}
            onKeyDown={handleKeyDown}
            placeholder="G... public key, M... muxed, or name*domain"
            style={inputStyles}
          />
          <button
            onClick={() => void handleConnect()}
            style={buttonStyles}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--cyan-dim)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--cyan)'
            }}
          >
            CONNECT →
          </button>
        </div>
        {error && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '12px',
              color: 'var(--red)',
              paddingLeft: '4px',
              textAlign: isMobile ? 'center' : 'left',
            }}
          >
            ✗ {error}
          </div>
        )}
        {addressInfo && (
          <div style={addressLabelStyles}>
            <div>Master Account:</div>
            <div style={addressDisplayStyles}>{addressInfo.masterAccount}</div>
            {addressInfo.muxedId && (
              <>
                <div style={{ marginTop: '8px' }}>Muxed ID:</div>
                <div style={addressDisplayStyles}>{addressInfo.muxedId}</div>
              </>
            )}
            {addressInfo.federated && (
              <>
                <div style={{ marginTop: '8px' }}>Federated Address:</div>
                <div style={addressDisplayStyles}>{addressInfo.federated}</div>
              </>
            )}
          </div>
        )}
      </div>

      <ResponsiveGrid
        columns={{ mobile: 1, tablet: 3, desktop: 3 }}
        gap={{ mobile: '12px', tablet: '12px', desktop: '12px' }}
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '540px',
        }}
      >
        {FEATURES.map((f) => (
          <div
            key={f.label}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: isMobile ? '16px' : '14px',
              textAlign: isMobile ? 'center' : 'left',
            }}
          >
            <div style={{ fontSize: isMobile ? '24px' : '18px', marginBottom: '6px' }}>
              {f.icon}
            </div>
            <div
              style={{
                fontSize: isMobile ? '14px' : '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '3px',
              }}
            >
              {f.label}
            </div>
            <div
              style={{
                fontSize: isMobile ? '12px' : '11px',
                color: 'var(--text-muted)',
                lineHeight: 1.4,
              }}
            >
              {f.desc}
            </div>
          </div>
        ))}
      </ResponsiveGrid>
    </div>
  )
}
