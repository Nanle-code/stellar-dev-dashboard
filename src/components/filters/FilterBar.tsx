import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import FilterChip from './FilterChip'
import FilterInput from './FilterInput'
import { registry, getFilterByScope, countActiveFilters } from '../../lib/transactionFilters'

const btnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'var(--transition)',
  whiteSpace: 'nowrap',
}

function FilterScopeGroup({ scope, label, onSelect }) {
  const filters = getFilterByScope(scope)

  if (filters.length === 0) return null

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--text-muted)',
        padding: '4px 10px',
        marginBottom: '2px',
      }}>
        {label}
      </div>
      {filters.map((def) => (
        <button
          key={def.key}
          onClick={() => onSelect(def)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '6px 10px',
            border: 'none',
            background: 'none',
            color: 'var(--text-primary)',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            borderRadius: 'var(--radius-sm)',
            transition: 'var(--transition)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          <span style={{ color: 'var(--cyan)', marginRight: '6px' }}>{def.label}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {def.type === 'select' ? `${def.options?.length || 0} options` : def.type}
          </span>
        </button>
      ))}
    </div>
  )
}

export default function FilterBar({
  expressions,
  onExpressionsChange,
  scope = 'both',
  showAddButton = true,
  showClearButton = true,
  compact = false,
}) {
  const [adding, setAdding] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const dropdownRef = useRef(null)

  const activeCount = useMemo(() => countActiveFilters(expressions), [expressions])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAdding(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddFilter = useCallback((def) => {
    const newExpr = {
      key: def.key,
      operator: def.defaultOperator,
      value: def.type === 'boolean' ? true : def.type === 'number' ? null : '',
    }
    onExpressionsChange([...(expressions || []), newExpr])
    setAdding(false)
    setEditingIndex(expressions ? expressions.length : 0)
  }, [expressions, onExpressionsChange])

  const handleRemove = useCallback((index) => {
    const next = (expressions || []).filter((_, i) => i !== index)
    onExpressionsChange(next)
    if (editingIndex === index) setEditingIndex(null)
    else if (editingIndex > index) setEditingIndex(editingIndex - 1)
  }, [expressions, onExpressionsChange, editingIndex])

  const handleClear = useCallback(() => {
    onExpressionsChange([])
    setEditingIndex(null)
  }, [onExpressionsChange])

  const handleUpdate = useCallback((index, updatedExpr) => {
    const next = [...(expressions || [])]
    next[index] = updatedExpr
    onExpressionsChange(next)
  }, [expressions, onExpressionsChange])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && editingIndex != null) {
      setEditingIndex(null)
    }
  }, [editingIndex])

  const scopes = scope === 'both'
    ? [['transaction', 'Transactions'], ['operation', 'Operations'], ['contract', 'Contracts']]
    : [[scope, scope.charAt(0).toUpperCase() + scope.slice(1)]]

  if (compact && expressions && expressions.length > 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', position: 'relative' }}>
        {expressions.map((expr, i) => (
          <FilterChip
            key={`${expr.key}-${i}`}
            expression={expr}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {expressions && expressions.length > 0 ? (
          expressions.map((expr, i) => (
            editingIndex === i ? (
              <div
                key={`edit-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--cyan-dim)',
                  borderRadius: 'var(--radius-sm)',
                }}
                onKeyDown={handleKeyDown}
              >
                <FilterInput
                  expression={expr}
                  onChange={(updated) => handleUpdate(i, updated)}
                />
                <button
                  onClick={() => setEditingIndex(null)}
                  style={{
                    border: 'none',
                    background: 'var(--cyan)',
                    color: 'var(--bg-base)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Done
                </button>
                <button
                  onClick={() => handleRemove(i)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <FilterChip
                key={`${expr.key}-${i}`}
                expression={expr}
                onRemove={() => handleRemove(i)}
                onClick={() => setEditingIndex(i)}
              />
            )
          ))
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No filters active
          </span>
        )}

        {showAddButton && (
          <button
            onClick={() => setAdding(!adding)}
            style={{
              ...btnStyle,
              background: adding ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
              borderColor: adding ? 'var(--cyan-dim)' : 'var(--border)',
              color: adding ? 'var(--cyan)' : 'var(--text-secondary)',
            }}
          >
            <Plus size={12} />
            <span>Add Filter</span>
          </button>
        )}

        {showClearButton && activeCount > 0 && (
          <button
            onClick={handleClear}
            style={{
              ...btnStyle,
              color: 'var(--text-muted)',
              fontSize: '10px',
              border: 'none',
            }}
          >
            Clear all
          </button>
        )}

        {activeCount > 0 && (
          <span style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginLeft: '4px',
          }}>
            {activeCount} filter{activeCount !== 1 ? 's' : ''} active
          </span>
        )}
      </div>

      {/* Add filter dropdown */}
      {adding && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 100,
            minWidth: '260px',
            maxHeight: '360px',
            overflowY: 'auto',
            padding: '6px 0',
          }}
        >
          {scopes.map(([scopeKey, scopeLabel]) => (
            <FilterScopeGroup
              key={scopeKey}
              scope={scopeKey}
              label={scopeLabel}
              onSelect={handleAddFilter}
            />
          ))}
        </div>
      )}
    </div>
  )
}
