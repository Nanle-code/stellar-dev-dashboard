import React from 'react'
import { useStore } from '../../lib/store'

// Mirrors the most-used tabs; full nav is in the sidebar (hamburger menu).
const QUICK_NAV = [
  { id: 'overview',      label: 'Home',    icon: '◈' },
  { id: 'transactions',  label: 'Txns',    icon: '⇄' },
  { id: 'dex',           label: 'DEX',     icon: '⇌' },
  { id: 'wallet',        label: 'Wallet',  icon: '⊡' },
  { id: 'settings',      label: 'Settings', icon: '⚙' },
]

export default function MobileNavigation() {
  const { activeTab, setActiveTab } = useStore()

  return (
    <nav
      className="mobile-nav-bar"
      role="navigation"
      aria-label="Mobile navigation"
    >
      {QUICK_NAV.map((item) => {
        const isActive = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              flex: 1,
              height: '100%',
              background: 'transparent',
              border: 'none',
              color: isActive ? 'var(--cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'color 180ms ease',
              padding: '4px 0',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: '9px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {item.label}
            </span>
            {isActive && (
              <span style={{
                position: 'absolute',
                bottom: 'calc(60px - 3px)',
                width: '20px',
                height: '2px',
                background: 'var(--cyan)',
                borderRadius: '1px',
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
