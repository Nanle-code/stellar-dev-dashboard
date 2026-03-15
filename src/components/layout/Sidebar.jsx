import React from 'react'
import { useStore } from '../../lib/store'

const NAV_ITEMS = [
  { id: 'overview',     label: 'Overview',       icon: '◈' },
  { id: 'account',      label: 'Account',         icon: '◉' },
  { id: 'transactions', label: 'Transactions',    icon: '⇄' },
  { id: 'contracts',    label: 'Contracts',       icon: '◻' },
  { id: 'network',      label: 'Network',         icon: '◎' },
  { id: 'faucet',       label: 'Faucet',          icon: '⬡' },
]

export default function Sidebar() {
  const { activeTab, setActiveTab, network, setNetwork, connectedAddress } = useStore()

  return (
    <aside style={{
      width: '220px',
      minHeight: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0, top: 0, bottom: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          fontWeight: 800,
          color: 'var(--cyan)',
          letterSpacing: '-0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '22px' }}>✦</span>
          STELLAR<br />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '13px' }}>DEV DASHBOARD</span>
        </div>
      </div>

      {/* Network toggle */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '1px' }}>NETWORK</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['testnet', 'mainnet'].map(n => (
            <button
              key={n}
              onClick={() => setNetwork(n)}
              style={{
                flex: 1,
                padding: '5px 0',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                background: network === n ? 'var(--cyan-glow)' : 'transparent',
                border: `1px solid ${network === n ? 'var(--cyan)' : 'var(--border)'}`,
                color: network === n ? 'var(--cyan)' : 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                transition: 'var(--transition)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {n === 'testnet' ? 'Test' : 'Main'}
            </button>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV_ITEMS.map((item, i) => {
          const isActive = activeTab === item.id
          const isDisabled = item.id === 'faucet' && network === 'mainnet'
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActiveTab(item.id)}
              disabled={isDisabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '9px 12px',
                marginBottom: '2px',
                background: isActive ? 'var(--cyan-glow)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--cyan-dim)' : 'transparent'}`,
                borderRadius: 'var(--radius-md)',
                color: isActive ? 'var(--cyan)' : isDisabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                transition: 'var(--transition)',
                textAlign: 'left',
                opacity: isDisabled ? 0.4 : 1,
                animationDelay: `${i * 0.04}s`,
              }}
              onMouseEnter={e => {
                if (!isActive && !isDisabled) {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive && !isDisabled) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              <span style={{ fontSize: '16px', opacity: 0.9 }}>{item.icon}</span>
              {item.label}
              {isActive && (
                <span style={{
                  marginLeft: 'auto',
                  width: '5px', height: '5px',
                  borderRadius: '50%',
                  background: 'var(--cyan)',
                  boxShadow: '0 0 6px var(--cyan)',
                }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom address */}
      {connectedAddress && (
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ color: 'var(--green)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            Connected
          </div>
          <div style={{ wordBreak: 'break-all', lineHeight: 1.4 }}>
            {connectedAddress.slice(0, 8)}…{connectedAddress.slice(-8)}
          </div>
        </div>
      )}

      <div style={{
        padding: '12px 16px',
        borderTop: connectedAddress ? 'none' : '1px solid var(--border)',
        fontSize: '10px',
        color: 'var(--text-muted)',
        letterSpacing: '0.5px',
      }}>
        v0.1.0 · Stellar Dev Dashboard
      </div>
    </aside>
  )
}
