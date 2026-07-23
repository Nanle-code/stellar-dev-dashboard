import React from 'react'
import { Filter } from 'lucide-react'
import FilterBar from './FilterBar'
import { useStore } from '../../lib/store'

export default function TransactionFilterPanel({ view = 'transactions' }) {
  const filterExpressions = useStore((s) => s.filterExpressions)
  const setFilterExpressions = useStore((s) => s.setFilterExpressions)

  const scope = view === 'transactions' ? 'transaction' : 'operation'

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: filterExpressions && filterExpressions.length > 0 ? '10px' : 0 }}>
        <Filter size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Filters
        </span>
      </div>
      <FilterBar
        expressions={filterExpressions}
        onExpressionsChange={setFilterExpressions}
        scope={scope}
      />
    </div>
  )
}
