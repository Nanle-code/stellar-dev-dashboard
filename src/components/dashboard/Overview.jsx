import React, { useEffect } from 'react'
import { useStore } from '../../lib/store'
import { fetchNetworkStats, formatXLM, shortAddress } from '../../lib/stellar'
import { StatCard } from './Card'
import { format } from 'date-fns'

export default function Overview() {
  const {
    accountData, transactions, operations, network,
    networkStats, setNetworkStats, statsLoading, setStatsLoading,
    connectedAddress, txLoading, opsLoading,
  } = useStore()

  useEffect(() => {
    setStatsLoading(true)
    fetchNetworkStats(network)
      .then(s => setNetworkStats(s))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [network])

  const xlmBalance = accountData?.balances?.find(b => b.asset_type === 'native')
  const otherAssets = accountData?.balances?.filter(b => b.asset_type !== 'native') || []
  const ledger = networkStats?.latestLedger
  const feeStats = networkStats?.feeStats

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
            Overview
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            {shortAddress(connectedAddress, 8)}
          </div>
        </div>
        <div style={{
          padding: '6px 12px',
          background: network === 'testnet' ? 'var(--amber-glow)' : 'var(--green-glow)',
          border: `1px solid ${network === 'testnet' ? 'var(--amber)' : 'var(--green)'}`,
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          color: network === 'testnet' ? 'var(--amber)' : 'var(--green)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          {network}
        </div>
      </div>

      {/* Account Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard
          label="XLM Balance"
          value={xlmBalance ? formatXLM(xlmBalance.balance) : '—'}
          sub="lumens"
          accent="var(--cyan)"
        />
        <StatCard
          label="Assets"
          value={otherAssets.length}
          sub="non-native"
          accent="var(--amber)"
        />
        <StatCard
          label="Transactions"
          value={txLoading ? null : transactions.length}
          sub="recent 20"
          loading={txLoading}
        />
        <StatCard
          label="Sequence"
          value={accountData?.sequence ? accountData.sequence.slice(-8) + '…' : '—'}
          sub="ledger seq"
        />
      </div>

      {/* Assets */}
      {otherAssets.length > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
            Asset Holdings
          </div>
          <div style={{ padding: '4px 0' }}>
            {otherAssets.map((asset, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 18px',
                borderBottom: i < otherAssets.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'var(--transition)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {asset.asset_code || asset.asset_type}
                  </span>
                  {asset.asset_issuer && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '8px' }}>
                      {shortAddress(asset.asset_issuer)}
                    </span>
                  )}
                </div>
                <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
                  {formatXLM(asset.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Recent Transactions</div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>latest 5</span>
        </div>
        {txLoading ? (
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        ) : transactions.slice(0, 5).map((tx, i) => (
          <div key={tx.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 18px',
            borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
            transition: 'var(--transition)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: tx.successful ? 'var(--green)' : 'var(--red)',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }} className="truncate">
                {tx.hash}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {tx.operation_count} op{tx.operation_count !== 1 ? 's' : ''} · {format(new Date(tx.created_at), 'MMM d, HH:mm')}
              </div>
            </div>
            <a
              href={`https://stellar.expert/explorer/${network}/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '11px', color: 'var(--cyan)', flexShrink: 0 }}
            >
              ↗
            </a>
          </div>
        ))}
      </div>

      {/* Network stats */}
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '10px' }}>NETWORK STATS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <StatCard
            label="Latest Ledger"
            value={ledger?.sequence?.toLocaleString() ?? '—'}
            loading={statsLoading}
            accent="var(--text-secondary)"
          />
          <StatCard
            label="Base Fee"
            value={feeStats ? feeStats.last_ledger_base_fee + ' stroops' : '—'}
            loading={statsLoading}
            accent="var(--text-secondary)"
          />
          <StatCard
            label="Ledger Close"
            value={ledger ? format(new Date(ledger.closed_at), 'HH:mm:ss') : '—'}
            sub={ledger ? format(new Date(ledger.closed_at), 'MMM d, yyyy') : ''}
            loading={statsLoading}
            accent="var(--text-secondary)"
          />
        </div>
      </div>

    </div>
  )
}
