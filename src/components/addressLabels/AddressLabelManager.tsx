import React, { useState, useEffect, useRef } from 'react'
import {
  Search, Star, Plus, Trash2, X,
  FileUp, FileDown, Check,
} from 'lucide-react'
import { useAddressLabels } from '../../hooks/useAddressLabels'
import {
  CATEGORIES, LABEL_COLORS, DEFAULT_TAGS,
  bulkImport, getAllLabels, getAllTags,
} from '../../lib/addressLabels'
import { shortAddress } from '../../lib/stellar'

const emptyForm = () => ({
  address: '',
  label: '',
  tags: [],
  category: 'other',
  color: '',
  favorite: false,
  notes: '',
  network: 'all',
})

export default function AddressLabelManager({ onClose }) {
  const { labels, addLabel, updateLabel, removeLabel, searchLabels } = useAddressLabels()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(labels)
  const [editingAddress, setEditingAddress] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [tagInput, setTagInput] = useState('')
  const [allKnownTags, setAllKnownTags] = useState(DEFAULT_TAGS)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState('')
  const searchRef = useRef(null)

  useEffect(() => {
    getAllTags().then(setAllKnownTags)
  }, [labels])

  useEffect(() => {
    if (query.trim()) {
      searchLabels(query).then(setResults)
    } else {
      setResults(labels)
    }
  }, [query, labels, searchLabels])

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus()
  }, [])

  const startEdit = (entry) => {
    setEditingAddress(entry.address)
    setForm({
      address: entry.address,
      label: entry.label || '',
      tags: [...(entry.tags || [])],
      category: entry.category || 'other',
      color: entry.color || '',
      favorite: !!entry.favorite,
      notes: entry.notes || '',
      network: entry.network || 'all',
    })
    setTagInput('')
  }

  const startAdd = () => {
    setEditingAddress('__new__')
    setForm(emptyForm())
    setTagInput('')
  }

  const handleSave = async () => {
    if (!form.address.trim() || !form.label.trim()) return
    if (editingAddress === '__new__') {
      await addLabel(form.address.trim(), {
        label: form.label.trim(),
        tags: form.tags,
        category: form.category,
        color: form.color,
        favorite: form.favorite,
        notes: form.notes,
        network: form.network,
      })
    } else {
      await updateLabel(editingAddress, {
        label: form.label.trim(),
        tags: form.tags,
        category: form.category,
        color: form.color,
        favorite: form.favorite,
        notes: form.notes,
        network: form.network,
      })
    }
    setEditingAddress(null)
    setForm(emptyForm())
  }

  const handleDelete = async (address) => {
    await removeLabel(address)
    if (editingAddress === address) {
      setEditingAddress(null)
      setForm(emptyForm())
    }
  }

  const addTag = (tag) => {
    const t = tag.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }))
    }
    setTagInput('')
  }

  const removeTag = (tag) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importText)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      await bulkImport(arr)
      setImportResult(`Imported ${arr.length} label(s)`)
      setImportText('')
      setTimeout(() => setImportResult(''), 3000)
    } catch {
      setImportResult('Invalid JSON')
      setTimeout(() => setImportResult(''), 3000)
    }
  }

  const handleExport = async () => {
    const all = await getAllLabels()
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'stellar-labels.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Address Labels</h3>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={startAdd}
            style={btnStyle}
            title="Add new label"
          >
            <Plus size={14} /> Add
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            style={btnStyle}
            title="Import/Export"
          >
            <FileUp size={14} />
          </button>
          <button
            onClick={handleExport}
            style={btnStyle}
            title="Export JSON"
          >
            <FileDown size={14} />
          </button>
          {onClose && (
            <button onClick={onClose} style={{ ...btnStyle, color: 'var(--text-muted)' }} title="Close">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search labels, addresses, tags..."
          style={{
            width: '100%',
            padding: '6px 8px 6px 28px',
            fontSize: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Import section */}
      {showImport && (
        <div style={{ padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Paste JSON array: [{"address":"G...","label":"Name","category":"personal","tags":["hot-wallet"]}]'
            rows={3}
            style={{
              width: '100%',
              padding: '6px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={handleImport} style={btnStyle}><Check size={12} /> Import</button>
            {importResult && <span style={{ fontSize: '11px', color: importResult.startsWith('Imported') ? '#22c55e' : '#ef4444' }}>{importResult}</span>}
          </div>
        </div>
      )}

      {/* Edit form */}
      {editingAddress && (
        <div style={{
          padding: '10px',
          background: 'var(--bg-card)',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          border: '1px solid var(--cyan-dim)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {editingAddress === '__new__' ? 'New Label' : shortAddress(editingAddress)}
            </span>
            <button onClick={() => setEditingAddress(null)} style={{ ...btnStyle, color: 'var(--text-muted)' }}><X size={12} /></button>
          </div>

          {editingAddress === '__new__' && (
            <InputField label="Address" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="G..." mono />
          )}
          <InputField label="Label" value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="Display name" />

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Category</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                  style={{
                    padding: '2px 8px',
                    fontSize: '10px',
                    borderRadius: '10px',
                    border: `1px solid ${form.category === c.value ? c.color : 'var(--border-subtle)'}`,
                    background: form.category === c.value ? `${c.color}20` : 'transparent',
                    color: form.category === c.value ? c.color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {LABEL_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setForm((f) => ({ ...f, color: f.color === c.value ? '' : c.value }))}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: c.value,
                    border: form.color === c.value ? '2px solid var(--text-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                  }}
                  title={c.label}
                />
              ))}
              {form.color && (
                <button
                  onClick={() => setForm((f) => ({ ...f, color: '' }))}
                  style={{ ...btnStyle, fontSize: '9px' }}
                  title="Clear color"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '3px' }}>
              {form.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '1px 6px',
                    fontSize: '9px',
                    background: 'var(--cyan-dim)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {t}
                  <X size={8} style={{ cursor: 'pointer' }} onClick={() => removeTag(t)} />
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                placeholder="Add tag..."
                style={{
                  flex: 1,
                  padding: '2px 6px',
                  fontSize: '10px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '3px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button onClick={() => addTag(tagInput)} style={btnStyle}><Plus size={11} /></button>
            </div>
            {/* Known tag suggestions */}
            {tagInput && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '2px' }}>
                {allKnownTags
                  .filter((t) => t.includes(tagInput.toLowerCase()) && !form.tags.includes(t))
                  .slice(0, 6)
                  .map((t) => (
                    <button key={t} onClick={() => addTag(t)} style={{
                      padding: '1px 6px', fontSize: '9px', background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)', borderRadius: '8px', cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}>
                      +{t}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Favorite & Notes */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={form.favorite}
                onChange={(e) => setForm((f) => ({ ...f, favorite: e.target.checked }))}
                style={{ accentColor: 'var(--cyan-dim)' }}
              />
              <Star size={11} fill={form.favorite ? '#f59e0b' : 'none'} color={form.favorite ? '#f59e0b' : 'var(--text-muted)'} />
              Favorite
            </label>
          </div>
          <div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes..."
              rows={2}
              style={{
                width: '100%',
                padding: '4px 6px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} style={{ ...btnStyle, background: 'var(--cyan-dim)', color: 'var(--text-primary)', fontWeight: 600 }}>
              <Check size={12} /> Save
            </button>
            {editingAddress !== '__new__' && (
              <button onClick={() => handleDelete(editingAddress)} style={{ ...btnStyle, color: '#ef4444' }}>
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
            {query ? 'No labels match your search' : 'No labels yet — click "Add" to create one'}
          </div>
        )}
        {results.map((entry) => {
          const dotColor = entry.color || CATEGORIES.find((c) => c.value === entry.category)?.color || '#6b7280'
          const isEditing = editingAddress === entry.address
          return (
            <div
              key={entry.address}
              onClick={() => !isEditing && startEdit(entry)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '4px',
                cursor: isEditing ? 'default' : 'pointer',
                background: isEditing ? 'var(--bg-card)' : 'transparent',
                transition: 'var(--transition)',
                border: isEditing ? '1px solid var(--cyan-dim)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.background = 'var(--bg-card)' }}
              onMouseLeave={(e) => { if (!isEditing) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500 }}>{entry.label}</span>
                  {entry.favorite && <Star size={9} fill="#f59e0b" color="#f59e0b" />}
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {shortAddress(entry.address)}
                  </span>
                </div>
                {entry.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                    {entry.tags.slice(0, 4).map((t) => (
                      <span key={t} style={{ padding: '0 4px', fontSize: '8px', background: 'var(--border-subtle)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                        {t}
                      </span>
                    ))}
                    {entry.tags.length > 4 && <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>+{entry.tags.length - 4}</span>}
                  </div>
                )}
              </div>
              {!isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(entry.address) }}
                  style={{ ...btnStyle, opacity: 0, color: '#ef4444' }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '4px 6px',
          fontSize: '11px',
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px',
          color: 'var(--text-primary)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

const btnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  fontSize: '11px',
  border: '1px solid var(--border-subtle)',
  borderRadius: '4px',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'var(--transition)',
  whiteSpace: 'nowrap',
}
