import React from 'react'
import { useStore } from '../../lib/store'
import NetworkIndicator from './NetworkIndicator'

export default function MobileHeader() {
  const { isMobileMenuOpen, setMobileMenuOpen, theme, toggleTheme } = useStore()

  return (
    <header 
      className="mobile-only"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--header-height)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 999,
      }}
    >
      {/* Menu button */}
      <button
        type="button"
        aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMobileMenuOpen}
        aria-controls="mobile-sidebar"
        onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
        className="touch-target"
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'var(--transition)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.background = 'var(--bg-hover)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Logo */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '16px',
        fontWeight: 800,
        color: 'var(--cyan)',
        letterSpacing: '-0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ fontSize: '18px' }}>✦</span>
        STELLAR
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <NetworkIndicator compact />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="touch-target"
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
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
    </header>
  )
}