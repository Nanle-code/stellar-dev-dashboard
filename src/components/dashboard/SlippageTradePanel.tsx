import React, { useState, useMemo } from 'react'
import {
  calculatePriceImpactAndSlippage,
  type OrderBookData,
  type AmmPoolData,
  type SlippageCalculationResult,
} from '../../lib/slippageProtection'

export interface SlippageTradePanelProps {
  sellingAsset?: string
  buyingAsset?: string
  orderbook?: OrderBookData | null
  pool?: AmmPoolData | null
  onBuildTrade?: (result: SlippageCalculationResult & { operationParams: any }) => void
}

export function SlippageTradePanel({
  sellingAsset = 'native',
  buyingAsset = 'USDC:G...',
  orderbook,
  pool,
  onBuildTrade,
}: SlippageTradePanelProps) {
  const [tradeType, setTradeType] = useState<'sell' | 'buy'>('sell')
  const [amount, setAmount] = useState<string>('100')
  const [presetSlippage, setPresetSlippage] = useState<number>(0.5)
  const [customSlippage, setCustomSlippage] = useState<string>('')
  const [builtTradeSuccess, setBuiltTradeSuccess] = useState<string | null>(null)

  const activeSlippage = useMemo(() => {
    if (customSlippage.trim() !== '') {
      const parsed = parseFloat(customSlippage)
      return isNaN(parsed) ? 0.5 : parsed
    }
    return presetSlippage
  }, [presetSlippage, customSlippage])

  const calculation: SlippageCalculationResult = useMemo(() => {
    return calculatePriceImpactAndSlippage({
      tradeType,
      amount,
      orderbook,
      pool,
      slippageTolerancePercent: activeSlippage,
    })
  }, [tradeType, amount, orderbook, pool, activeSlippage])

  const parseCode = (assetStr: string) => {
    if (!assetStr || assetStr === 'native' || assetStr === 'XLM') return 'XLM'
    return assetStr.split(':')[0] || assetStr
  }

  const sellCode = parseCode(sellingAsset)
  const buyCode = parseCode(buyingAsset)

  const handleBuildTrade = () => {
    if (!calculation.isValid) return

    const operationParams = {
      type: tradeType === 'sell' ? 'pathPaymentStrictSend' : 'pathPaymentStrictReceive',
      sendAsset: sellingAsset,
      destAsset: buyingAsset,
      amount: Number(amount),
      minimumReceived: calculation.minimumReceived,
      maximumSent: calculation.maximumSent,
      slippageProtectionPercent: calculation.slippageTolerancePercent,
      executionPrice: calculation.executionPrice,
    }

    setBuiltTradeSuccess(
      `Trade Built Successfully! Protected ${tradeType === 'sell' ? 'destMin' : 'sendMax'}: ${calculation.minimumReceived.toFixed(
        4
      )} ${buyCode} (Slippage: ${calculation.slippageTolerancePercent}%)`
    )

    if (onBuildTrade) {
      onBuildTrade({ ...calculation, operationParams })
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'var(--cyan)'
      case 'medium':
        return 'var(--amber, #f59e0b)'
      case 'high':
      case 'critical':
        return 'var(--red, #ef4444)'
      default:
        return 'var(--text-secondary)'
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600 }}>
            Trade Execution & Slippage Protection
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Calculates real-time price impact and enforces user-defined minimum receive limits.
          </div>
        </div>

        {/* Trade Type Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
          <button
            onClick={() => setTradeType('sell')}
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: tradeType === 'sell' ? 700 : 500,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: tradeType === 'sell' ? 'var(--cyan)' : 'transparent',
              color: tradeType === 'sell' ? 'var(--bg-base)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Sell {sellCode}
          </button>
          <button
            onClick={() => setTradeType('buy')}
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: tradeType === 'buy' ? 700 : 500,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: tradeType === 'buy' ? 'var(--cyan)' : 'transparent',
              color: tradeType === 'buy' ? 'var(--bg-base)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Buy {buyCode}
          </button>
        </div>
      </div>

      {/* Input controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
            {tradeType === 'sell' ? `Sell Amount (${sellCode})` : `Buy Amount (${buyCode})`}
          </label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            aria-label="Trade amount"
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Slippage tolerance controls */}
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
            Slippage Protection Tolerance (%)
          </label>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[0.1, 0.5, 1.0, 3.0].map(val => (
              <button
                key={val}
                onClick={() => {
                  setPresetSlippage(val)
                  setCustomSlippage('')
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  border: `1px solid ${presetSlippage === val && customSlippage === '' ? 'var(--cyan)' : 'var(--border)'}`,
                  background: presetSlippage === val && customSlippage === '' ? 'rgba(34,211,238,0.15)' : 'var(--bg-elevated)',
                  color: presetSlippage === val && customSlippage === '' ? 'var(--cyan)' : 'var(--text-secondary)',
                  fontWeight: presetSlippage === val && customSlippage === '' ? 700 : 500,
                }}
              >
                {val}%
              </button>
            ))}
            <input
              type="number"
              value={customSlippage}
              onChange={e => setCustomSlippage(e.target.value)}
              placeholder="Custom %"
              aria-label="Custom slippage percentage"
              style={{
                width: '75px',
                padding: '6px 8px',
                background: 'var(--bg-elevated)',
                border: `1px solid ${customSlippage ? 'var(--cyan)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Metrics & Price Impact Display */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
        }}
      >
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spot Price</div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {calculation.spotPrice > 0 ? calculation.spotPrice.toFixed(4) : '—'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Execution Price</div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {calculation.executionPrice > 0 ? calculation.executionPrice.toFixed(4) : '—'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Price Impact</div>
          <div style={{ fontSize: '12px', color: getRiskColor(calculation.riskLevel), fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {calculation.priceImpactPercent.toFixed(2)}%
          </div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {tradeType === 'sell' ? `Min Received (${buyCode})` : `Max Sent (${sellCode})`}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {calculation.minimumReceived > 0 ? calculation.minimumReceived.toFixed(4) : '—'}
          </div>
        </div>
      </div>

      {/* Warnings & Enforced Error Alerts */}
      {calculation.error && (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--red, #ef4444)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--red, #ef4444)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <strong>Trade Protected:</strong> {calculation.error}
        </div>
      )}

      {!calculation.error && calculation.warning && (
        <div
          role="status"
          style={{
            padding: '10px 12px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid var(--amber, #f59e0b)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--amber, #f59e0b)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <strong>Warning:</strong> {calculation.warning}
        </div>
      )}

      {builtTradeSuccess && (
        <div
          style={{
            padding: '10px 12px',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid var(--green, #22c55e)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--green, #22c55e)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {builtTradeSuccess}
        </div>
      )}

      {/* Build Trade Button */}
      <button
        onClick={handleBuildTrade}
        disabled={!calculation.isValid}
        style={{
          width: '100%',
          padding: '10px',
          border: `1px solid ${calculation.isValid ? 'var(--cyan)' : 'var(--border)'}`,
          background: calculation.isValid ? 'var(--cyan)' : 'var(--bg-elevated)',
          color: calculation.isValid ? 'var(--bg-base)' : 'var(--text-muted)',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          cursor: calculation.isValid ? 'pointer' : 'not-allowed',
        }}
      >
        {calculation.isValid
          ? `Build Protected Trade (${activeSlippage}% Slippage Guard)`
          : 'Trade Blocked by Slippage Protection'}
      </button>
    </div>
  )
}

export default SlippageTradePanel
