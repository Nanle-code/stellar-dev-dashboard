import React, { useState } from 'react'
import { usePreferences } from '../../hooks/usePreferences'
import { isValidPublicKey } from '../../lib/stellar'
import CopyableValue from '../dashboard/CopyableValue'

export default function AddressBook() {
  const { preferences, addAddress, removeAddress } = usePreferences()
  const [form, setForm] = useState({ label: '', address: '', network: 'testnet' })
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!form.label.trim()) { setError('Label is required'); return }
    if (!isValidPublicKey(form.address.trim())) { 
      setError('Invalid Stellar address. Use G... (Ed25519), M... (muxed), or name*domain (federated)')
      return 
    }
    setError('')
    await addAddress({ label: form.label.trim(), address: form.address.trim(), network: form.network })
    setForm({ label: '', address: '', network: 'testnet' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Add form */}
      <div style={{
        padding: '14px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Add Address
        </div>
        <input
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          placeholder="Label (e.g. My Wallet)"
          style={inputStyle}
        />
        <input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="G... public key, M... muxed, or name*domain federated"
          style={inputStyle}
        />
        <select
          value={form.network}
          onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
          style={inputStyle}
        >
          {['mainnet', 'testnet', 'futurenet'].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        {error && <div style={{ fontSize: '11px', color: 'var(--red)' }}>{error}</div>}
        <button
          onClick={handleAdd}
          style={{
            padding: '8px 14px',
            background: 'var(--cyan)',
            color: 'var(--bg-base)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          + Add
        </button>
      </div>

      {/* Address list */}
      {preferences.savedAddresses.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>
          No saved addresses yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {preferences.savedAddresses.map((entry) => (
            <div key={entry.address} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {entry.label}
                </div>
                <CopyableValue
                  value={entry.address}
                  title="Copy address"
                  textStyle={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {entry.address.slice(0, 8)}…{entry.address.slice(-8)}
                </CopyableValue>
              </div>
              <span style={{
                fontSize: '9px',
                padding: '2px 6px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '999px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}>
                {entry.network}
              </span>
              <button
                onClick={() => removeAddress(entry.address)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '2px',
                  flexShrink: 0,
                }}
                title="Remove address"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-bright)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 10px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  boxSizing: 'border-box',
}
