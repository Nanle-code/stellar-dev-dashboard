import React, { useEffect, useMemo } from 'react'
import { useStore } from '../../lib/store'
import { fetchPrices, calculatePortfolioValue } from '../../lib/priceFeed'
import Card from './Card'

export default function PortfolioValue() {
  const { accountData, prices, setPrices, pricesLoading, setPricesLoading, setPricesError } = useStore()

  const balances = accountData?.balances || []

  // Determine which asset codes we need prices for
  const assetCodes = useMemo(() => {
    return balances.map((b) =>
      b.asset_type === 'native' ? 'XLM' : b.asset_code
    ).filter(Boolean)
  }, [balances])

  useEffect(() => {
    if (assetCodes.length === 0) return
    let cancelled = false

    const load = async () => {
      setPricesLoading(true)
      try {
        const fetched = await fetchPrices(assetCodes)
        if (!cancelled) setPrices({ ...prices, ...fetched })
      } catch (err) {
        if (!cancelled) setPricesError(err.message)
      } finally {
        if (!cancelled) setPricesLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [assetCodes.join(',')])

  const portfolio = useMemo(
    () => calculatePortfolioValue(balances, prices),
    [balances, prices]
  )

  if (!accountData) {
    return (
      <Card title="Portfolio Value" subtitle="Connect an account to view">
        <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          No account connected
        </div>
      </Card>
    )
  }

  return (
    <Card title="Portfolio Value" subtitle="Estimated USD value of holdings">
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Total value */}
        <div style={{
          padding: '20px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
            TOTAL VALUE
          </div>
          {pricesLoading ? (
            <div className="spinner" style={{ margin: '8px auto' }} />
          ) : (
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700,
              color: 'var(--cyan)',
            }}>
              {portfolio?.totalUsd !== undefined
                ? `$${portfolio.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'
              }
            </div>
          )}
        </div>

        {/* Asset breakdown */}
        {portfolio?.items && portfolio.items.length > 0 && (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
              padding: '8px 12px', fontSize: '10px', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '1px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span>Asset</span>
              <span style={{ textAlign: 'right' }}>Balance</span>
              <span style={{ textAlign: 'right' }}>Price</span>
              <span style={{ textAlign: 'right' }}>Value</span>
            </div>

            {portfolio.items.map((item, i) => (
              <div
                key={item.code + i}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  padding: '10px 12px', fontSize: '12px',
                  borderBottom: i < portfolio.items.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {item.code}
                  {item.change24h !== null && (
                    <span style={{
                      fontSize: '10px', marginLeft: '6px',
                      color: item.change24h >= 0 ? 'var(--green)' : 'var(--red)',
                    }}>
                      {item.change24h >= 0 ? '↑' : '↓'}
                    </span>
                  )}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {item.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {item.priceUsd !== null ? `$${item.priceUsd.toFixed(4)}` : '—'}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
                  {item.valueUsd !== null ? `$${item.valueUsd.toFixed(2)}` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
