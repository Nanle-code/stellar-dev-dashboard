import React from 'react'
import { useStore } from '../../lib/store'
import CopyableValue from '../dashboard/CopyableValue'
import { NETWORKS, updateCustomNetworkConfig } from '../../lib/stellar'

// All TABS from App.tsx are represented here, grouped for clarity.
const NAV_GROUPS = [
  {
    label: 'Explore',
    items: [
      { id: 'overview',     label: 'Overview',    icon: '◈' },
      { id: 'account',      label: 'Account',     icon: '◉' },
      { id: 'compare',      label: 'Compare',     icon: '◫' },
      { id: 'transactions', label: 'Transactions', icon: '⇄' },
      { id: 'assets',       label: 'Assets',      icon: '💎' },
      { id: 'anchors',      label: 'Anchors',     icon: '⚓' },
      { id: 'search',       label: 'Search',      icon: '🔍' },
      { id: 'explorers',    label: 'Explorers',   icon: '🌐' },
    ],
  },
  {
    label: 'Build',
    items: [
      { id: 'contracts',           label: 'Contracts',           icon: '◻' },
      { id: 'contractInteraction', label: 'Contract Interaction', icon: '⚡' },
      { id: 'contractABI',         label: 'Contract ABI',        icon: '📄' },
      { id: 'txBuilder',           label: 'TX Builder',          icon: '🔨' },
      { id: 'builder',             label: 'Builder',             icon: '⚒' },
      { id: 'faucet',              label: 'Faucet',              icon: '⬡' },
    ],
  },
  {
    label: 'Network',
    items: [
      { id: 'network',      label: 'Network',      icon: '◎' },
      { id: 'dex',          label: 'DEX Explorer', icon: '⇌' },
      { id: 'realtime',     label: 'Real-Time',    icon: '◉' },
      { id: 'liveActivity', label: 'Live Activity', icon: '⚡' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { id: 'wallet',       label: 'Wallet',       icon: '⊡' },
      { id: 'signer',       label: 'Signer',       icon: '✎' },
      { id: 'multisig',     label: 'Multisig',     icon: '⊕' },
      { id: 'portfolio',    label: 'Portfolio',    icon: '◐' },
      { id: 'charts',       label: 'Charts',       icon: '▤' },
      { id: 'analytics',    label: 'Analytics',    icon: '◍' },
      { id: 'systemHealth', label: 'Health',       icon: '⚕' },
      { id: 'cacheStats',   label: 'Cache Stats',  icon: '⊞' },
      { id: 'audit',        label: 'Audit',        icon: '⊟' },
      { id: 'settings',     label: 'Settings',     icon: '⚙' },
    ],
  },
]

export default function Sidebar({ isMobile = false }) {
  const {
    activeTab,
    setActiveTab,
    network,
    setNetwork,
    connectedAddress,
    theme,
    toggleTheme,
    isMobileMenuOpen,
    setMobileMenuOpen,
  } = useStore()

  const handleNavClick = (tabId) => {
    setActiveTab(tabId)
    setMobileMenuOpen(false)
  }

  const sidebarStyles = {
    width: isMobile ? 'var(--sidebar-width-mobile)' : 'var(--sidebar-width)',
    minHeight: '100vh',
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 1000,
    transform: isMobile ? (isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
    transition: 'transform var(--transition)',
    boxShadow: isMobile && isMobileMenuOpen ? '4px 0 20px rgba(0, 0, 0, 0.3)' : 'none',
  }

  const customInputStyle = {
    width: '100%',
    padding: '6px 10px',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
  }

  return (
    <>
      {isMobile && (
        <div
          className={`mobile-menu-overlay ${isMobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside style={sidebarStyles}>
        {isMobile && (
          <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1001 }}>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="touch-target"
              style={{
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontSize: '18px',
                cursor: 'pointer',
                transition: 'var(--transition)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--bg-elevated)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.background = 'var(--bg-hover)'
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
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
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '1px' }}>NETWORK</div>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-hover)',
              border: '1px solid var(--cyan-dim)',
              color: 'var(--cyan)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              outline: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              appearance: 'none',
            }}
          >
            {Object.entries(NETWORKS).map(([id, config]) => (
              <option key={id} value={id} style={{ background: 'var(--bg-surface)' }}>
                {config.name}
              </option>
            ))}
          </select>

          {network === 'custom' && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                placeholder="Horizon URL"
                defaultValue={NETWORKS.custom.horizonUrl}
                style={customInputStyle}
                onChange={(e) => updateCustomNetworkConfig({ horizonUrl: e.target.value.trim() })}
              />
              <input
                placeholder="Soroban RPC URL"
                defaultValue={NETWORKS.custom.sorobanUrl}
                style={customInputStyle}
                onChange={(e) => updateCustomNetworkConfig({ sorobanUrl: e.target.value.trim() })}
              />
              <input
                placeholder="Network Passphrase"
                defaultValue={NETWORKS.custom.passphrase}
                style={customInputStyle}
                onChange={(e) => updateCustomNetworkConfig({ passphrase: e.target.value.trim() })}
              />
            </div>
          )}
        </div>

        {/* Grouped Nav */}
        <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }} aria-label="Main navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: '4px' }}>
              <div style={{
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                padding: '10px 16px 4px',
              }}>
                {group.label}
              </div>
              {group.items.map((item, i) => {
                const isActive = activeTab === item.id
                const isDisabled = item.id === 'faucet' && network === 'mainnet'
                return (
                  <button
                    key={item.id}
                    onClick={() => !isDisabled && handleNavClick(item.id)}
                    disabled={isDisabled}
                    aria-current={isActive ? 'page' : undefined}
                    className="touch-target"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 16px',
                      marginBottom: '1px',
                      background: isActive ? 'var(--cyan-glow)' : 'transparent',
                      border: `1px solid ${isActive ? 'var(--cyan-dim)' : 'transparent'}`,
                      borderRadius: 'var(--radius-md)',
                      color: isActive ? 'var(--cyan)' : isDisabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                      fontSize: '12px',
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
                    <span style={{ fontSize: '14px', opacity: 0.9 }}>{item.icon}</span>
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
            </div>
          ))}
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
              <CopyableValue
                value={connectedAddress}
                title="Copy connected public key"
                textStyle={{ display: 'inline-block' }}
              >
                {connectedAddress.slice(0, 8)}…{connectedAddress.slice(-8)}
              </CopyableValue>
            </div>
          </div>
        )}

        <div style={{
          padding: '12px 16px',
          borderTop: connectedAddress ? 'none' : '1px solid var(--border)',
          fontSize: '10px',
          color: 'var(--text-muted)',
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>v0.1.0 · Stellar Dev Dashboard</span>
          <button
            onClick={toggleTheme}
            className="touch-target-sm"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)',
            }}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text-primary)'
              e.currentTarget.style.background = 'var(--bg-hover)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {theme === 'light' ? '☾' : '☀'}
          </button>
        </div>
      </aside>
    </>
  )
}
