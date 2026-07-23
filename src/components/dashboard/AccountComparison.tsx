import React, { useState, useEffect, useMemo, type ChangeEvent, type ReactNode, type ReactElement } from 'react';
import { useStore } from '../../lib/store';
import { shortAddress } from '../../lib/stellar';
import CopyableValue from './CopyableValue';
import { fetchAccountDetails, type AccountDetails } from '../../lib/stellar';
import { isPublicKey } from '../../lib/stellar';
import Card from './Card';
import type { ComparisonSlot } from '../../lib/store';

interface ComparisonRowProps {
  label: string
  values: ReactNode[]
  highlight?: number | null
}

interface DiffBadgeProps {
  text: string
  variant: 'positive' | 'negative' | 'neutral'
}

interface MetricCardProps {
  title: string
  accounts: (AccountDetails | null)[]
  format: (val: AccountDetails | null) => ReactNode
  highlight?: (val: AccountDetails | null) => boolean
}

interface AnalysisRow {
  label: string
  values: ReactNode[]
  highlight?: number | null
}

interface ComparisonData {
  rows: AnalysisRow[]
}

const DiffBadge = ({ text, variant }: DiffBadgeProps) => {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    positive: { bg: 'var(--green-glow-sm)', border: 'var(--green)', color: 'var(--green)' },
    negative: { bg: 'var(--red-glow-sm)', border: 'var(--red)', color: 'var(--red)' },
    neutral: { bg: 'var(--bg-elevated)', border: 'var(--border)', color: 'var(--text-muted)' },
  };

  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      fontSize: '10px',
      fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      background: colors[variant]?.bg || colors.neutral.bg,
      border: `1px solid ${colors[variant]?.border || colors.neutral.border}`,
      color: colors[variant]?.color || colors.neutral.color,
      whiteSpace: 'nowrap'
    }}>
      {text}
    </span>
  );
};

const ComparisonRow = ({ label, values, highlight }: ComparisonRowProps) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '140px repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    alignItems: 'center',
    background: highlight !== undefined ? 'var(--cyan-glow-sm)' : 'transparent',
    transition: 'var(--transition)',
    fontSize: '13px',
  }}>
    <div style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '12px' }}>{label}</div>
    {values.map((val: ReactNode, i: number) => (
      <div key={i} style={{
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)',
        fontWeight: highlight === i ? 700 : 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {val ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </div>
    ))}
  </div>
);

const MetricCard = ({ title, accounts, format, highlight }: MetricCardProps) => {
  const values = accounts.map((a, i) => ({
    value: format(a),
    isHighlight: highlight ? highlight(a) : false
  }));

  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      transition: 'var(--transition)',
    }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {values.map((v, i) => (
          <div key={i} style={{
            flex: 1,
            minWidth: '100px',
            padding: '10px 14px',
            background: 'var(--bg-canvas)',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${v.isHighlight ? 'var(--cyan)' : 'var(--border)'}`,
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontFamily: 'var(--font-mono)',
            fontWeight: v.isHighlight ? 700 : 400,
          }}>
            {v.value}
          </div>
        ))}
      </div>
    </div>
  );
};

function buildComparison(accounts: (AccountDetails | null)[]): ComparisonData {
  if (!accounts.length || accounts.every(a => a === null)) {
    return { rows: [] };
  }

  const rows: AnalysisRow[] = [];

  const balances = accounts.map(a => a?.balances?.reduce((sum: number, b: { balance?: string }) =>
    sum + parseFloat(b.balance || '0'), 0) ?? null);
  rows.push({
    label: 'Total Balance (XLM)',
    values: balances.map(b => b !== null ? b.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'),
    highlight: balances.indexOf(Math.max(...balances.filter((b): b is number => b !== null)))
  });

  const homeDomains = accounts.map(a => a?.home_domain || null);
  rows.push({
    label: 'Home Domain',
    values: homeDomains.map(d => d || '—'),
  });

  const hasThresholds = accounts.map(a => (a?.thresholds?.low_weight && a?.thresholds?.med_weight && a?.thresholds?.high_weight) ? true : false);
  rows.push({
    label: 'Thresholds Set',
    values: hasThresholds.map(t => t ? '✓' : '✗'),
  });

  const signerCounts = accounts.map(a => (a?.signers?.length ?? 0));
  rows.push({
    label: 'Signers',
    values: signerCounts.map(c => c.toString()),
    highlight: signerCounts.indexOf(Math.max(...signerCounts))
  });

  const seqNums = accounts.map(a => a?.sequence ? BigInt(a.sequence) : null);
  rows.push({
    label: 'Sequence',
    values: seqNums.map(s => s !== null ? `${(Number(s) & 0xFFFFFFFFFFFFFFFF).toString(16).padStart(16, '0').substring(0, 8)}…` : '—'),
  });

  return { rows };
}

export default function AccountComparison() {
  const { comparisonSlots, addComparisonSlot, removeComparisonSlot, updateComparisonSlot, network } = useStore();
  const [accounts, setAccounts] = useState<(AccountDetails | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const currentSlots = comparisonSlots || [];

  useEffect(() => {
    if (currentSlots.length === 0) {
      setAccounts([]);
      return;
    }

    let cancelled = false;

    async function loadAccounts() {
      setIsLoading(true);
      const results: (AccountDetails | null)[] = [];

      for (const slot of currentSlots) {
        if (cancelled) break;
        try {
          const details = await fetchAccountDetails(slot.address);
          results.push(details);
        } catch {
          results.push(null);
        }
      }

      if (!cancelled) {
        setAccounts(results);
        setIsLoading(false);
      }
    }

    loadAccounts();

    return () => { cancelled = true; };
  }, [currentSlots.map((s: ComparisonSlot) => s.address).join(',')]);

  const comparison = useMemo(() => buildComparison(accounts), [accounts]);

  const handleAddAccount = () => {
    const address = inputValue.trim();
    if (!address || !isPublicKey(address)) return;
    addComparisonSlot({ id: `slot-${Date.now()}`, address, label: shortAddress(address, 6) });
    setInputValue('');
  };

  const handleAccountChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const slot = currentSlots[index];
    if (slot) {
      updateComparisonSlot(slot.id, { ...slot, address: e.target.value });
    }
  };

  const handleRemoveAccount = (index: number) => {
    const slot = currentSlots[index];
    if (slot) removeComparisonSlot(slot.id);
  };

  const allLoaded = accounts.length > 0 && accounts.every(a => a !== null);

  const netWorthCard = (
    <MetricCard
      title="Net Worth"
      accounts={accounts}
      format={(a) => {
        if (!a) return '—';
        const total = a.balances?.reduce((s, b) => s + parseFloat(b.balance || '0'), 0) || 0;
        return `${total.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`;
      }}
      highlight={(a) => {
        if (!a) return false;
        const total = a.balances?.reduce((s, b) => s + parseFloat(b.balance || '0'), 0) || 0;
        const max = Math.max(...accounts.filter(Boolean).map(acc =>
          acc!.balances?.reduce((s, b) => s + parseFloat(b.balance || '0'), 0) || 0
        ));
        return total === max && max > 0;
      }}
    />
  );

  const signerCard = (
    <MetricCard
      title="Signers"
      accounts={accounts}
      format={(a) => a?.signers?.length?.toString() ?? '—'}
      highlight={(a) => {
        if (!a?.signers) return false;
        const max = Math.max(...accounts.filter(Boolean).map(acc => acc!.signers?.length || 0));
        return a.signers.length === max && max > 0;
      }}
    />
  );

  const subEntryCard = (
    <MetricCard
      title="Subentries"
      accounts={accounts}
      format={(a) => a?.num_subentries?.toString() ?? '—'}
      highlight={(a) => {
        if (!a?.num_subentries) return false;
        const max = Math.max(...accounts.filter(Boolean).map(acc => acc!.num_subentries || 0));
        return a.num_subentries === max && max > 0;
      }}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          Account Comparison
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
          Compare key metrics across multiple Stellar accounts side by side.
        </p>
      </div>

      <div className="card" style={{ padding: '20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Stellar Address
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
              placeholder="GABCDEF1234..."
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleAddAccount(); }}
              style={{
                padding: '10px 12px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                transition: 'var(--transition)',
              }}
            />
          </div>
          <button
            onClick={handleAddAccount}
            disabled={!inputValue.trim() || !isPublicKey(inputValue.trim())}
            style={{
              padding: '10px 18px',
              background: inputValue.trim() && isPublicKey(inputValue.trim()) ? 'var(--cyan)' : 'var(--bg-elevated)',
              color: inputValue.trim() && isPublicKey(inputValue.trim()) ? 'white' : 'var(--text-muted)',
              border: `1px solid ${inputValue.trim() && isPublicKey(inputValue.trim()) ? 'var(--cyan)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: inputValue.trim() && isPublicKey(inputValue.trim()) ? 'pointer' : 'not-allowed',
              transition: 'var(--transition)',
              whiteSpace: 'nowrap',
            }}
          >
            + Add Account
          </button>
        </div>

        {currentSlots.length > 0 && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currentSlots.map((slot: ComparisonSlot, index: number) => (
              <div key={slot.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'var(--cyan)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={slot.address}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleAccountChange(index, e)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    minWidth: 0,
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {accounts[index] ? shortAddress(accounts[index]?.id || '', 6) : '—'}
                </span>
                <button
                  onClick={() => handleRemoveAccount(index)}
                  style={{
                    padding: '4px 10px',
                    background: 'transparent',
                    color: 'var(--red)',
                    border: '1px solid var(--red)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    opacity: 0.7,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Loading account data...
        </div>
      )}

      {!isLoading && currentSlots.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.4 }}>⚖️</div>
          <div style={{ fontSize: '14px' }}>Add two or more accounts to compare</div>
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            Compare balances, thresholds, signers, and more.
          </div>
        </div>
      )}

      {!isLoading && currentSlots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
            {netWorthCard}
            {signerCard}
            {subEntryCard}
          </div>

          <div className="card" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ padding: '14px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Detailed Comparison
            </div>
            <div style={{ overflowX: 'auto' }}>
              {comparison.rows.length > 0 ? (
                comparison.rows.map((row: AnalysisRow, i: number) => (
                  <ComparisonRow key={i} label={row.label} values={row.values} highlight={row.highlight} />
                ))
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No comparison data available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
