import React, { useState, useEffect } from 'react';
import { useResponsive } from '../../hooks/useResponsive';

const DEFAULT_FILTERS = {
  verified_only: false,
  min_accounts: null,
  max_accounts: null,
  has_domain: false,
  sort_by: 'num_accounts',
  order: 'desc',
  asset_type: '',
  code_pattern: '',
  min_volume_24h: null,
  volatility: '',
  reputation_min: 0,
  verification_level: '',
};

const PRESET_STORAGE_KEY = 'asset_filter_presets';

function loadPresets() {
  try {
    return JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePresets(presets) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

export default function AssetFilters({ filters, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [presets, setPresets] = useState(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);
  const { isMobile } = useResponsive();

  const handleFilterChange = (key, value) => {
    onChange({ [key]: value });
  };

  const resetFilters = () => {
    onChange({ ...DEFAULT_FILTERS });
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    const newPreset = { name: presetName.trim(), filters: { ...filters } };
    const updated = [...presets, newPreset];
    setPresets(updated);
    savePresets(updated);
    setPresetName('');
    setShowPresetInput(false);
  };

  const loadPreset = (preset) => {
    onChange({ ...DEFAULT_FILTERS, ...preset.filters });
  };

  const deletePreset = (index) => {
    const updated = presets.filter((_, i) => i !== index);
    setPresets(updated);
    savePresets(updated);
  };

  // Compute active filter count for badge
  const activeCount = [
    filters.verified_only,
    filters.has_domain,
    filters.min_accounts,
    filters.max_accounts,
    filters.asset_type,
    filters.code_pattern,
    filters.min_volume_24h,
    filters.volatility,
    filters.reputation_min > 0,
    filters.verification_level,
  ].filter(Boolean).length;

  const s = {
    container: {
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: isMobile ? '16px' : '20px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
    },
    title: {
      fontSize: '14px',
      fontWeight: 600,
      color: 'var(--text-primary)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    badge: {
      background: 'var(--cyan)',
      color: 'var(--bg-base)',
      borderRadius: '999px',
      fontSize: '10px',
      fontWeight: 700,
      padding: '1px 6px',
    },
    btnRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    btn: {
      background: 'none',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      color: 'var(--text-secondary)',
      fontSize: '12px',
      padding: '6px 12px',
      cursor: 'pointer',
      fontFamily: 'var(--font-mono)',
      transition: 'var(--transition)',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(190px, 1fr))',
      gap: '16px',
      marginBottom: '16px',
    },
    group: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: {
      fontSize: '11px',
      fontWeight: 600,
      color: 'var(--text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    select: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-primary)',
      fontSize: '13px',
      fontFamily: 'var(--font-mono)',
      padding: '8px 12px',
      cursor: 'pointer',
    },
    input: {
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--text-primary)',
      fontSize: '13px',
      fontFamily: 'var(--font-mono)',
      padding: '8px 12px',
    },
    checkRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      padding: '6px 0',
    },
    chip: (color) => ({
      background: `${color}20`,
      color,
      border: `1px solid ${color}40`,
      borderRadius: 'var(--radius-sm)',
      fontSize: '11px',
      fontWeight: 600,
      padding: '2px 8px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }),
    divider: {
      borderTop: '1px solid var(--border)',
      paddingTop: '16px',
      marginTop: '4px',
    },
  };

  const activeChips = [
    filters.verified_only && { label: 'Verified Only', color: 'var(--green)', key: 'verified_only', reset: false },
    filters.has_domain && { label: 'Has Domain', color: 'var(--cyan)', key: 'has_domain', reset: false },
    filters.verification_level && { label: `Level: ${filters.verification_level}`, color: 'var(--cyan)', key: 'verification_level', reset: '' },
    filters.min_accounts && { label: `Min ${filters.min_accounts} accts`, color: 'var(--text-secondary)', key: 'min_accounts', reset: null },
    filters.max_accounts && { label: `Max ${filters.max_accounts} accts`, color: 'var(--text-secondary)', key: 'max_accounts', reset: null },
    filters.asset_type && { label: filters.asset_type === 'credit_alphanum4' ? '4-char codes' : '12-char codes', color: 'var(--amber)', key: 'asset_type', reset: '' },
    filters.code_pattern && { label: `Pattern: ${filters.code_pattern}`, color: 'var(--amber)', key: 'code_pattern', reset: '' },
    filters.min_volume_24h && { label: `Vol ≥ $${Number(filters.min_volume_24h).toLocaleString()}`, color: 'var(--green)', key: 'min_volume_24h', reset: null },
    filters.volatility && { label: `Volatility: ${filters.volatility}`, color: 'var(--red)', key: 'volatility', reset: '' },
    filters.reputation_min > 0 && { label: `Rep ≥ ${filters.reputation_min}`, color: 'var(--cyan)', key: 'reputation_min', reset: 0 },
  ].filter(Boolean);

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>
          🔧 Filters
          {activeCount > 0 && <span style={s.badge}>{activeCount}</span>}
        </div>
        <div style={s.btnRow}>
          {presets.length > 0 && (
            <select
              style={{ ...s.btn, cursor: 'pointer' }}
              defaultValue=""
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                if (!isNaN(idx)) loadPreset(presets[idx]);
                e.target.value = '';
              }}
            >
              <option value="" disabled>📂 Load Preset</option>
              {presets.map((p, i) => (
                <option key={i} value={i}>{p.name}</option>
              ))}
            </select>
          )}
          <button style={s.btn} onClick={() => setShowPresetInput(!showPresetInput)}>
            💾 Save
          </button>
          <button
            style={s.btn}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '🔼 Less' : '🔽 More'}
          </button>
          <button style={s.btn} onClick={resetFilters}>
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Save preset input */}
      {showPresetInput && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            style={{ ...s.input, flex: 1 }}
            placeholder="Preset name..."
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && savePreset()}
          />
          <button
            style={{ ...s.btn, background: 'var(--cyan-glow)', color: 'var(--cyan)', borderColor: 'var(--cyan)' }}
            onClick={savePreset}
          >
            Save
          </button>
        </div>
      )}

      {/* Saved presets list */}
      {presets.length > 0 && showPresetInput && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {presets.map((p, i) => (
            <span key={i} style={s.chip('var(--text-secondary)')}>
              {p.name}
              <span
                style={{ cursor: 'pointer', marginLeft: '4px', color: 'var(--red)' }}
                onClick={() => deletePreset(i)}
              >×</span>
            </span>
          ))}
        </div>
      )}

      {/* Basic filters */}
      <div style={s.grid}>
        {/* Sort By */}
        <div style={s.group}>
          <label style={s.label}>Sort By</label>
          <select
            value={filters.sort_by}
            onChange={(e) => handleFilterChange('sort_by', e.target.value)}
            style={s.select}
          >
            <option value="num_accounts">Accounts</option>
            <option value="amount">Supply</option>
            <option value="code">Asset Code</option>
            <option value="volume_24h">24h Volume</option>
          </select>
        </div>

        {/* Order */}
        <div style={s.group}>
          <label style={s.label}>Order</label>
          <select
            value={filters.order}
            onChange={(e) => handleFilterChange('order', e.target.value)}
            style={s.select}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        {/* Asset Code Type */}
        <div style={s.group}>
          <label style={s.label}>Code Type</label>
          <select
            value={filters.asset_type || ''}
            onChange={(e) => handleFilterChange('asset_type', e.target.value || null)}
            style={s.select}
          >
            <option value="">All Types</option>
            <option value="credit_alphanum4">4-char (e.g. USDC)</option>
            <option value="credit_alphanum12">12-char (e.g. LONGASSET)</option>
          </select>
        </div>

        {/* Quick Filters */}
        <div style={s.group}>
          <label style={s.label}>Quick Filters</label>
          <label style={s.checkRow}>
            <input
              type="checkbox"
              checked={filters.verified_only}
              onChange={(e) => handleFilterChange('verified_only', e.target.checked)}
              style={{ accentColor: 'var(--cyan)', width: '15px', height: '15px' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Verified only</span>
          </label>
          <label style={s.checkRow}>
            <input
              type="checkbox"
              checked={filters.has_domain}
              onChange={(e) => handleFilterChange('has_domain', e.target.checked)}
              style={{ accentColor: 'var(--cyan)', width: '15px', height: '15px' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Has domain</span>
          </label>
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div style={{ ...s.grid, ...s.divider }}>
          {/* Verification Level */}
          <div style={s.group}>
            <label style={s.label}>Verification Level</label>
            <select
              value={filters.verification_level || ''}
              onChange={(e) => handleFilterChange('verification_level', e.target.value || '')}
              style={s.select}
            >
              <option value="">Any</option>
              <option value="full">✅ Full</option>
              <option value="domain">🌐 Domain</option>
              <option value="manual">🔍 Manual</option>
              <option value="none">⚠️ None</option>
            </select>
          </div>

          {/* Min 24h Volume */}
          <div style={s.group}>
            <label style={s.label}>Min 24h Volume (USD)</label>
            <input
              type="number"
              value={filters.min_volume_24h || ''}
              onChange={(e) => handleFilterChange('min_volume_24h', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="e.g. 10000"
              style={s.input}
              min="0"
            />
          </div>

          {/* Volatility */}
          <div style={s.group}>
            <label style={s.label}>Price Volatility</label>
            <select
              value={filters.volatility || ''}
              onChange={(e) => handleFilterChange('volatility', e.target.value || '')}
              style={s.select}
            >
              <option value="">Any</option>
              <option value="stable">🟢 Stable (&lt;1% 24h)</option>
              <option value="low">🟡 Low (1–5%)</option>
              <option value="medium">🟠 Medium (5–15%)</option>
              <option value="high">🔴 High (&gt;15%)</option>
            </select>
          </div>

          {/* Min Reputation Score */}
          <div style={s.group}>
            <label style={s.label}>Min Reputation Score (0–100)</label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filters.reputation_min || 0}
              onChange={(e) => handleFilterChange('reputation_min', parseInt(e.target.value))}
              style={{ accentColor: 'var(--cyan)', width: '100%' }}
            />
            <div style={{ fontSize: '12px', color: 'var(--cyan)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
              {filters.reputation_min || 0}+
            </div>
          </div>

          {/* Asset Code Pattern */}
          <div style={s.group}>
            <label style={s.label}>Code Pattern (regex)</label>
            <input
              type="text"
              value={filters.code_pattern || ''}
              onChange={(e) => handleFilterChange('code_pattern', e.target.value)}
              placeholder="e.g. ^USD or BTC$"
              style={s.input}
            />
          </div>

          {/* Min Accounts */}
          <div style={s.group}>
            <label style={s.label}>Min Accounts</label>
            <input
              type="number"
              value={filters.min_accounts || ''}
              onChange={(e) => handleFilterChange('min_accounts', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 100"
              style={s.input}
              min="0"
            />
          </div>

          {/* Max Accounts */}
          <div style={s.group}>
            <label style={s.label}>Max Accounts</label>
            <input
              type="number"
              value={filters.max_accounts || ''}
              onChange={(e) => handleFilterChange('max_accounts', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="e.g. 10000"
              style={s.input}
              min="0"
            />
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Active Filters
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                style={{ ...s.chip(chip.color), cursor: 'pointer' }}
                onClick={() => handleFilterChange(chip.key, chip.reset)}
                title="Click to remove"
              >
                {chip.label} <span style={{ opacity: 0.7 }}>×</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
