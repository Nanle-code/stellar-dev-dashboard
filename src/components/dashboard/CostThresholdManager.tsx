import React, { useState } from 'react'
import { Bell, BellOff, Plus, Trash2, AlertTriangle, DollarSign } from 'lucide-react'
import { useGasPredictionStore } from '../../lib/gasPredictionStore'
import { getGasPredictionService } from '../../lib/gasPredictionService'
import type { CostThreshold } from '../../lib/gasPredictionService'

const palette = {
  bgCard: 'var(--bg-card)',
  border: 'var(--border)',
  elevated: 'var(--bg-elevated)',
  primary: 'var(--text-primary)',
  muted: 'var(--text-muted)',
  cyan: 'var(--cyan)',
  red: '#ef4444',
  green: '#22c55e',
}

function ActionButton({ label, onClick, disabled, tone = 'primary' }: { label: string; onClick: () => void; disabled?: boolean; tone?: string }) {
  const bg = disabled ? palette.elevated : tone === 'danger' ? palette.red : tone === 'secondary' ? palette.elevated : palette.cyan
  const text = disabled ? palette.muted : tone === 'danger' ? 'white' : tone === 'secondary' ? palette.primary : 'var(--bg-base)'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        background: bg,
        color: text,
        border: disabled ? `1px solid var(--border)` : tone === 'secondary' ? '1px solid var(--border-bright)' : 'none',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        fontSize: '11px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'var(--transition)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {label}
    </button>
  )
}

const defaultPresets: Array<{ label: string; maxResourceFee: number }> = [
  { label: 'Low Cost', maxResourceFee: 200 },
  { label: 'Medium Cost', maxResourceFee: 500 },
  { label: 'High Cost', maxResourceFee: 1000 },
]

export function CostThresholdManager() {
  const { thresholds, addThreshold, removeThreshold, updateThreshold } = useGasPredictionStore()
  const [showForm, setShowForm] = useState(false)
  const [formLabel, setFormLabel] = useState('')
  const [formFee, setFormFee] = useState('500')

  async function handleAdd() {
    if (!formLabel.trim() || !formFee.trim()) return
    const threshold: CostThreshold = {
      id: `threshold-${Date.now()}`,
      label: formLabel.trim(),
      maxResourceFee: parseInt(formFee, 10),
      enabled: true,
      notifyOnExceed: true,
    }
    addThreshold(threshold)
    getGasPredictionService().setThresholds([...thresholds, threshold])
    setFormLabel('')
    setFormFee('500')
    setShowForm(false)
  }

  function handleRemove(id: string) {
    removeThreshold(id)
    const updated = thresholds.filter(t => t.id !== id)
    getGasPredictionService().setThresholds(updated)
  }

  function handleToggle(id: string) {
    const t = thresholds.find(th => th.id === id)
    if (!t) return
    updateThreshold(id, { enabled: !t.enabled })
    const updated = thresholds.map(th => th.id === id ? { ...th, enabled: !th.enabled } : th)
    getGasPredictionService().setThresholds(updated)
  }

  function applyPreset(preset: { label: string; maxResourceFee: number }) {
    setFormLabel(preset.label)
    setFormFee(String(preset.maxResourceFee))
    setShowForm(true)
  }

  return (
    <div style={{
      background: palette.bgCard,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign size={16} color={palette.cyan} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', color: palette.primary }}>
            Cost Thresholds
          </span>
        </div>
        <ActionButton label={showForm ? 'Cancel' : 'Add'} onClick={() => setShowForm(!showForm)} tone="secondary" />
      </div>

      <div style={{ padding: '16px' }}>
        {showForm && (
          <div style={{ marginBottom: '16px', padding: '12px', background: palette.elevated, borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              value={formLabel}
              onChange={e => setFormLabel(e.target.value)}
              placeholder="Label (e.g. Budget)"
              style={{
                background: palette.bgCard,
                border: '1px solid var(--border-bright)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: palette.primary,
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
            <input
              type="number"
              value={formFee}
              onChange={e => setFormFee(e.target.value)}
              placeholder="Max resource fee (stroops)"
              style={{
                background: palette.bgCard,
                border: '1px solid var(--border-bright)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: palette.primary,
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {defaultPresets.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  style={{
                    padding: '4px 8px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: palette.muted,
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  {p.label} ({p.maxResourceFee})
                </button>
              ))}
            </div>
            <ActionButton label="Add Threshold" onClick={handleAdd} disabled={!formLabel.trim() || !formFee.trim()} />
          </div>
        )}

        {thresholds.length === 0 ? (
          <div style={{ fontSize: '12px', color: palette.muted, textAlign: 'center', padding: '12px' }}>
            No cost thresholds configured. Add one to get notified when gas costs exceed your budget.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {thresholds.map(t => (
              <div key={t.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: palette.elevated,
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${t.enabled ? 'var(--border-bright)' : 'var(--border)'}`,
                opacity: t.enabled ? 1 : 0.5,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: palette.primary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {t.label}
                    {!t.enabled && <span style={{ fontSize: '9px', color: palette.muted }}>(disabled)</span>}
                  </div>
                  <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: palette.muted, marginTop: '2px' }}>
                    Max: {t.maxResourceFee.toLocaleString()} stroops
                    {t.notifyOnExceed && ' · Notify on exceed'}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(t.id)}
                  title={t.enabled ? 'Disable' : 'Enable'}
                  style={{ background: 'none', border: 'none', color: palette.muted, cursor: 'pointer', padding: '4px' }}
                >
                  {t.enabled ? <BellOff size={14} /> : <Bell size={14} />}
                </button>
                <button
                  onClick={() => handleRemove(t.id)}
                  title="Remove"
                  style={{ background: 'none', border: 'none', color: palette.red, cursor: 'pointer', padding: '4px' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CostThresholdManager
