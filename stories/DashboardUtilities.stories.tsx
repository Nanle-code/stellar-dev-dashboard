import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RefreshCw, Activity, Globe, ExternalLink } from 'lucide-react';

/**
 * Dashboard utility components (PriceTicker, Faucet, RealTimeLedger, ExplorerEmbed)
 * depend on Zustand store, live APIs, and SSE streams.
 *
 * Each story below provides a static visual replica demonstrating the UI states
 * documented in the codebase, plus the real component where safe to mount.
 */

const meta: Meta = {
  title: 'Dashboard/Utilities',
  parameters: {
    docs: {
      description: {
        component:
          'Dashboard utility components: PriceTicker, Faucet, RealTimeLedger, ExplorerEmbed.',
      },
    },
  },
};
export default meta;

// ─── PriceTicker ──────────────────────────────────────────────────────────────

const PriceTickerPreview = ({ usd = 0.1134, change = 3.21, loading = false }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 14px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      fontSize: '12px',
      fontFamily: 'var(--font-mono)',
    }}
  >
    <span style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.5px' }}>XLM</span>
    {loading ? (
      <span style={{ color: 'var(--text-muted)' }}>—</span>
    ) : (
      <>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${usd.toFixed(4)}</span>
        <span
          style={{
            color: change >= 0 ? 'var(--green)' : 'var(--red)',
            fontSize: '11px',
            padding: '2px 6px',
            background: change >= 0 ? 'var(--green-glow)' : 'var(--red-glow)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
      </>
    )}
    <button
      type="button"
      title="Refresh price"
      aria-label="Refresh XLM price"
      style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '2px 5px', display: 'inline-flex', alignItems: 'center' }}
    >
      <RefreshCw size={12} />
    </button>
    <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: 'auto' }}>12:34</span>
  </div>
);

export const PriceTickerDefault: StoryObj = {
  name: 'PriceTicker — Positive',
  render: () => <PriceTickerPreview usd={0.1134} change={3.21} />,
  parameters: { docs: { description: { story: 'XLM price with positive 24h change.' } } },
};

export const PriceTickerNegative: StoryObj = {
  name: 'PriceTicker — Negative',
  render: () => <PriceTickerPreview usd={0.0987} change={-2.54} />,
  parameters: { docs: { description: { story: 'XLM price with negative 24h change.' } } },
};

export const PriceTickerLoading: StoryObj = {
  name: 'PriceTicker — Loading',
  render: () => <PriceTickerPreview usd={0} change={0} loading />,
};

export const PriceTickerMobile: StoryObj = {
  name: 'PriceTicker — Mobile',
  render: () => <PriceTickerPreview usd={0.1134} change={3.21} />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};

// ─── Faucet ───────────────────────────────────────────────────────────────────

const FaucetPreview = ({ loading = false, result = null as null | { success: boolean; address?: string } }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '560px' }}>
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Testnet Faucet</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fund any testnet account with 10,000 XLM via Friendbot</div>
    </div>
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 0 24px var(--amber-glow)' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>⬡</span>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>Friendbot</div>
        <span style={{ marginLeft: 'auto', padding: '3px 8px', background: 'var(--amber-glow)', border: '1px solid var(--amber)', borderRadius: '3px', fontSize: '10px', color: 'var(--amber)' }}>TESTNET ONLY</span>
      </div>
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          value="GABC...XYZ"
          readOnly
          style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
        />
        <button
          style={{ padding: '10px', background: loading ? 'var(--bg-elevated)' : 'var(--amber)', color: loading ? 'var(--text-muted)' : 'var(--bg-base)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          {loading ? <><div className="spinner" style={{ width: '12px', height: '12px' }} /> Funding…</> : '⬡ Fund with 10,000 XLM'}
        </button>
        {result?.success && (
          <div style={{ padding: '12px', background: 'var(--green-glow)', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--green)' }}>
            ✓ Account funded: {result.address}
          </div>
        )}
      </div>
    </div>
  </div>
);

export const FaucetDefault: StoryObj = {
  name: 'Faucet — Default',
  render: () => <FaucetPreview />,
};

export const FaucetLoading: StoryObj = {
  name: 'Faucet — Loading',
  render: () => <FaucetPreview loading />,
};

export const FaucetSuccess: StoryObj = {
  name: 'Faucet — Success',
  render: () => <FaucetPreview result={{ success: true, address: 'GABC...XYZ' }} />,
};

export const FaucetMobile: StoryObj = {
  name: 'Faucet — Mobile',
  render: () => <FaucetPreview />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};

// ─── RealTimeLedger ───────────────────────────────────────────────────────────

const LedgerStatusDot = ({ color }: { color: string }) => (
  <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', marginRight: 6 }} />
);

const RealTimeLedgerPreview = ({ status = 'connected' as 'connected' | 'connecting' | 'error', ledgers = [] as Array<{ sequence: number; tx: number; ops: number }> }) => {
  const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    connected: { color: 'var(--green)', label: 'Live' },
    connecting: { color: 'var(--amber)', label: 'Connecting' },
    error: { color: 'var(--red)', label: 'Error' },
  };
  const { color, label } = STATUS_CONFIG[status];
  const latest = ledgers[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Activity size={18} style={{ color: 'var(--cyan)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px' }}>Real-Time Ledger</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '999px', fontSize: '12px' }}>
          <LedgerStatusDot color={color} />{label}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[{ label: 'Latest Ledger', value: latest?.sequence.toLocaleString() ?? '—' }, { label: 'Transactions', value: latest?.tx ?? '—' }, { label: 'Operations', value: latest?.ops ?? '—' }].map((s) => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Feed</div>
        {ledgers.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>Waiting for ledgers…</div>
        ) : (
          ledgers.map((l) => (
            <div key={l.sequence} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>#{l.sequence.toLocaleString()}</span>
              <span style={{ color: 'var(--text-muted)' }}>{l.tx} txs</span>
              <span style={{ color: 'var(--text-muted)' }}>{l.ops} ops</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const mockLedgers = Array.from({ length: 5 }, (_, i) => ({
  sequence: 50123456 - i,
  tx: Math.floor(Math.random() * 30) + 5,
  ops: Math.floor(Math.random() * 80) + 10,
}));

export const RealTimeLedgerLive: StoryObj = {
  name: 'RealTimeLedger — Live',
  render: () => <RealTimeLedgerPreview status="connected" ledgers={mockLedgers} />,
};

export const RealTimeLedgerConnecting: StoryObj = {
  name: 'RealTimeLedger — Connecting',
  render: () => <RealTimeLedgerPreview status="connecting" />,
};

export const RealTimeLedgerError: StoryObj = {
  name: 'RealTimeLedger — Error',
  render: () => <RealTimeLedgerPreview status="error" />,
};

export const RealTimeLedgerMobile: StoryObj = {
  name: 'RealTimeLedger — Mobile',
  render: () => <RealTimeLedgerPreview status="connected" ledgers={mockLedgers} />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};

// ─── ExplorerEmbed ────────────────────────────────────────────────────────────

const ExplorerEmbedPreview = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Explorer Integration</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generate deep links to external Stellar block explorers</div>
    </div>
    {/* Quick links */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      {['Stellar Expert', 'Steexp'].map((name) => (
        <div key={name} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Globe size={16} style={{ color: 'var(--cyan)' }} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{name}</span>
          <ExternalLink size={12} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
        </div>
      ))}
    </div>
    {/* Deep link types */}
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deep Link Generator</div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {['Account', 'Transaction', 'Contract', 'Asset', 'Ledger'].map((type) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: '6px', fontSize: '12px' }}>
            <span style={{ width: '80px', color: 'var(--text-muted)' }}>{type}</span>
            <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              https://stellar.expert/explorer/testnet/{type.toLowerCase()}/GABC...
            </span>
            <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const ExplorerEmbedDefault: StoryObj = {
  name: 'ExplorerEmbed — Default',
  render: () => <ExplorerEmbedPreview />,
};

export const ExplorerEmbedMobile: StoryObj = {
  name: 'ExplorerEmbed — Mobile',
  render: () => <ExplorerEmbedPreview />,
  parameters: { viewport: { defaultViewport: 'mobile375' } },
};
