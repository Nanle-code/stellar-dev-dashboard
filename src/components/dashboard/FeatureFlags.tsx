/**
 * FeatureFlags.tsx
 *
 * Dashboard panel for managing feature flags and A/B experiments.
 * Flags are stored in localStorage so changes survive page reloads.
 */

import React, { useState, useCallback, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type FlagEnv = 'all' | 'testnet' | 'mainnet';
type FlagCategory = 'core' | 'experimental' | 'ai' | 'ui' | 'security' | 'defi';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  category: FlagCategory;
  env: FlagEnv;
  enabled: boolean;
  rollout: number; // 0–100 %
  experiment: boolean;
  variant?: string;
  tags: string[];
}

// ─── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = 'stellar_feature_flags_v1';

function loadOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage not available
  }
}

// ─── Default flag definitions ──────────────────────────────────────────────────

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    id: 'multi_agent_system',
    name: 'Multi-Agent System',
    description: 'Intelligent agents that collaborate on cross-chain payments, multi-sig workflows, and automated trading strategies.',
    category: 'ai',
    env: 'all',
    enabled: true,
    rollout: 100,
    experiment: false,
    tags: ['ai', 'agents', 'automation'],
  },
  {
    id: 'ai_tx_patterns',
    name: 'AI Transaction Patterns',
    description: 'Machine-learning based anomaly detection and pattern analysis for account transactions.',
    category: 'ai',
    env: 'all',
    enabled: true,
    rollout: 100,
    experiment: false,
    tags: ['ai', 'analytics'],
  },
  {
    id: 'new_tx_builder',
    name: 'New Transaction Builder',
    description: 'Redesigned transaction builder with drag-and-drop operations and inline simulation.',
    category: 'ui',
    env: 'all',
    enabled: true,
    rollout: 80,
    experiment: true,
    variant: 'B',
    tags: ['builder', 'ux'],
  },
  {
    id: 'governance_beta',
    name: 'Governance (Beta)',
    description: 'On-chain governance panel for Stellar-based DAOs and voting contracts.',
    category: 'experimental',
    env: 'testnet',
    enabled: false,
    rollout: 20,
    experiment: true,
    variant: 'A',
    tags: ['governance', 'dao'],
  },
  {
    id: 'soroban_studio',
    name: 'Soroban Contract Studio',
    description: 'Integrated IDE for writing, testing, and deploying Soroban smart contracts.',
    category: 'core',
    env: 'all',
    enabled: true,
    rollout: 100,
    experiment: false,
    tags: ['contracts', 'soroban'],
  },
  {
    id: 'defi_analytics',
    name: 'DeFi Analytics',
    description: 'AMM pool analytics, yield farming opportunities, and impermanent loss calculator.',
    category: 'defi',
    env: 'all',
    enabled: true,
    rollout: 100,
    experiment: false,
    tags: ['defi', 'analytics'],
  },
  {
    id: 'portfolio_rebalancer',
    name: 'Portfolio Rebalancer',
    description: 'Automated portfolio rebalancing with configurable target allocations and threshold alerts.',
    category: 'defi',
    env: 'all',
    enabled: true,
    rollout: 100,
    experiment: false,
    tags: ['portfolio', 'trading'],
  },
  {
    id: 'biometric_auth',
    name: 'Biometric Auth',
    description: 'WebAuthn / passkey support for secure, passwordless transaction signing.',
    category: 'security',
    env: 'all',
    enabled: false,
    rollout: 0,
    experiment: true,
    variant: 'A',
    tags: ['auth', 'security'],
  },
  {
    id: 'session_recording',
    name: 'Session Recording',
    description: 'Opt-in session replay for debugging and UX improvement (with user consent).',
    category: 'experimental',
    env: 'all',
    enabled: false,
    rollout: 5,
    experiment: true,
    variant: 'A',
    tags: ['analytics', 'debug'],
  },
  {
    id: 'payment_channels',
    name: 'Payment Channels',
    description: 'Off-chain micro-payment channels for high-frequency, low-fee Stellar transactions.',
    category: 'experimental',
    env: 'testnet',
    enabled: false,
    rollout: 10,
    experiment: true,
    variant: 'A',
    tags: ['payments', 'channels'],
  },
  {
    id: 'cross_network_search',
    name: 'Cross-Network Search',
    description: 'Search accounts, transactions, and contracts across Mainnet, Testnet, and Futurenet simultaneously.',
    category: 'core',
    env: 'all',
    enabled: true,
    rollout: 100,
    experiment: false,
    tags: ['search', 'network'],
  },
  {
    id: 'compliance_dashboard',
    name: 'Compliance Dashboard',
    description: 'AML/KYC screening, travel rule enforcement, and audit report generation.',
    category: 'security',
    env: 'mainnet',
    enabled: true,
    rollout: 100,
    experiment: false,
    tags: ['compliance', 'aml'],
  },
];

const CATEGORY_COLORS: Record<FlagCategory, string> = {
  core: 'var(--cyan, #06b6d4)',
  experimental: '#f59e0b',
  ai: '#8b5cf6',
  ui: '#3b82f6',
  security: '#10b981',
  defi: '#f97316',
};

const CATEGORY_LABELS: Record<FlagCategory, string> = {
  core: 'Core',
  experimental: 'Experimental',
  ai: 'AI / ML',
  ui: 'UI / UX',
  security: 'Security',
  defi: 'DeFi',
};

// ─── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        cursor: 'pointer',
        background: enabled ? 'var(--accent, #06b6d4)' : 'var(--border, #3f4759)',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function RolloutBar({ value }: { value: number }) {
  const color = value === 100 ? '#10b981' : value >= 50 ? 'var(--accent, #06b6d4)' : '#f59e0b';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: 'var(--bg-canvas, var(--bg))',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: color,
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', minWidth: 28 }}>
        {value}%
      </span>
    </div>
  );
}

interface FlagRowProps {
  flag: FeatureFlag;
  overrideEnabled?: boolean;
  onToggle: (id: string, value: boolean) => void;
  onRolloutChange: (id: string, value: number) => void;
}

function FlagRow({ flag, overrideEnabled, onToggle, onRolloutChange }: FlagRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isEnabled = overrideEnabled ?? flag.enabled;
  const catColor = CATEGORY_COLORS[flag.category];
  const hasOverride = overrideEnabled !== undefined;

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        opacity: isEnabled ? 1 : 0.65,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--bg-card, var(--bg-elevated))',
        }}
      >
        <Toggle enabled={isEnabled} onChange={(v) => onToggle(flag.id, v)} />

        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
            color: 'var(--text)',
          }}
          aria-expanded={expanded}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{flag.name}</span>
              {hasOverride && (
                <Badge label="overridden" color="#f59e0b" />
              )}
              {flag.experiment && (
                <Badge label={flag.variant ? `variant ${flag.variant}` : 'experiment'} color="#8b5cf6" />
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
              {flag.id}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <Badge label={CATEGORY_LABELS[flag.category]} color={catColor} />
            {flag.env !== 'all' && (
              <Badge label={flag.env} color={flag.env === 'mainnet' ? '#ef4444' : '#3b82f6'} />
            )}
            <RolloutBar value={flag.rollout} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
              {expanded ? '▲' : '▼'}
            </span>
          </div>
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '14px 16px',
            background: 'var(--bg-elevated)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {flag.description}
          </p>

          {/* Rollout slider */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Rollout percentage: <strong style={{ color: 'var(--text)' }}>{flag.rollout}%</strong>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={flag.rollout}
              onChange={(e) => onRolloutChange(flag.id, parseInt(e.target.value))}
              style={{ width: '100%', accentColor: catColor }}
              aria-label={`Rollout for ${flag.name}`}
            />
          </div>

          {/* Tags */}
          {flag.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {flag.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    color: 'var(--text-muted)',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Summary stats ─────────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '14px 18px',
        textAlign: 'center',
        flex: 1,
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: color ?? 'var(--accent, #06b6d4)',
          fontFamily: 'monospace',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{label}</div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function FeatureFlags() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => loadOverrides());
  const [rollouts, setRollouts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<FlagCategory | 'all'>('all');
  const [filterState, setFilterState] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Merge defaults with overrides and rollout changes
  const flags = useMemo<FeatureFlag[]>(
    () =>
      DEFAULT_FLAGS.map((f) => ({
        ...f,
        enabled: overrides[f.id] ?? f.enabled,
        rollout: rollouts[f.id] ?? f.rollout,
      })),
    [overrides, rollouts]
  );

  const filtered = useMemo(
    () =>
      flags.filter((f) => {
        if (search && !f.name.toLowerCase().includes(search.toLowerCase()) &&
            !f.id.includes(search.toLowerCase()) &&
            !f.tags.some((t) => t.includes(search.toLowerCase()))) {
          return false;
        }
        if (filterCat !== 'all' && f.category !== filterCat) return false;
        if (filterState === 'enabled' && !f.enabled) return false;
        if (filterState === 'disabled' && f.enabled) return false;
        return true;
      }),
    [flags, search, filterCat, filterState]
  );

  const handleToggle = useCallback((id: string, value: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: value };
      saveOverrides(next);
      return next;
    });
  }, []);

  const handleRollout = useCallback((id: string, value: number) => {
    setRollouts((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleResetAll = useCallback(() => {
    setOverrides({});
    setRollouts({});
    saveOverrides({});
  }, []);

  const enabledCount = flags.filter((f) => f.enabled).length;
  const experimentCount = flags.filter((f) => f.experiment).length;
  const overrideCount = Object.keys(overrides).length;

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: 13,
    cursor: 'pointer',
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          🚩 Feature Flags
        </h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          Enable, disable, and configure feature rollouts. Changes are stored locally and take effect immediately.
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard value={flags.length} label="Total Flags" />
        <StatCard value={enabledCount} label="Enabled" color="#10b981" />
        <StatCard value={flags.length - enabledCount} label="Disabled" color="var(--text-muted)" />
        <StatCard value={experimentCount} label="Experiments" color="#8b5cf6" />
        <StatCard value={overrideCount} label="Local Overrides" color="#f59e0b" />
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          placeholder="Search flags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 160,
            padding: '7px 12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text)',
            fontSize: 13,
          }}
          aria-label="Search feature flags"
        />

        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value as FlagCategory | 'all')}
          style={selectStyle}
          aria-label="Filter by category"
        >
          <option value="all">All Categories</option>
          {(Object.keys(CATEGORY_LABELS) as FlagCategory[]).map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>

        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value as 'all' | 'enabled' | 'disabled')}
          style={selectStyle}
          aria-label="Filter by state"
        >
          <option value="all">All States</option>
          <option value="enabled">Enabled Only</option>
          <option value="disabled">Disabled Only</option>
        </select>

        {overrideCount > 0 && (
          <button
            onClick={handleResetAll}
            style={{
              padding: '7px 14px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
            title="Reset all local overrides to defaults"
          >
            Reset overrides ({overrideCount})
          </button>
        )}
      </div>

      {/* Flag list */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 14,
            border: '1px dashed var(--border)',
            borderRadius: 10,
          }}
        >
          No flags match your filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((flag) => (
            <FlagRow
              key={flag.id}
              flag={flag}
              overrideEnabled={overrides[flag.id]}
              onToggle={handleToggle}
              onRolloutChange={handleRollout}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p
        style={{
          marginTop: 20,
          fontSize: 12,
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        Flag overrides are stored in <code>localStorage</code> and apply to this browser session only.
        Server-side rollout percentages are illustrative.
      </p>
    </div>
  );
}
