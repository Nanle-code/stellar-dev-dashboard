import React from 'react'
import { usePreferences } from '../../hooks/usePreferences'

const AVAILABLE_WIDGETS = [
  { type: 'balance', label: 'Balance', icon: '💰', description: 'XLM and asset balances' },
  { type: 'assets', label: 'Assets', icon: '💎', description: 'Trustlines and tokens' },
  { type: 'transactions', label: 'Transactions', icon: '⇄', description: 'Recent transaction history' },
  { type: 'networkStats', label: 'Network Stats', icon: '◎', description: 'Ledger and fee stats' },
  { type: 'accountStats', label: 'Account Stats', icon: '◉', description: 'Account details' },
  { type: 'quickActions', label: 'Quick Actions', icon: '⚡', description: 'Common actions' },
  { type: 'priceTicker', label: 'Price Ticker', icon: '📈', description: 'XLM price feed' },
]

export default function DashboardCustomizer({ currentWidgets = [], onLayoutChange }) {
  const { preferences, update } = usePreferences()

  const activeTypes = new Set(currentWidgets.map((w) => w.type))

  const handleToggle = (widgetType) => {
    if (activeTypes.has(widgetType)) {
      const next = currentWidgets.filter((w) => w.type !== widgetType)
      onLayoutChange?.(next)
    } else {
      const newWidget = {
        id: `${widgetType}-${Date.now()}`,
        type: widgetType,
        span: 1,
        order: currentWidgets.length,
      }
      onLayoutChange?.([...currentWidgets, newWidget])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        Toggle Widgets
      </div>
      {AVAILABLE_WIDGETS.map((widget) => {
        const isActive = activeTypes.has(widget.type)
        return (
          <div
            key={widget.type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              background: isActive ? 'var(--cyan-glow-sm)' : 'var(--bg-elevated)',
              border: `1px solid ${isActive ? 'var(--cyan-dim)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
            onClick={() => handleToggle(widget.type)}
          >
            <span style={{ fontSize: '18px' }}>{widget.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {widget.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {widget.description}
              </div>
            </div>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: isActive ? 'var(--cyan)' : 'var(--bg-card)',
              border: `1px solid ${isActive ? 'var(--cyan)' : 'var(--border-bright)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: isActive ? 'var(--bg-base)' : 'transparent',
              flexShrink: 0,
            }}>
              ✓
            </div>
          </div>
        )
      })}
    </div>
  )
}
