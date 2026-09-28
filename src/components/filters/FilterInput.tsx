import React, { useState, useCallback, useEffect } from 'react'
import { getDefinition, getOperatorLabel } from '../../lib/transactionFilters'

const inputBase = {
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '5px 8px',
  outline: 'none',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  transition: 'var(--transition)',
}

const selectStyle = {
  ...inputBase,
  cursor: 'pointer',
}

function OperatorSelect({ operators, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...selectStyle, width: 'auto', minWidth: '60px' }}
    >
      {operators.map((op) => (
        <option key={op} value={op}>{getOperatorLabel(op)}</option>
      ))}
    </select>
  )
}

function StringInput({ placeholder, value, onChange }) {
  return (
    <input
      type="text"
      placeholder={placeholder || 'Enter value'}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputBase, flex: 1, minWidth: '80px' }}
    />
  )
}

function NumberInput({ placeholder, value, onChange }) {
  return (
    <input
      type="number"
      placeholder={placeholder || '0'}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? null : Number(v))
      }}
      style={{ ...inputBase, width: '100px' }}
    />
  )
}

function RangeInput({ value, onChange, placeholder }) {
  const min = value?.min ?? ''
  const max = value?.max ?? ''

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <input
        type="number"
        placeholder={placeholder || 'Min'}
        value={min}
        onChange={(e) => {
          const v = e.target.value
          onChange({ ...(value || {}), min: v === '' ? undefined : Number(v) })
        }}
        style={{ ...inputBase, width: '90px' }}
      />
      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>to</span>
      <input
        type="number"
        placeholder={placeholder || 'Max'}
        value={max}
        onChange={(e) => {
          const v = e.target.value
          onChange({ ...(value || {}), max: v === '' ? undefined : Number(v) })
        }}
        style={{ ...inputBase, width: '90px' }}
      />
    </div>
  )
}

function DateInput({ value, onChange }) {
  const start = value?.start ? new Date(value.start).toISOString().split('T')[0] : ''
  const end = value?.end ? new Date(value.end).toISOString().split('T')[0] : ''

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <input
        type="date"
        value={start}
        onChange={(e) => {
          const d = e.target.value ? new Date(e.target.value).getTime() : undefined
          onChange({ ...(value || {}), start: d })
        }}
        style={{ ...inputBase, width: 'auto' }}
      />
      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>to</span>
      <input
        type="date"
        value={end}
        onChange={(e) => {
          const d = e.target.value ? new Date(e.target.value + 'T23:59:59.999').getTime() : undefined
          onChange({ ...(value || {}), end: d })
        }}
        style={{ ...inputBase, width: 'auto' }}
      />
    </div>
  )
}

function SelectInput({ options, value, onChange, multiple }) {
  if (multiple) {
    const selected = Array.isArray(value) ? value : []
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '200px' }}>
        {(options || []).map((opt) => (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 6px',
              fontSize: '11px',
              background: selected.includes(opt.value) ? 'var(--cyan-glow)' : 'var(--bg-card)',
              border: `1px solid ${selected.includes(opt.value) ? 'var(--cyan-dim)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: selected.includes(opt.value) ? 'var(--cyan)' : 'var(--text-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => {
                const next = selected.includes(opt.value)
                  ? selected.filter((v) => v !== opt.value)
                  : [...selected, opt.value]
                onChange(next)
              }}
              style={{ display: 'none' }}
            />
            {opt.label}
          </label>
        ))}
      </div>
    )
  }

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...selectStyle, maxWidth: '180px' }}
    >
      {!value && <option value="">Select...</option>}
      {(options || []).map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

function BooleanInput({ value, onChange }) {
  return (
    <select
      value={value === true ? 'true' : value === false ? 'false' : ''}
      onChange={(e) => onChange(e.target.value === 'true')}
      style={{ ...selectStyle, width: '80px' }}
    >
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  )
}

export default function FilterInput({ expression, operators, onChange }) {
  const def = getDefinition(expression.key)
  if (!def) return null

  const type = def.type
  const handleValueChange = useCallback((newValue) => {
    onChange({ ...expression, value: newValue })
  }, [expression, onChange])

  const handleOperatorChange = useCallback((newOp) => {
    const defaultValue = expression.value

    if (newOp === 'between' && (type === 'number' || type === 'date')) {
      onChange({ ...expression, operator: newOp, value: { min: undefined, max: undefined } })
    } else if (newOp === 'exists') {
      onChange({ ...expression, operator: newOp, value: true })
    } else if (newOp === 'in' && type === 'select') {
      onChange({ ...expression, operator: newOp, value: [] })
    } else {
      onChange({ ...expression, operator: newOp })
    }
  }, [expression, onChange, type])

  useEffect(() => {
    if (!expression.operator) {
      handleOperatorChange(def.defaultOperator)
    }
  }, [])

  const isBetween = expression.operator === 'between' || expression.operator === 'gte' || expression.operator === 'lte'

  const renderedOperators = operators || def.operators

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <OperatorSelect
        operators={renderedOperators}
        value={expression.operator || def.defaultOperator}
        onChange={handleOperatorChange}
      />

      {expression.operator === 'exists' ? (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Value must exist
        </span>
      ) : type === 'string' ? (
        <StringInput
          placeholder={def.placeholder}
          value={expression.value}
          onChange={handleValueChange}
        />
      ) : type === 'number' && isBetween ? (
        <NumberInput
          placeholder={def.placeholder}
          value={expression.value}
          onChange={handleValueChange}
        />
      ) : type === 'number' && expression.operator === 'between' ? (
        <RangeInput
          placeholder={def.placeholder}
          value={expression.value}
          onChange={handleValueChange}
        />
      ) : type === 'date' && (expression.operator === 'between') ? (
        <DateInput
          value={expression.value}
          onChange={handleValueChange}
        />
      ) : type === 'date' ? (
        <DateInput
          value={{ start: expression.value, end: expression.operator === 'lte' ? expression.value : undefined }}
          onChange={(v) => handleValueChange(expression.operator === 'lte' ? v.end : v.start)}
        />
      ) : type === 'boolean' ? (
        <BooleanInput
          value={expression.value}
          onChange={handleValueChange}
        />
      ) : type === 'select' && (expression.operator === 'in') ? (
        <SelectInput
          options={def.options}
          value={expression.value}
          onChange={handleValueChange}
          multiple
        />
      ) : type === 'select' ? (
        <SelectInput
          options={def.options}
          value={expression.value}
          onChange={handleValueChange}
        />
      ) : (
        <StringInput
          placeholder={def.placeholder}
          value={expression.value}
          onChange={handleValueChange}
        />
      )}
    </div>
  )
}
