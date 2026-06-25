import React, { useState } from 'react'
import { Star, Plus } from 'lucide-react'
import { useAddressLabels } from '../../hooks/useAddressLabels'
import { CATEGORIES } from '../../lib/addressLabels'
import { isValidPublicKey } from '../../lib/stellar'

const categoryColor = (cat) => {
  const found = CATEGORIES.find((c) => c.value === cat)
  return found ? found.color : '#6b7280'
}

export default function AddressLabelBadge({ address, showAddLabel = true }) {
  const { labelMap, addLabel } = useAddressLabels()
  const [adding, setAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const entry = labelMap[address]

  if (!entry) {
    if (!showAddLabel || !address || !isValidPublicKey(address)) return null

    if (adding) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '4px', verticalAlign: 'middle' }}>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Label"
            style={{
              width: '70px',
              padding: '1px 4px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-card)',
              border: '1px solid var(--cyan-dim)',
              borderRadius: '3px',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                await addLabel(address, { label: inputValue.trim() })
                setInputValue('')
                setAdding(false)
              }
              if (e.key === 'Escape') setAdding(false)
            }}
            onBlur={() => {
              if (!inputValue.trim()) setAdding(false)
            }}
            autoFocus
          />
        </span>
      )
    }

    return (
      <button
        onClick={() => setAdding(true)}
        title="Add label"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '1px 3px',
          marginLeft: '2px',
          opacity: 0.35,
          verticalAlign: 'middle',
          transition: 'var(--transition)',
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.35'}
      >
        <Plus size={9} />
      </button>
    )
  }

  const dotColor = entry.color || categoryColor(entry.category)

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '1px 5px 1px 3px',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        background: `${dotColor}18`,
        border: `1px solid ${dotColor}45`,
        borderRadius: '4px',
        color: dotColor,
        verticalAlign: 'middle',
        marginLeft: '4px',
        whiteSpace: 'nowrap',
        transition: 'var(--transition)',
        cursor: 'default',
      }}
      title={[entry.label, entry.category !== 'other' ? `(${entry.category})` : '', entry.tags.length ? `[${entry.tags.join(', ')}]` : ''].filter(Boolean).join(' ')}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />
      <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {entry.label}
      </span>
      {entry.favorite && <Star size={7} fill={dotColor} style={{ flexShrink: 0 }} />}
    </span>
  )
}
