import React, { useEffect, useState } from 'react'
import { fetchMarketplaceThemes, installMarketplaceTheme } from '../../lib/marketplace'
import { THEME_COLOR_KEYS } from '../../styles/themeTypes'

const swatchStyle = (color) => ({
  width: '100%',
  height: '6px',
  background: color,
  borderRadius: '2px',
})

export default function MarketplacePanel({ onInstall }) {
  const [themes, setThemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchMarketplaceThemes()
      .then((data) => {
        if (!cancelled) setThemes(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load marketplace')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleInstall = async (themeId) => {
    const theme = await installMarketplaceTheme(themeId)
    if (theme) onInstall(theme)
  }

  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Marketplace
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
          <div className="spinner" />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Loading themes...</span>
        </div>
      )}

      {error && (
        <div style={{ fontSize: '11px', color: 'var(--red)', padding: '8px 0' }}>
          {error}
        </div>
      )}

      {!loading && !error && themes.length === 0 && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px 0' }}>
          No themes available.
        </div>
      )}

      {!loading && themes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {themes.map((theme) => (
            <div
              key={theme.id}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}
            >
              {/* Color swatch strip */}
              <div style={{ display: 'flex', gap: '2px', padding: '6px 8px 4px' }}>
                {THEME_COLOR_KEYS.map((key) => (
                  <div key={key} style={swatchStyle(theme.colors[key])} />
                ))}
              </div>

              {/* Info row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 6px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {theme.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {theme.author} · {theme.downloads} downloads
                  </div>
                </div>
                <button
                  onClick={() => handleInstall(theme.id)}
                  aria-label={`Install ${theme.name} theme`}
                  style={{
                    padding: '4px 10px',
                    background: 'var(--cyan-glow)',
                    border: '1px solid var(--cyan-dim)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--cyan)',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Install
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
