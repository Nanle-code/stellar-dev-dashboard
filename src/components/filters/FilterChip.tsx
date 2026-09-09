import React from 'react'
import { X } from 'lucide-react'
import { getDefinition, getOperatorLabel, expressionToSummary } from '../../lib/transactionFilters'

export default function FilterChip({ expression, onRemove, onClick, style }) {
  const def = getDefinition(expression.key)

  if (!def) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
          ...style,
        }}
      >
        {expression.key}: {String(expression.value)}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove?.() }}
          style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
          title="Remove filter"
        >
          <X size={11} />
        </button>
      </span>
    )
  }

  const operatorLabel = getOperatorLabel(expression.operator || def.defaultOperator)
  let valueDisplay = expression.value

  if (def.type === 'select' && def.options) {
    const opt = def.options.find((o) => o.value === expression.value)
    if (opt) valueDisplay = opt.label
  }
  if (Array.isArray(valueDisplay)) {
    valueDisplay = valueDisplay.join(', ')
  }
  if (typeof valueDisplay === 'object') {
    const parts = []
    if (valueDisplay.min != null) parts.push(`\u2265${valueDisplay.min}`)
    if (valueDisplay.max != null) parts.push(`\u2264${valueDisplay.max}`)
    if (valueDisplay.start != null) parts.push(`from ${new Date(valueDisplay.start).toLocaleDateString()}`)
    if (valueDisplay.end != null) parts.push(`to ${new Date(valueDisplay.end).toLocaleDateString()}`)
    valueDisplay = parts.join(' ')
  }
  if (typeof valueDisplay === 'boolean') {
    valueDisplay = valueDisplay ? 'Yes' : 'No'
  }

  const prefix = expression.not ? 'not ' : ''

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        background: 'var(--cyan-glow)',
        border: '1px solid var(--cyan-dim)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--cyan)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'var(--transition)',
        ...style,
      }}
      title={expressionToSummary(expression)}
    >
      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{def.shortLabel || def.label}</span>
      <span style={{ color: 'var(--text-secondary)', margin: '0 1px' }}>{operatorLabel}</span>
      <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {String(valueDisplay)}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove?.() }}
        style={{
          border: 'none',
          background: 'none',
          color: 'var(--cyan)',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          opacity: 0.6,
          marginLeft: '2px',
        }}
        title="Remove filter"
      >
        <X size={11} />
      </button>
    </span>
  )
}
