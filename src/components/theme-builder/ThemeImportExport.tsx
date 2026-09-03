import React, { useRef, useState, useCallback } from 'react'
import { exportTheme, importTheme } from '../../styles/themeTypes'

export default function ThemeImportExport({ draft, onImport }) {
  const fileRef = useRef(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const handleExport = useCallback(() => {
    if (!draft) return
    const json = exportTheme(draft)
    const name = draft.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'theme'
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [draft])

  const handleImportClick = useCallback(() => {
    setError(null)
    setSuccess(null)
    fileRef.current?.click()
  }, [])

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSuccess(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const theme = importTheme(ev.target.result)
        onImport(theme)
        setSuccess(`Loaded "${theme.name}"`)
        setTimeout(() => setSuccess(null), 2500)
      } catch (err) {
        setError(err.message || 'Failed to import theme')
      }
    }
    reader.onerror = () => setError('Failed to read file')
    reader.readAsText(file)
    e.target.value = ''
  }, [onImport])

  const status = error || success
  const statusColor = error ? 'var(--red)' : 'var(--green)'

  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Import / Export
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleExport}
          style={{
            padding: '8px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}
        >
          Export JSON
        </button>
        <button
          onClick={handleImportClick}
          style={{
            padding: '8px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            transition: 'var(--transition)',
          }}
        >
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        {status && (
          <span style={{ fontSize: '11px', color: statusColor, fontFamily: 'var(--font-mono)' }}>
            {status}
          </span>
        )}
      </div>
    </div>
  )
}
