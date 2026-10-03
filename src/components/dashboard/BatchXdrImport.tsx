import React, { useState, useMemo } from 'react'
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Upload, 
  Trash2,
  Eye,
  Copy,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { importBatchXdr, validateXdrForBroadcast, type BatchXdrImportResult, type XdrImportItem } from '../../lib/batchXdrImport'
import { useStore } from '../../lib/store'

const palette = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: 'var(--cyan)',
  muted: 'var(--text-muted)',
  primary: 'var(--text-primary)',
  bgCard: 'var(--bg-card)',
  border: 'var(--border)',
  elevated: 'var(--bg-elevated)',
}

function StatusBadge({ status, label }: { status: 'valid' | 'invalid' | 'warning'; label: string }) {
  const colors = {
    valid: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', text: palette.green, icon: CheckCircle },
    invalid: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: palette.red, icon: AlertCircle },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: palette.amber, icon: AlertTriangle },
  }
  const c = colors[status]
  const Icon = c.icon
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
    }}>
      <Icon size={10} />
      {label}
    </span>
  )
}

function OperationTag({ type, source }: { type: string; source?: string }) {
  return (
    <span style={{
      fontSize: '10px',
      fontFamily: 'var(--font-mono)',
      padding: '2px 6px',
      background: palette.elevated,
      borderRadius: '4px',
      color: palette.primary,
      border: `1px solid ${palette.border}`,
    }}>
      {type}{source && ` (${source.slice(0, 8)}...)`}
    </span>
  )
}

function ExpandableRow({ 
  item, 
  expanded, 
  onToggle 
}: { 
  item: BatchXdrImportResult['items'][0]; 
  expanded: boolean; 
  onToggle: () => void 
}) {
  const isValid = item.valid
  const status = isValid ? (item.warnings && item.warnings.length > 0 ? 'warning' : 'valid') : 'invalid'
  
  return (
    <div style={{ border: `1px solid ${palette.border}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: palette.bgCard }}>
      <div 
        onClick={onToggle}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          padding: '12px 16px', 
          cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${palette.border}` : 'none',
        }}
      >
        <div style={{ width: '40px', textAlign: 'center', fontSize: '11px', color: palette.muted, fontFamily: 'var(--font-mono)' }}>
          #{item.index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', color: palette.primary }}>
              {item.label || `Transaction ${item.index + 1}`}
            </span>
            <StatusBadge status={status} label={isValid ? 'Valid' : 'Invalid'} />
            {item.envelope && (
              <>
                <span style={{ fontSize: '10px', color: palette.muted, fontFamily: 'var(--font-mono)' }}>
                  {item.envelope.type === 'fee_bump' ? 'Fee-Bump' : 'Standard'}
                </span>
                <span style={{ fontSize: '10px', color: palette.muted }}>
                  {item.envelope.operationCount} ops
                </span>
                <span style={{ fontSize: '10px', color: palette.muted }}>
                  Fee: {parseInt(item.envelope.fee).toLocaleString()} stroops
                </span>
                {item.envelope.type === 'fee_bump' && (
                  <span style={{ fontSize: '10px', color: palette.cyan }}>
                    Inner: {item.envelope.innerTransaction.operationCount} ops
                  </span>
                )}
              </>
            )}
          </div>
          {!isValid && item.error && (
            <div style={{ marginTop: '4px', fontSize: '11px', color: palette.red, fontFamily: 'var(--font-mono)' }}>
              {item.error}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{ padding: '4px', color: palette.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div style={{ padding: '16px', background: palette.elevated }}>
          {item.envelope && (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hash</div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: palette.primary, wordBreak: 'break-all' }}>
                    {item.envelope.hash}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source Account</div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: palette.primary }}>
                    {item.envelope.source}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sequence</div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: palette.primary }}>
                    {item.envelope.sequenceNumber}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Signatures</div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: palette.primary }}>
                    {item.envelope.signatures}
                  </div>
                </div>
                {item.envelope.type === 'fee_bump' && (
                  <>
                    <div>
                      <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fee Source</div>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: palette.primary }}>
                        {item.envelope.feeSource}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fee-Bump Fee</div>
                      <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: palette.primary }}>
                        {parseInt(item.envelope.fee).toLocaleString()} stroops
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div>
                <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Operations ({item.envelope.operationCount})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {item.envelope.operations.map((op, i) => (
                    <OperationTag key={i} type={op.type} source={op.source || undefined} />
                  ))}
                </div>
              </div>
              
              {item.envelope.type === 'fee_bump' && (
                <div style={{ borderTop: `1px solid ${palette.border}`, paddingTop: '12px' }}>
                  <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Inner Transaction Operations ({item.envelope.innerTransaction.operationCount})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {item.envelope.innerTransaction.operations.map((op, i) => (
                      <OperationTag key={i} type={op.type} source={op.source || undefined} />
                    ))}
                  </div>
                </div>
              )}
              
              {item.warnings && item.warnings.length > 0 && (
                <div style={{ borderTop: `1px solid ${palette.border}`, paddingTop: '12px' }}>
                  <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    Warnings
                  </div>
                  <div style={{ display: 'grid', gap: '4px' }}>
                    {item.warnings.map((w, i) => (
                      <div key={i} style={{
                        fontSize: '11px', 
                        color: palette.amber, 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '6px',
                        padding: '6px 8px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: `1px solid ${palette.amber}33`,
                        borderRadius: 'var(--radius-sm)',
                      }}>
                        <AlertTriangle size={10} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {!isValid && (
            <div style={{ color: palette.red, fontSize: '12px' }}>
              {item.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BatchXdrImport() {
  const { network } = useStore()
  const [xdrInputs, setXdrInputs] = useState<XdrImportItem[]>([{ xdr: '', label: '' }])
  const [result, setResult] = useState<BatchXdrImportResult | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [broadcastValidation, setBroadcastValidation] = useState<Record<number, Awaited<ReturnType<typeof validateXdrForBroadcast>>> | null>(null)

  const handleImport = async () => {
    const validInputs = xdrInputs.filter(item => item.xdr.trim())
    if (validInputs.length === 0) return
    
    setIsImporting(true)
    try {
      const importResult = importBatchXdr(validInputs, { network, skipEmpty: false })
      setResult(importResult)
    } finally {
      setIsImporting(false)
    }
  }

  const handleValidateForBroadcast = async (index: number, xdr: string) => {
    const validation = validateXdrForBroadcast(xdr, network)
    setBroadcastValidation(prev => ({ ...prev, [index]: validation }))
  }

  const handleClear = () => {
    setXdrInputs([{ xdr: '', label: '' }])
    setResult(null)
    setExpandedItems(new Set())
    setBroadcastValidation(null)
  }

  const addInput = () => {
    setXdrInputs([...xdrInputs, { xdr: '', label: '' }])
  }

  const removeInput = (index: number) => {
    setXdrInputs(xdrInputs.filter((_, i) => i !== index))
  }

  const updateInput = (index: number, field: 'xdr' | 'label', value: string) => {
    setXdrInputs(xdrInputs.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const toggleExpand = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const summary = result?.summary
  const validCount = summary?.valid || 0
  const invalidCount = summary?.invalid || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
        Batch XDR Import
      </div>
      <div style={{ fontSize: '13px', color: palette.muted, maxWidth: '700px' }}>
        Import multiple transaction XDR envelopes and validate each before broadcast. 
        Supports both standard transactions and fee-bump transactions.
      </div>

      {/* Input Area */}
      <div style={{ background: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: `1px solid ${palette.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
            Transaction XDR Inputs
          </div>
          <button
            onClick={addInput}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', fontSize: '12px', fontWeight: 600,
              background: 'var(--cyan-glow)', border: '1px solid var(--cyan)',
              borderRadius: 'var(--radius-sm)', color: 'var(--cyan)', cursor: 'pointer'
            }}
          >
            <Upload size={14} /> Add XDR
          </button>
        </div>
        <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
          {xdrInputs.map((item, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '12px', alignItems: 'start' }}>
              <div style={{ width: '40px', textAlign: 'center', fontSize: '11px', color: palette.muted, fontFamily: 'var(--font-mono)', paddingTop: '8px' }}>
                #{index + 1}
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                  <textarea
                    placeholder="Paste base64 XDR envelope here..."
                    value={item.xdr}
                    onChange={(e) => updateInput(index, 'xdr', e.target.value)}
                    style={{
                      minHeight: '80px',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      resize: 'vertical',
                      width: '100%',
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      onClick={() => handleValidateForBroadcast(index, item.xdr)}
                      disabled={!item.xdr.trim() || isImporting}
                      style={{
                        padding: '8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--cyan-glow)', border: '1px solid var(--cyan)',
                        color: 'var(--cyan)', cursor: item.xdr.trim() ? 'pointer' : 'not-allowed',
                        opacity: item.xdr.trim() ? 1 : 0.5,
                      }}
                      title="Validate for broadcast"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => removeInput(index)}
                      disabled={xdrInputs.length <= 1}
                      style={{
                        padding: '8px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--red-glow)', border: '1px solid var(--red)',
                        color: 'var(--red)', cursor: xdrInputs.length > 1 ? 'pointer' : 'not-allowed',
                        opacity: xdrInputs.length > 1 ? 1 : 0.5,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Optional label"
                  value={item.label}
                  onChange={(e) => updateInput(index, 'label', e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    width: '200px',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px', borderTop: `1px solid ${palette.border}`, display: 'flex', gap: '12px' }}>
          <button
            onClick={handleImport}
            disabled={isImporting || xdrInputs.every(i => !i.xdr.trim())}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 20px', fontSize: '13px', fontWeight: 600,
              background: isImporting || xdrInputs.every(i => !i.xdr.trim()) ? 'var(--bg-elevated)' : 'var(--cyan-glow)',
              border: `1px solid ${isImporting || xdrInputs.every(i => !i.xdr.trim()) ? 'var(--border)' : 'var(--cyan)'}`,
              borderRadius: 'var(--radius)', color: isImporting || xdrInputs.every(i => !i.xdr.trim()) ? 'var(--text-muted)' : 'var(--cyan)',
              cursor: isImporting || xdrInputs.every(i => !i.xdr.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            <Upload size={14} />
            {isImporting ? 'Importing...' : 'Import & Validate'}
          </button>
          <button
            onClick={handleClear}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 20px', fontSize: '13px', fontWeight: 600,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div style={{ background: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ 
            padding: '16px', 
            borderBottom: `1px solid ${palette.border}`, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
              Validation Results ({result.items.length})
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status="valid" label={`${validCount} Valid`} />
              <StatusBadge status="invalid" label={`${invalidCount} Invalid`} />
              {summary && summary.hasFeeBump && (
                <StatusBadge status="warning" label="Has Fee-Bump" />
              )}
              {summary && (
                <span style={{ fontSize: '11px', color: palette.muted, fontFamily: 'var(--font-mono)' }}>
                  Total Ops: {summary.totalOperations} | Total Fee: {summary.totalFee} stroops
                </span>
              )}
            </div>
          </div>
          
          <div style={{ padding: '16px', maxHeight: '600px', overflow: 'auto', display: 'grid', gap: '12px' }}>
            {result.items.map((item) => (
              <ExpandableRow
                key={item.index}
                item={item}
                expanded={expandedItems.has(item.index)}
                onToggle={() => toggleExpand(item.index)}
              />
            ))}
          </div>
          
          {validCount > 0 && (
            <div style={{ padding: '16px', borderTop: `1px solid ${palette.border}`, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const validXdrs = result.items
                    .filter(r => r.valid && xdrInputs[r.index]?.xdr)
                    .map(r => xdrInputs[r.index]!.xdr)
                    .join('\n')
                  navigator.clipboard.writeText(validXdrs)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 16px', fontSize: '12px', fontWeight: 600,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                <Copy size={14} /> Copy Valid XDRs
              </button>
              <button
                onClick={() => {
                  const report = JSON.stringify({
                    summary: result.summary,
                    items: result.items.map(r => ({
                      index: r.index,
                      label: r.label,
                      valid: r.valid,
                      envelope: r.envelope,
                      error: r.error,
                      warnings: r.warnings,
                    })),
                  }, null, 2)
                  const blob = new Blob([report], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `xdr-validation-report-${Date.now()}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 16px', fontSize: '12px', fontWeight: 600,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text-primary)', cursor: 'pointer',
                }}
              >
                <Download size={14} /> Export Report
              </button>
            </div>
          )}
        </div>
      )}

      {/* Broadcast Validation Results */}
      {broadcastValidation && Object.keys(broadcastValidation).length > 0 && (
        <div style={{ background: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: `1px solid ${palette.border}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
            Broadcast Readiness Check
          </div>
          <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
            {Object.entries(broadcastValidation).map(([indexStr, validation]) => {
              const index = parseInt(indexStr, 10)
              const input = xdrInputs[index]
              return (
                <div key={index} style={{ 
                  padding: '12px', 
                  borderRadius: 'var(--radius-md)',
                  background: validation.valid ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  border: `1px solid ${validation.valid ? palette.green : palette.red}33`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px' }}>
                      {input?.label || `Transaction ${index + 1}`}
                    </span>
                    <StatusBadge status={validation.valid ? 'valid' : 'invalid'} label={validation.valid ? 'Ready for Broadcast' : 'Not Ready'} />
                  </div>
                  {validation.warnings && validation.warnings.length > 0 && (
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {validation.warnings.map((w, i) => (
                        <div key={i} style={{
                          fontSize: '11px', 
                          color: palette.amber, 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          gap: '6px',
                          padding: '6px 8px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: `1px solid ${palette.amber}33`,
                          borderRadius: 'var(--radius-sm)',
                        }}>
                          <AlertTriangle size={10} style={{ flexShrink: 0, marginTop: '1px' }} />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!validation.valid && validation.error && (
                    <div style={{ fontSize: '11px', color: palette.red, marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                      {validation.error}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default BatchXdrImport