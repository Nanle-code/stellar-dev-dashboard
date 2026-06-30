import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import { OPERATION_LABELS } from '../../lib/stellar';

export const EMPTY_TRANSACTION_FILTERS = {
  status: 'all',
  memoOnly: false,
  minFee: '',
  maxFee: '',
  type: 'all',
  minAmount: '',
  maxAmount: '',
  startDate: '',
  endDate: '',
};

const inputStyle = {
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  outline: 'none',
};

const labelStyle = {
  color: 'var(--text-muted)',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

export default function SearchFilters({
  filters,
  onChange,
  savedSearches = [],
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}) {
  const [presetName, setPresetName] = useState('');

  const handleChange = (key, value) => {
    onChange({ [key]: value });
  };

  const resetFilters = () => {
    onChange(EMPTY_TRANSACTION_FILTERS);
  };

  const savePreset = () => {
    const name = presetName.trim() || `Preset ${new Date().toLocaleTimeString()}`;
    onSavePreset?.(name);
    setPresetName('');
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      padding: '16px',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      fontSize: '13px',
      marginBottom: '20px',
      alignItems: 'flex-end',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Status</label>
        <select
          value={filters.status}
          onChange={(event) => handleChange('status', event.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="all">All Transactions</option>
          <option value="success">Successful Only</option>
          <option value="failed">Failed Only</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Operation Type</label>
        <select
          value={filters.type}
          onChange={(event) => handleChange('type', event.target.value)}
          style={{ ...inputStyle, cursor: 'pointer', maxWidth: '180px' }}
        >
          <option value="all">All Types</option>
          {Object.entries(OPERATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Fee (stroops)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="number"
            placeholder="Min"
            value={filters.minFee}
            onChange={(event) => handleChange('minFee', event.target.value)}
            style={{ ...inputStyle, width: '70px' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>-</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxFee}
            onChange={(event) => handleChange('maxFee', event.target.value)}
            style={{ ...inputStyle, width: '70px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Amount</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="number"
            step="any"
            placeholder="Min"
            value={filters.minAmount}
            onChange={(event) => handleChange('minAmount', event.target.value)}
            style={{ ...inputStyle, width: '86px' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>-</span>
          <input
            type="number"
            step="any"
            placeholder="Max"
            value={filters.maxAmount}
            onChange={(event) => handleChange('maxAmount', event.target.value)}
            style={{ ...inputStyle, width: '86px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={labelStyle}>Date Range</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => handleChange('startDate', event.target.value)}
            style={inputStyle}
          />
          <span style={{ color: 'var(--text-muted)' }}>-</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => handleChange('endDate', event.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px' }}>
        <input
          type="checkbox"
          id="memoOnly"
          checked={filters.memoOnly}
          onChange={(event) => handleChange('memoOnly', event.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <label htmlFor="memoOnly" style={{ cursor: 'pointer', fontWeight: 500, color: filters.memoOnly ? 'var(--cyan)' : 'var(--text-primary)' }}>
          Memo Only
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
        <label style={labelStyle}>Filter Presets</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Preset name"
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <button
            onClick={savePreset}
            title="Save filter preset"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <Save size={14} />
          </button>
        </div>
        {savedSearches.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '360px' }}>
            {savedSearches.slice(0, 6).map((entry) => (
              <span
                key={entry.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px 6px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}
              >
                <button
                  onClick={() => onApplyPreset?.(entry)}
                  style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: '11px', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
                >
                  {entry.name}
                </button>
                <button
                  onClick={() => onDeletePreset?.(entry.name)}
                  title="Delete preset"
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={resetFilters}
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '11px',
          cursor: 'pointer',
          padding: '8px',
          textDecoration: 'underline',
        }}
        onMouseEnter={(event) => event.currentTarget.style.color = 'var(--red)'}
        onMouseLeave={(event) => event.currentTarget.style.color = 'var(--text-muted)'}
      >
        Reset Filters
      </button>
    </div>
  );
}
