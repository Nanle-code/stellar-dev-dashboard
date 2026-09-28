/**
 * LayoutExportImport.tsx
 * A feature-rich modal for exporting, importing, URL-sharing, and restoring
 * dashboard layouts from history.
 *
 * Tabs:
 *  1. Export — download JSON, copy JSON, copy share URL
 *  2. Import — paste JSON / share token, or drag-and-drop a .json file
 *  3. History — restore any of the last 20 layout snapshots
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Download,
  Upload,
  Link2,
  History,
  X,
  Check,
  AlertTriangle,
  Info,
  Copy,
  FileJson,
  RotateCcw,
  Trash2,
  ClipboardPaste,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  exportLayout,
  importLayout,
  buildShareUrlWithDiagnostics,
  loadLayoutHistory,
  clearLayoutHistory,
  validateLayoutEnvelope,
  parseLayoutInput,
  type DashboardLayout,
  type LayoutHistoryEntry,
  type LayoutValidationResult,
} from '../../lib/dashboardLayouts'
import { addBreadcrumb } from '../../lib/errorReporting'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActiveTab = 'export' | 'import' | 'history'

interface Props {
  isOpen: boolean
  layout: DashboardLayout | null   // currently-selected layout to export
  /** Tab to open on. Defaults to 'export' when a layout is available, else 'import'. */
  initialTab?: ActiveTab
  onImport: (layout: DashboardLayout) => void
  onHistoryRestore: (entry: LayoutHistoryEntry) => void
  onClose: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  return (
    <button
      onClick={handle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        background: copied ? 'var(--green)' : 'var(--bg-elevated)',
        color: copied ? 'white' : 'var(--text-primary)',
        border: `1px solid ${copied ? 'var(--green)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ValidationBanner
// ─────────────────────────────────────────────────────────────────────────────

function ValidationBanner({ result }: { result: LayoutValidationResult | null }) {
  if (!result) return null

  if (!result.valid) {
    return (
      <div style={{
        background: 'rgba(239,68,68,.10)',
        border: '1px solid rgba(239,68,68,.35)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: result.errors.length > 1 ? '6px' : 0 }}>
          <AlertTriangle size={14} color="var(--red, #ef4444)" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--red, #ef4444)' }}>
            {result.errors.length} validation error{result.errors.length > 1 ? 's' : ''}
          </span>
        </div>
        <ul style={{ margin: '4px 0 0 20px', padding: 0, fontSize: '11px', color: 'var(--red, #ef4444)' }}>
          {result.errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    )
  }

  if (result.warnings.length > 0) {
    return (
      <div style={{
        background: 'rgba(234,179,8,.10)',
        border: '1px solid rgba(234,179,8,.35)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: result.warnings.length > 1 ? '6px' : 0 }}>
          <Info size={14} color="#ca8a04" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#ca8a04' }}>
            {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''} (import will still work)
          </span>
        </div>
        <ul style={{ margin: '4px 0 0 20px', padding: 0, fontSize: '11px', color: '#ca8a04' }}>
          {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(34,197,94,.10)',
      border: '1px solid rgba(34,197,94,.35)',
      borderRadius: 'var(--radius)',
      padding: '10px 14px',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <Check size={14} color="var(--green, #22c55e)" />
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--green, #22c55e)' }}>
        Layout looks valid — ready to import.
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Export
// ─────────────────────────────────────────────────────────────────────────────

function ExportTab({ layout }: { layout: DashboardLayout | null }) {
  if (!layout) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <FileJson size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
        <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>No layout selected</p>
        <p style={{ fontSize: '12px' }}>Select a layout in the Layout Manager first, then open Export.</p>
      </div>
    )
  }

  const jsonStr = exportLayout(layout)
  const share = buildShareUrlWithDiagnostics(layout)

  const downloadJson = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${layout.name.replace(/\s+/g, '-').toLowerCase()}-layout.json`
    a.click()
    URL.revokeObjectURL(url)
    addBreadcrumb('Layout downloaded as JSON', 'user_action', { layoutId: layout.id })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Info card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,.08) 0%, rgba(99,102,241,.08) 100%)',
        border: '1px solid rgba(6,182,212,.25)',
        borderRadius: 'var(--radius)',
        padding: '16px',
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
      }}>
        <FileJson size={22} style={{ color: 'var(--cyan, #06b6d4)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {layout.name}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {layout.widgets.length} widget{layout.widgets.length !== 1 ? 's' : ''} &bull; Schema v2 &bull; Exported at {new Date().toLocaleString()}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {layout.widgets.map(w => (
              <span key={w.id} style={{
                fontSize: '10px',
                padding: '2px 8px',
                background: 'rgba(6,182,212,.12)',
                border: '1px solid rgba(6,182,212,.25)',
                borderRadius: '20px',
                color: 'var(--cyan, #06b6d4)',
                fontWeight: 600,
              }}>
                {w.type}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          id="export-download-json-btn"
          onClick={downloadJson}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: 'var(--cyan, #06b6d4)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Download size={14} />
          Download .json
        </button>

        <CopyButton text={jsonStr} label="Copy JSON" />
      </div>

      {/* Share via URL */}
      <div>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Link2 size={13} style={{ color: 'var(--cyan, #06b6d4)' }} />
          Share via URL
        </p>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'stretch',
          background: 'var(--bg-card)',
          border: `1px solid ${share.isSafe ? 'var(--border)' : '#ca8a04'}`,
          borderRadius: 'var(--radius)',
          padding: '8px 12px',
        }}>
          <input
            readOnly
            value={share.url}
            id="layout-share-url-input"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              minWidth: 0,
            }}
          />
          <CopyButton text={share.url} label="Copy URL" />
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
          Anyone with this URL can import your layout directly.
          {' '}({share.length.toLocaleString()} characters)
        </p>
        {share.warning && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            marginTop: '8px',
            padding: '10px 14px',
            background: 'rgba(234,179,8,.10)',
            border: '1px solid rgba(234,179,8,.35)',
            borderRadius: 'var(--radius)',
          }}>
            <AlertTriangle size={14} color="#ca8a04" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: '11px', color: '#ca8a04' }}>{share.warning}</span>
          </div>
        )}
      </div>

      {/* JSON preview */}
      <div>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileJson size={13} style={{ color: 'var(--cyan, #06b6d4)' }} />
          JSON Preview
        </p>
        <pre style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '14px',
          fontSize: '10px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          overflowX: 'auto',
          maxHeight: '220px',
          overflowY: 'auto',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          margin: 0,
        }}>
          {jsonStr}
        </pre>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Import
// ─────────────────────────────────────────────────────────────────────────────

function ImportTab({ onImport, onClose }: { onImport: (layout: DashboardLayout) => void; onClose: () => void }) {
  const [rawInput, setRawInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [validation, setValidation] = useState<LayoutValidationResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Live validation as user types (debounced)
  useEffect(() => {
    if (!rawInput.trim()) {
      setValidation(null)
      setImportError(null)
      return
    }
    const timer = setTimeout(() => {
      try {
        setValidation(validateLayoutEnvelope(parseLayoutInput(rawInput)))
        setImportError(null)
      } catch (err) {
        setValidation({ valid: false, errors: [err instanceof Error ? err.message : 'Cannot parse input.'], warnings: [] })
        setImportError(null)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [rawInput])

  const handleFileRead = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      setImportError('Only .json files are supported.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => setRawInput((e.target?.result as string) || '')
    reader.readAsText(file)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileRead(file)
  }, [handleFileRead])

  const handleImport = useCallback(() => {
    if (!rawInput.trim()) return
    setImportError(null)
    try {
      const layout = importLayout(rawInput)
      addBreadcrumb('Layout imported via paste/file', 'user_action', { layoutId: layout.id })
      setImportSuccess(true)
      setTimeout(() => {
        onImport(layout)
        onClose()
      }, 800)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unknown import error')
    }
  }, [rawInput, onImport, onClose])

  const canImport = rawInput.trim() && validation?.valid

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Drop zone */}
      <div
        id="layout-import-dropzone"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--cyan, #06b6d4)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragging ? 'rgba(6,182,212,.06)' : 'var(--bg-card)',
          transition: 'all 0.2s ease',
        }}
      >
        <Upload size={28} style={{ color: isDragging ? 'var(--cyan, #06b6d4)' : 'var(--text-muted)', marginBottom: '8px' }} />
        <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {isDragging ? 'Drop the file here...' : 'Drag & drop a layout .json file'}
        </p>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          or <span style={{ color: 'var(--cyan, #06b6d4)', fontWeight: 600 }}>click to browse</span>
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileRead(f) }}
        />
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>OR PASTE BELOW</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          id="layout-import-textarea"
          placeholder={'Paste layout JSON or share token (base64) here...'}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 14px',
            border: `1px solid ${validation && !validation.valid ? 'rgba(239,68,68,.6)' : validation?.valid ? 'rgba(34,197,94,.4)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            minHeight: '150px',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease',
            lineHeight: 1.6,
          }}
        />
        {rawInput && (
          <button
            onClick={() => { setRawInput(''); setValidation(null); setImportError(null) }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Paste from clipboard */}
      <button
        onClick={async () => {
          try {
            const text = await navigator.clipboard.readText()
            setRawInput(text)
          } catch { /* permissions denied */ }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          alignSelf: 'flex-start',
          background: 'none',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 12px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        <ClipboardPaste size={12} />
        Paste from clipboard
      </button>

      {/* Validation result */}
      <ValidationBanner result={validation} />

      {/* Error */}
      {importError && (
        <div style={{
          background: 'rgba(239,68,68,.10)',
          border: '1px solid rgba(239,68,68,.35)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          fontSize: '12px',
          color: 'var(--red, #ef4444)',
          whiteSpace: 'pre-wrap',
        }}>
          {importError}
        </div>
      )}

      {/* Import button */}
      <button
        id="layout-import-submit-btn"
        onClick={handleImport}
        disabled={!canImport || importSuccess}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '11px 20px',
          background: importSuccess ? 'var(--green, #22c55e)' : canImport ? 'var(--cyan, #06b6d4)' : 'var(--bg-elevated)',
          color: canImport || importSuccess ? 'white' : 'var(--text-muted)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          fontWeight: 700,
          cursor: canImport && !importSuccess ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
        }}
      >
        {importSuccess ? <Check size={15} /> : <Upload size={15} />}
        {importSuccess ? 'Imported! Applying...' : 'Import Layout'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: History
// ─────────────────────────────────────────────────────────────────────────────

function HistoryTab({ onRestore, onClose }: { onRestore: (entry: LayoutHistoryEntry) => void; onClose: () => void }) {
  const [history, setHistory] = useState<LayoutHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [restoredId, setRestoredId] = useState<string | null>(null)

  useEffect(() => {
    loadLayoutHistory().then((h) => { setHistory(h); setLoading(false) })
  }, [])

  const handleRestore = useCallback((entry: LayoutHistoryEntry) => {
    setRestoredId(entry.id)
    addBreadcrumb('Layout restored from history', 'user_action', { historyId: entry.id, layoutName: entry.layoutName })
    setTimeout(() => {
      onRestore(entry)
      onClose()
    }, 700)
  }, [onRestore, onClose])

  const handleClear = useCallback(async () => {
    await clearLayoutHistory()
    setHistory([])
    setClearConfirm(false)
    addBreadcrumb('Layout history cleared', 'user_action')
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '13px' }}>Loading history...</div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <History size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
        <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>No history yet</p>
        <p style={{ fontSize: '12px', lineHeight: 1.5 }}>
          Layout snapshots are saved automatically when you switch or edit layouts.
          Up to 20 snapshots are kept.
        </p>
      </div>
    )
  }

  const reasonLabel: Record<string, string> = {
    'auto-save': 'Auto-saved',
    'before-switch': 'Before switch',
    'manual': 'Manual save',
    'before-import': 'Before import',
  }
  const reasonColor: Record<string, string> = {
    'auto-save': '#06b6d4',
    'before-switch': '#a78bfa',
    'manual': '#22c55e',
    'before-import': '#f59e0b',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {history.length} snapshot{history.length !== 1 ? 's' : ''} &bull; newest first
        </p>
        {clearConfirm ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setClearConfirm(false)} style={{ padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '11px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
            <button id="history-clear-confirm-btn" onClick={handleClear} style={{ padding: '5px 10px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)', borderRadius: 'var(--radius-sm)', fontSize: '11px', cursor: 'pointer', color: 'var(--red, #ef4444)', fontWeight: 600 }}>Clear all</button>
          </div>
        ) : (
          <button onClick={() => setClearConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '11px', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <Trash2 size={11} />
            Clear history
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {history.map((entry) => {
          const isRestoring = restoredId === entry.id
          const reason = entry.reason || 'auto-save'
          const color = reasonColor[reason] || '#06b6d4'
          const label = reasonLabel[reason] || reason
          return (
            <div key={entry.id} style={{ background: 'var(--bg-card)', border: `1px solid ${isRestoring ? 'var(--green, #22c55e)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'border-color 0.2s' }}>
              <RotateCcw size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.layoutName}
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 7px', background: `${color}1A`, border: `1px solid ${color}44`, borderRadius: '20px', color, fontWeight: 700, flexShrink: 0 }}>
                    {label}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {entry.widgets.length} widgets &bull; {relativeTime(entry.savedAt)} &bull; {new Date(entry.savedAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => handleRestore(entry)}
                disabled={!!restoredId}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: isRestoring ? 'var(--green, #22c55e)' : 'var(--bg-elevated)', color: isRestoring ? 'white' : 'var(--text-primary)', border: `1px solid ${isRestoring ? 'var(--green, #22c55e)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, cursor: restoredId ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'all 0.2s' }}
              >
                {isRestoring ? <Check size={12} /> : <ChevronRight size={12} />}
                {isRestoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function LayoutExportImport({ isOpen, layout, initialTab, onImport, onHistoryRestore, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('export')

  useEffect(() => {
    if (!isOpen) return
    setActiveTab(initialTab ?? (layout ? 'export' : 'import'))
  }, [isOpen, layout, initialTab])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const tabs: { id: ActiveTab; label: string; Icon: LucideIcon }[] = [
    { id: 'export', label: 'Export', Icon: Download },
    { id: 'import', label: 'Import', Icon: Upload },
    { id: 'history', label: 'History', Icon: History },
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        id="layout-export-import-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '580px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,.5)' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(6,182,212,.05) 0%, transparent 100%)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, rgba(6,182,212,.25), rgba(99,102,241,.25))', border: '1px solid rgba(6,182,212,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileJson size={17} style={{ color: 'var(--cyan, #06b6d4)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-display)' }}>
                Layout Export &amp; Import
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Share, backup, and restore your dashboard configurations
              </p>
            </div>
          </div>
          <button id="layout-export-import-close-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 22px', background: 'var(--bg-elevated)', flexShrink: 0 }}>
          {tabs.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                id={`layout-tab-${id}`}
                onClick={() => setActiveTab(id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--cyan, #06b6d4)' : 'transparent'}`, color: active ? 'var(--cyan, #06b6d4)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s ease', marginBottom: '-1px' }}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px' }}>
          {activeTab === 'export' && <ExportTab layout={layout} />}
          {activeTab === 'import' && <ImportTab onImport={onImport} onClose={onClose} />}
          {activeTab === 'history' && <HistoryTab onRestore={onHistoryRestore} onClose={onClose} />}
        </div>
      </div>
    </div>
  )
}
