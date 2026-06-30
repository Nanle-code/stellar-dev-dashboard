import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { fetchXLMPrice } from '../../lib/priceFeed';
import { RefreshCw } from 'lucide-react';

export default function PriceTicker() {
  const { prices, setPrices, setPricesLoading, setPricesError } = useStore();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadPrice = useCallback(async (forceRefresh = false) => {
    setPricesLoading(true);
    try {
      const xlmPrice = await fetchXLMPrice({ forceRefresh });
      setPrices({ ...prices, XLM: xlmPrice });
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPricesError(message);
    } finally {
      setPricesLoading(false);
    }
  }, [prices, setPrices, setPricesLoading, setPricesError]);

  useEffect(() => {
    loadPrice();

    const interval = setInterval(() => loadPrice(), 60_000);
    return () => clearInterval(interval);
  }, [loadPrice]);

  const xlm = prices?.XLM;
  const changeColor = xlm?.usd_24h_change != null && xlm.usd_24h_change >= 0 ? 'var(--green)' : 'var(--red)';
  const changeSign = xlm?.usd_24h_change != null && xlm.usd_24h_change >= 0 ? '+' : '';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.5px' }}>
        XLM
      </span>

      {xlm?.usd !== null && xlm?.usd !== undefined ? (
        <>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            ${xlm.usd.toFixed(4)}
          </span>
          {xlm.usd_24h_change !== null && (
            <span
              style={{
                color: changeColor,
                fontSize: '11px',
                padding: '2px 6px',
                background: xlm.usd_24h_change >= 0 ? 'var(--green-glow)' : 'var(--red-glow)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {changeSign}
              {xlm.usd_24h_change.toFixed(2)}%
            </span>
          )}
        </>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>—</span>
      )}
      <button
        type="button"
        onClick={() => loadPrice(true)}
        title="Refresh price cache"
        aria-label="Refresh XLM price"
        style={{
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-muted)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          padding: '2px 5px',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <RefreshCw size={12} />
      </button>
      {lastUpdated && (
        <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: 'auto' }}>
          {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}
