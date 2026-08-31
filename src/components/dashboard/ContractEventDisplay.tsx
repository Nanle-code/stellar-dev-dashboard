/**
 * ContractEventDisplay
 *
 * Renders Soroban contract events as typed, searchable data with raw XDR fallback.
 * Decodes XDR-encoded ScVal topics and data values using @stellar/stellar-sdk,
 * supports contract spec matching, provides search & filter capabilities,
 * and handles invalid inputs and unsupported environments gracefully.
 *
 * Issue: [2026 Soroban] Decode contract events using the contract spec
 */
import React, { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Code, Copy, Check, Filter } from 'lucide-react'
import * as StellarSdk from '@stellar/stellar-sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContractEvent {
  inSuccessfulContractCall?: boolean
  type?: string
  contractId?: string | null
  topics?: unknown[]
  value?: unknown
  spec?: any
}

export interface ContractEventDisplayProps {
  events?: ContractEvent[] | unknown
  /** Label shown above the event list */
  label?: string
  /** Optional contract spec object for spec-aware event decoding */
  spec?: any
  className?: string
}

export interface DecodedValueResult {
  nativeValue: unknown
  displayString: string
  typeLabel: string
  isXdrFallback: boolean
  rawXdr?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Detect if a value looks like raw base64 XDR */
export function isBase64Xdr(v: unknown): boolean {
  if (typeof v !== 'string') return false
  const trimmed = v.trim()
  return (
    trimmed.length >= 8 &&
    trimmed.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+=*$/.test(trimmed) &&
    !trimmed.includes(' ')
  )
}

/** Extract exact type label from an ScVal object or fallback to native type */
export function extractScValType(scVal: any, native: any): string {
  if (scVal && typeof scVal.switch === 'function') {
    try {
      const switchObj = scVal.switch()
      const switchName = typeof switchObj === 'object' && switchObj !== null && typeof switchObj.name === 'string'
        ? switchObj.name
        : typeof switchObj === 'function' ? (switchObj as any)().name : String(switchObj)

      if (switchName === 'scvSymbol') return 'symbol'
      if (switchName === 'scvAddress') return 'address'
      if (switchName === 'scvVec') return `vec[${Array.isArray(native) ? native.length : ''}]`
      if (switchName === 'scvMap') return 'map'
      if (switchName === 'scvBytes') return 'bytes'
      if (switchName === 'scvString') return 'string'
      if (switchName === 'scvBool') return 'bool'
      if (switchName === 'scvVoid') return 'void'
      if (switchName && switchName.startsWith('scv')) {
        return switchName.slice(3).toLowerCase()
      }
    } catch {
      // Fall through to native inference
    }
  }
  return inferTypeFromNative(native)
}

/** Infer type label from a native JS value */
export function inferTypeFromNative(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return 'bool'
  if (typeof v === 'bigint') return 'i128'
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float'
  if (typeof v === 'string') {
    if (/^[GC][A-Za-z0-9]{55}$/.test(v)) return 'address'
    if (isBase64Xdr(v)) return 'xdr'
    return 'string'
  }
  if (Array.isArray(v)) return `vec[${v.length}]`
  if (typeof v === 'object') return 'map'
  return typeof v
}

/** Format a native value as human-readable string */
export function formatNativeValue(v: unknown): string {
  if (v === null || v === undefined) return '(null)'
  if (typeof v === 'bigint') return v.toString()
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]'
    return `[${v.map(formatNativeValue).join(', ')}]`
  }
  try {
    return JSON.stringify(v, (_, val) =>
      typeof val === 'bigint' ? val.toString() : val
    )
  } catch {
    return String(v)
  }
}

/** Safely decode an ScVal / XDR string or object into a typed result */
export function decodeScValOrXdr(val: unknown): DecodedValueResult {
  if (val === null || val === undefined) {
    return {
      nativeValue: null,
      displayString: '(null)',
      typeLabel: 'null',
      isXdrFallback: false,
    }
  }

  // Handle native primitives directly
  if (typeof val === 'boolean') {
    return {
      nativeValue: val,
      displayString: val ? 'true' : 'false',
      typeLabel: 'bool',
      isXdrFallback: false,
    }
  }

  if (typeof val === 'bigint') {
    return {
      nativeValue: val,
      displayString: val.toString(),
      typeLabel: 'i128',
      isXdrFallback: false,
    }
  }

  if (typeof val === 'number') {
    return {
      nativeValue: val,
      displayString: String(val),
      typeLabel: Number.isInteger(val) ? 'int' : 'float',
      isXdrFallback: false,
    }
  }

  // Handle ScVal object directly if passed
  if (typeof val === 'object' && val !== null) {
    try {
      if (typeof (val as any).toXDR === 'function') {
        const rawXdr = (val as any).toXDR('base64')
        if (typeof StellarSdk !== 'undefined' && StellarSdk.scValToNative) {
          const native = StellarSdk.scValToNative(val as any)
          const typeLabel = extractScValType(val, native)
          return {
            nativeValue: native,
            displayString: formatNativeValue(native),
            typeLabel,
            isXdrFallback: false,
            rawXdr,
          }
        }
        return {
          nativeValue: rawXdr,
          displayString: rawXdr,
          typeLabel: 'xdr',
          isXdrFallback: true,
          rawXdr,
        }
      }
    } catch {
      // Fall through to standard object processing
    }

    if (Array.isArray(val)) {
      const decodedElems = val.map(decodeScValOrXdr)
      return {
        nativeValue: decodedElems.map(e => e.nativeValue),
        displayString: `[${decodedElems.map(e => e.displayString).join(', ')}]`,
        typeLabel: `vec[${val.length}]`,
        isXdrFallback: decodedElems.some(e => e.isXdrFallback),
      }
    }

    return {
      nativeValue: val,
      displayString: formatNativeValue(val),
      typeLabel: 'map',
      isXdrFallback: false,
    }
  }

  // Handle strings (Stellar address, plain string, or XDR base64)
  if (typeof val === 'string') {
    const trimmed = val.trim()

    // 1. Check if Stellar Address (G... account or C... contract)
    if (/^[GC][A-Za-z0-9]{55}$/.test(trimmed)) {
      return {
        nativeValue: trimmed,
        displayString: trimmed,
        typeLabel: 'address',
        isXdrFallback: false,
      }
    }

    // 2. Try decoding as base64 ScVal XDR
    if (isBase64Xdr(trimmed)) {
      try {
        if (
          typeof StellarSdk !== 'undefined' &&
          StellarSdk.xdr &&
          StellarSdk.xdr.ScVal &&
          typeof StellarSdk.scValToNative === 'function'
        ) {
          const parsedScVal = StellarSdk.xdr.ScVal.fromXDR(trimmed, 'base64')
          const native = StellarSdk.scValToNative(parsedScVal)
          const typeLabel = extractScValType(parsedScVal, native)
          const displayString = formatNativeValue(native)

          return {
            nativeValue: native,
            displayString,
            typeLabel,
            isXdrFallback: false,
            rawXdr: trimmed,
          }
        }
      } catch {
        // Parsing or decoding failed -> Fallback to raw XDR
      }

      return {
        nativeValue: trimmed,
        displayString: trimmed,
        typeLabel: 'xdr',
        isXdrFallback: true,
        rawXdr: trimmed,
      }
    }

    // Plain string
    return {
      nativeValue: trimmed,
      displayString: trimmed,
      typeLabel: 'string',
      isXdrFallback: false,
    }
  }

  return {
    nativeValue: String(val),
    displayString: String(val),
    typeLabel: typeof val,
    isXdrFallback: false,
  }
}

/** Truncate long address or XDR for inline display */
export function truncate(s: string, max = 24): string {
  if (!s || typeof s !== 'string') return ''
  if (s.length <= max) return s
  return `${s.slice(0, 10)}…${s.slice(-10)}`
}

/** Match topic symbol with spec if available */
export function findSpecEventInfo(topics: unknown[], spec?: any): { eventName?: string; paramNames?: string[] } | null {
  if (!topics || topics.length === 0 || !spec) return null

  try {
    const firstTopicDecoded = decodeScValOrXdr(topics[0])
    const symbolName = String(firstTopicDecoded.nativeValue)

    if (spec.events && Array.isArray(spec.events)) {
      const match = spec.events.find((e: any) => e.name === symbolName)
      if (match) {
        return {
          eventName: match.name,
          paramNames: match.inputs ? match.inputs.map((i: any) => i.name) : undefined,
        }
      }
    }

    if (spec.funcs && typeof spec.funcs === 'function') {
      const funcs = spec.funcs()
      if (Array.isArray(funcs)) {
        const match = funcs.find((f: any) => {
          const fnName = typeof f.name === 'function' ? f.name() : f.name
          return String(fnName) === symbolName
        })
        if (match) {
          return {
            eventName: symbolName,
          }
        }
      }
    }
  } catch {
    // Best-effort spec matching
  }

  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const normalized = (type || '').toLowerCase()
  let color = 'var(--cyan)'
  let bg = 'rgba(34,211,238,0.1)'

  if (normalized === 'contract') {
    color = 'var(--green)'
    bg = 'rgba(34,197,94,0.1)'
  } else if (normalized === 'system') {
    color = 'var(--amber, #f59e0b)'
    bg = 'rgba(245,158,11,0.1)'
  } else if (normalized === 'diagnostic') {
    color = 'var(--text-muted)'
    bg = 'var(--bg-elevated)'
  }

  return (
    <span
      style={{
        padding: '2px 8px',
        background: bg,
        border: `1px solid ${color}`,
        borderRadius: '9999px',
        fontSize: '10px',
        fontWeight: 700,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        flexShrink: 0,
      }}
    >
      {type || 'unknown'}
    </span>
  )
}

function ValueChip({ value, label }: { value: unknown; label?: string }) {
  const decoded = decodeScValOrXdr(value)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const typeColor =
    decoded.typeLabel === 'address'
      ? 'var(--cyan)'
      : decoded.typeLabel === 'bool'
      ? 'var(--green)'
      : decoded.typeLabel === 'i128' || decoded.typeLabel === 'int' || decoded.typeLabel === 'symbol'
      ? 'var(--amber, #f59e0b)'
      : decoded.isXdrFallback
      ? 'var(--text-muted)'
      : 'var(--text-primary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {label && (
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {label}:
          </span>
        )}
        <span
          style={{
            padding: '1px 5px',
            background: decoded.isXdrFallback ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-elevated)',
            border: `1px solid ${decoded.isXdrFallback ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`,
            borderRadius: '4px',
            fontSize: '10px',
            color: decoded.isXdrFallback ? 'var(--red, #ef4444)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
        >
          {decoded.isXdrFallback ? 'xdr (fallback)' : decoded.typeLabel}
        </span>

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: typeColor,
            wordBreak: 'break-all',
          }}
          title={decoded.displayString}
        >
          {decoded.typeLabel === 'address' ? truncate(decoded.displayString, 28) : decoded.displayString}
        </span>

        {(decoded.rawXdr || decoded.isXdrFallback) && (
          <button
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Hide raw XDR' : 'Show raw XDR'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--cyan)',
              fontSize: '11px',
              padding: '2px 4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '4px',
            }}
          >
            <Code size={11} />
            {expanded ? 'hide XDR' : 'raw XDR'}
          </button>
        )}
      </div>

      {expanded && (decoded.rawXdr || decoded.displayString) && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-muted)',
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '8px 10px',
            wordBreak: 'break-all',
            lineHeight: 1.6,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
            marginTop: '4px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Raw Base64 XDR Payload
            </div>
            {decoded.rawXdr || decoded.displayString}
          </div>
          <button
            onClick={e => handleCopy(decoded.rawXdr || decoded.displayString, e)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: copied ? 'var(--green)' : 'var(--text-secondary)',
              padding: '4px 6px',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  )
}

function EventRow({
  event,
  index,
  spec,
  defaultOpen = true,
}: {
  event: ContractEvent
  index: number
  spec?: any
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [copiedId, setCopiedId] = useState(false)

  // Safe checks for malformed event items
  if (!event || typeof event !== 'object') {
    return (
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          background: 'var(--bg-card)',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}
      >
        Malformed event item at index #{index + 1}
      </div>
    )
  }

  const topics = Array.isArray(event.topics) ? event.topics : []
  const specInfo = findSpecEventInfo(topics, spec || event.spec)

  const handleCopyContractId = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (event.contractId && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(event.contractId).catch(() => {})
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 1500)
    }
  }

  const decodedFirstTopic = topics.length > 0 ? decodeScValOrXdr(topics[0]) : null

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--bg-card)',
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          background:
            event.inSuccessfulContractCall === false
              ? 'rgba(239,68,68,0.05)'
              : 'var(--bg-elevated)',
          border: 'none',
          borderBottom: open ? '1px solid var(--border)' : 'none',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {open ? (
          <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}
        >
          #{index + 1}
        </span>
        <TypeBadge type={event.type ?? 'unknown'} />

        {specInfo?.eventName && (
          <span
            style={{
              padding: '2px 6px',
              background: 'rgba(34,211,238,0.15)',
              border: '1px solid var(--cyan)',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--cyan)',
            }}
          >
            {specInfo.eventName}
          </span>
        )}

        {event.contractId && (
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {truncate(event.contractId, 28)}
          </span>
        )}

        {/* First topic inline preview when collapsed */}
        {!open && decodedFirstTopic && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {truncate(decodedFirstTopic.displayString, 24)}
          </span>
        )}

        {event.inSuccessfulContractCall === false && (
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--red)', fontWeight: 700 }}>
            diagnostic only
          </span>
        )}
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Contract ID full */}
          {event.contractId && (
            <div>
              <div style={labelStyle}>Contract ID</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-primary)',
                    wordBreak: 'break-all',
                  }}
                >
                  {event.contractId}
                </span>
                <button
                  onClick={handleCopyContractId}
                  title="Copy Contract ID"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedId ? 'var(--green)' : 'var(--text-muted)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {copiedId ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}

          {/* Topics */}
          {topics.length > 0 && (
            <div>
              <div style={labelStyle}>Topics ({topics.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topics.map((topic, ti) => {
                  const paramName = specInfo?.paramNames?.[ti]
                  return (
                    <div key={ti} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          minWidth: '22px',
                          paddingTop: '2px',
                        }}
                      >
                        [{ti}]
                      </span>
                      <ValueChip value={topic} label={paramName} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Value / data */}
          <div>
            <div style={labelStyle}>Value Data</div>
            <ValueChip value={event.value} />
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  marginBottom: '6px',
  fontWeight: 600,
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ContractEventDisplay({
  events,
  label = 'Contract Events',
  spec,
  className,
}: ContractEventDisplayProps) {
  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')

  // Safely normalize input events prop handling invalid input
  const normalizedEvents: ContractEvent[] = useMemo(() => {
    if (!events) return []
    if (!Array.isArray(events)) {
      if (typeof events === 'object') return [events as ContractEvent]
      return []
    }
    return events
  }, [events])

  const filtered = useMemo(() => {
    let result = normalizedEvents

    if (filterType !== 'ALL') {
      result = result.filter(ev => {
        if (!ev || typeof ev !== 'object') return false
        if (filterType === 'RAW_XDR') {
          const valueDecoded = decodeScValOrXdr(ev.value)
          const topicsDecoded = (ev.topics || []).map(decodeScValOrXdr)
          return valueDecoded.isXdrFallback || topicsDecoded.some(t => t.isXdrFallback)
        }
        return (ev.type ?? '').toUpperCase() === filterType
      })
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(ev => {
        if (!ev || typeof ev !== 'object') return false

        if ((ev.type ?? '').toLowerCase().includes(q)) return true
        if ((ev.contractId ?? '').toLowerCase().includes(q)) return true

        const topics = Array.isArray(ev.topics) ? ev.topics : []
        for (const t of topics) {
          const decoded = decodeScValOrXdr(t)
          if (decoded.displayString.toLowerCase().includes(q)) return true
          if (decoded.rawXdr && decoded.rawXdr.toLowerCase().includes(q)) return true
          if (decoded.typeLabel.toLowerCase().includes(q)) return true
        }

        const valueDecoded = decodeScValOrXdr(ev.value)
        if (valueDecoded.displayString.toLowerCase().includes(q)) return true
        if (valueDecoded.rawXdr && valueDecoded.rawXdr.toLowerCase().includes(q)) return true
        if (valueDecoded.typeLabel.toLowerCase().includes(q)) return true

        return false
      })
    }

    return result
  }, [normalizedEvents, query, filterType])

  if (!normalizedEvents.length) {
    return (
      <div
        className={className}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
            {label}
          </div>
        </div>
        <div style={{ padding: '20px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
          No contract events emitted
        </div>
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
              {label}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {normalizedEvents.length} event{normalizedEvents.length !== 1 ? 's' : ''}
              {(query || filterType !== 'ALL') && ` · ${filtered.length} matching`}
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', minWidth: '220px', flex: '1', maxWidth: '320px' }}>
            <Search
              size={12}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search topics, values, types..."
              aria-label="Search contract events"
              style={{
                width: '100%',
                paddingLeft: '28px',
                paddingRight: '28px',
                paddingTop: '6px',
                paddingBottom: '6px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search query"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '2px',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={11} style={{ color: 'var(--text-muted)', marginRight: '4px' }} />
          {['ALL', 'CONTRACT', 'SYSTEM', 'DIAGNOSTIC', 'RAW_XDR'].map(type => {
            const active = filterType === type
            const displayLabel = type === 'RAW_XDR' ? 'Raw XDR Fallback' : type.toLowerCase()
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  padding: '3px 9px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  background: active ? 'var(--cyan)' : 'var(--bg-elevated)',
                  color: active ? 'var(--bg-base)' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'var(--cyan)' : 'var(--border)'}`,
                  transition: 'var(--transition)',
                }}
              >
                {displayLabel}
              </button>
            )
          })}
        </div>
      </div>

      {/* Event list */}
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            No contract events match the selected filters
          </div>
        ) : (
          filtered.map((ev, i) => (
            <EventRow
              key={i}
              event={ev}
              index={normalizedEvents.indexOf(ev)}
              spec={spec}
              defaultOpen={filtered.length <= 5}
            />
          ))
        )}
      </div>
    </div>
  )
}
