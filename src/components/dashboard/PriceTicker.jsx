import React, { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import { fetchXLMPrice } from '../../lib/priceFeed'

export default function PriceTicker() {
  const { prices, setPrices, setPricesLoading, setPricesError } = useStore()
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadPrice = async () => {
      setPricesLoading(true)
      try {
        const xlmPrice = await fetchXLMPrice()
        if (!cancelled) {
          setPrices({ ...prices, XLM: xlmPrice })
          setLastUpdated(new Date())
        }
      } catch (err) {
        if (!cancelled) setPricesError(err.message)
      } finally {
        if (!cancelled) setPricesLoading(false)
      }
    }

    loadPrice()

    // Refresh every 60 seconds
    const interval = setInterval(loadPrice, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const xlm = prices?.XLM
  const changeColor = xlm?.usd_24h_change >= 0 ? 'var(--green)' : 'var(--red)'
  const changeSign = xlm?.usd_24h_change >= 0 ? '+' : ''

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 14px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      fontSize: '12px',
      fontFamily: 'var(--font-mono)',
    }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.5px' }}>XLM</span>

      {xlm?.usd !== null && xlm?.usd !== undefined ? (
        <>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            ${xlm.usd.toFixed(4)}
          </span>
          {xlm.usd_24h_change !== null && (
            <span style={{
              color: changeColor,
              fontSize: '11px',
              padding: '2px 6px',
              background: xlm.usd_24h_change >= 0 ? 'var(--green-glow)' : 'var(--red-glow)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {changeSign}{xlm.usd_24h_change.toFixed(2)}%
            </span>
          )}
        </>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      )}

      {lastUpdated && (
        <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: 'auto' }}>
          {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}
