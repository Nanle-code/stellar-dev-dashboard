/**
 * PaymentChannels tab — create, manage, and analyze payment channels
 * for recurring Stellar payments.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import {
  analyzeFeeSavings,
  buildClaimTransaction,
  buildCloseChannelTransaction,
  buildCreateChannelTransaction,
  channelAvailableBalance,
  channelUtilizationPercent,
  loadChannels,
  markChannelClosed,
  markChannelPendingClose,
  recordClaim,
  type PaymentChannel,
  type FeeAnalysis,
} from '../../lib/paymentChannels';
import { isValidPublicKey } from '../../lib/stellar';
import CopyableValue from './CopyableValue';

// ─── Small primitives ───────────────────────────────────────────────────────

function Badge({
  label,
  color,
}: {
  label: string;
  color: 'cyan' | 'green' | 'yellow' | 'red';
}) {
  const map = {
    cyan: { bg: 'var(--cyan-glow)', border: 'var(--cyan-dim)', text: 'var(--cyan)' },
    green: { bg: 'rgba(0,200,100,0.1)', border: 'rgba(0,200,100,0.3)', text: 'var(--green)' },
    yellow: {
      bg: 'rgba(250,180,0,0.1)',
      border: 'rgba(250,180,0,0.3)',
      text: 'var(--yellow, #f5a623)',
    },
    red: { bg: 'rgba(240,60,60,0.1)', border: 'rgba(240,60,60,0.3)', text: 'var(--red)' },
  };
  const s = map[color];
  return (
    <span
      style={{
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {label}
    </span>
  );
}

function Row({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '12px',
          color: 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          wordBreak: 'break-all',
          textAlign: 'right',
        }}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% utilization`}
      style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-elevated)', overflow: 'hidden' }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--yellow, #f5a623)' : 'var(--cyan)',
          borderRadius: '3px',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: '14px',
        fontWeight: 700,
        color: 'var(--cyan)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        margin: '0 0 16px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {children}
    </h2>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '9px 20px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--cyan-dim)',
  background: 'var(--cyan-glow)',
  color: 'var(--cyan)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

const btnDanger: React.CSSProperties = {
  ...btnPrimary,
  border: '1px solid rgba(240,60,60,0.4)',
  background: 'rgba(240,60,60,0.1)',
  color: 'var(--red)',
};

// ─── Status badge helper ────────────────────────────────────────────────────

function statusBadge(status: PaymentChannel['status']) {
  if (status === 'open') return <Badge label="Open" color="green" />;
  if (status === 'pending_close') return <Badge label="Pending Close" color="yellow" />;
  return <Badge label="Closed" color="red" />;
}

// ─── Create Channel form ────────────────────────────────────────────────────

interface CreateFormState {
  channelPublicKey: string;
  recipient: string;
  depositAmount: string;
  assetCode: string;
  assetIssuer: string;
  memo: string;
  closeByLedger: string;
}

const CREATE_DEFAULT: CreateFormState = {
  channelPublicKey: '',
  recipient: '',
  depositAmount: '',
  assetCode: 'XLM',
  assetIssuer: '',
  memo: '',
  closeByLedger: '',
};

function CreateChannelForm({
  connectedAddress,
  network,
  onCreated,
}: {
  connectedAddress: string;
  network: string;
  onCreated: (channel: PaymentChannel, xdr: string) => void;
}) {
  const [form, setForm] = useState<CreateFormState>(CREATE_DEFAULT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ xdr: string; channel: PaymentChannel } | null>(null);

  const set = (k: keyof CreateFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await buildCreateChannelTransaction({
        sourceAccount: connectedAddress,
        channelAccountPublicKey: form.channelPublicKey,
        recipient: form.recipient,
        depositAmount: form.depositAmount,
        assetCode: form.assetCode || 'XLM',
        assetIssuer: form.assetIssuer,
        network,
        memo: form.memo,
        closeByLedger: form.closeByLedger ? parseInt(form.closeByLedger, 10) : undefined,
      });
      setResult(res);
      onCreated(res.channel, res.xdr);
      setForm(CREATE_DEFAULT);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Channel Account Public Key *
          </span>
          <input
            style={inputStyle}
            placeholder="G… (escrow keypair)"
            value={form.channelPublicKey}
            onChange={set('channelPublicKey')}
            required
            aria-label="Channel account public key"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Recipient *
          </span>
          <input
            style={inputStyle}
            placeholder="G… (payment recipient)"
            value={form.recipient}
            onChange={set('recipient')}
            required
            aria-label="Recipient public key"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Deposit Amount *
          </span>
          <input
            style={inputStyle}
            type="number"
            min="0.0000001"
            step="any"
            placeholder="e.g. 100"
            value={form.depositAmount}
            onChange={set('depositAmount')}
            required
            aria-label="Deposit amount"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Asset Code *
          </span>
          <input
            style={inputStyle}
            placeholder="XLM"
            value={form.assetCode}
            onChange={set('assetCode')}
            required
            aria-label="Asset code"
          />
        </label>
        {form.assetCode !== 'XLM' && form.assetCode !== '' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: '1 / -1' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Asset Issuer *
            </span>
            <input
              style={inputStyle}
              placeholder="G… (issuer public key)"
              value={form.assetIssuer}
              onChange={set('assetIssuer')}
              required
              aria-label="Asset issuer"
            />
          </label>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Memo
          </span>
          <input
            style={inputStyle}
            placeholder="optional memo (max 28 chars)"
            value={form.memo}
            onChange={set('memo')}
            maxLength={28}
            aria-label="Transaction memo"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Close-by Ledger (optional)
          </span>
          <input
            style={inputStyle}
            type="number"
            min="1"
            step="1"
            placeholder="ledger sequence"
            value={form.closeByLedger}
            onChange={set('closeByLedger')}
            aria-label="Close-by ledger sequence"
          />
        </label>
      </div>

      {error && (
        <div
          role="alert"
          style={{ fontSize: '12px', color: 'var(--red)', padding: '10px 14px', background: 'rgba(240,60,60,0.08)', border: '1px solid rgba(240,60,60,0.3)', borderRadius: 'var(--radius-sm)' }}
        >
          {error}
        </div>
      )}

      {result && (
        <div style={{ fontSize: '12px', color: 'var(--green)', padding: '10px 14px', background: 'rgba(0,200,100,0.08)', border: '1px solid rgba(0,200,100,0.3)', borderRadius: 'var(--radius-sm)' }}>
          ✓ Channel transaction built. Sign and submit the XDR in the Transaction Signer tab.
          <div
            style={{ marginTop: '6px', wordBreak: 'break-all', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {result.xdr.slice(0, 80)}…
          </div>
        </div>
      )}

      <div>
        <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Building…' : '⊕ Build Open Transaction'}
        </button>
      </div>
    </form>
  );
}

// ─── Channel card ───────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  network,
  onUpdate,
}: {
  channel: PaymentChannel;
  network: string;
  onUpdate: (ch: PaymentChannel) => void;
}) {
  const [claimAmount, setClaimAmount] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimXdr, setClaimXdr] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeXdr, setCloseXdr] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const available = channelAvailableBalance(channel);
  const utilPct = channelUtilizationPercent(channel);
  const asset = channel.assetCode;

  async function handleBuildClaim() {
    setClaimError(null);
    setClaimXdr(null);
    setClaimBusy(true);
    try {
      const xdr = await buildClaimTransaction(channel, claimAmount, network);
      setClaimXdr(xdr);
      const updated = recordClaim(channel.id, claimAmount);
      onUpdate(updated);
      setClaimAmount('');
    } catch (err: unknown) {
      setClaimError(err instanceof Error ? err.message : String(err));
    } finally {
      setClaimBusy(false);
    }
  }

  async function handleBuildClose() {
    setCloseError(null);
    setCloseXdr(null);
    setCloseBusy(true);
    try {
      const updated = markChannelPendingClose(channel.id);
      onUpdate(updated);
      const xdr = await buildCloseChannelTransaction(channel, network);
      setCloseXdr(xdr);
    } catch (err: unknown) {
      setCloseError(err instanceof Error ? err.message : String(err));
      // Revert pending_close on error
      if (channel.status === 'open') onUpdate({ ...channel });
    } finally {
      setCloseBusy(false);
    }
  }

  function handleMarkClosed() {
    const updated = markChannelClosed(channel.id);
    onUpdate(updated);
    setCloseXdr(null);
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${channel.status === 'open' ? 'var(--border)' : 'rgba(240,60,60,0.25)'}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}
      >
        <button
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          aria-controls={`channel-body-${channel.id}`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)', padding: 0, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          <CopyableValue value={channel.id} textStyle={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {channel.id.slice(0, 20)}…
          </CopyableValue>
        </button>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Badge label={asset} color="cyan" />
          {statusBadge(channel.status)}
        </div>
      </div>

      {/* Balance bar */}
      <div style={{ padding: '10px 18px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          <span>Claimed: {parseFloat(channel.claimedAmount).toLocaleString()} {asset}</span>
          <span>Available: {parseFloat(available).toLocaleString()} {asset}</span>
        </div>
        <ProgressBar pct={utilPct} />
        <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {utilPct}% utilized · {channel.claimCount} claim{channel.claimCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div id={`channel-body-${channel.id}`} style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Row label="Channel account" value={<CopyableValue value={channel.channelAccount} textStyle={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{channel.channelAccount.slice(0, 8)}…{channel.channelAccount.slice(-6)}</CopyableValue>} />
          <Row label="Recipient" value={<CopyableValue value={channel.recipient} textStyle={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{channel.recipient.slice(0, 8)}…{channel.recipient.slice(-6)}</CopyableValue>} />
          <Row label="Deposited" value={`${parseFloat(channel.depositedAmount).toLocaleString()} ${asset}`} />
          <Row label="Created" value={new Date(channel.createdAt).toLocaleString()} mono={false} />
          {channel.lastClaimAt && (
            <Row label="Last claim" value={new Date(channel.lastClaimAt).toLocaleString()} mono={false} />
          )}
          {channel.memo && <Row label="Memo" value={channel.memo} mono={false} />}
          {channel.closeByLedger && <Row label="Close-by ledger" value={channel.closeByLedger} />}
        </div>
      )}

      {/* Claim builder */}
      {channel.status === 'open' && (
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Build Claim Transaction
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <input
              style={{ ...inputStyle, width: '180px', flex: '0 0 180px' }}
              type="number"
              min="0.0000001"
              step="any"
              max={available}
              placeholder={`max ${parseFloat(available).toFixed(2)} ${asset}`}
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              aria-label="Claim amount"
            />
            <button
              onClick={handleBuildClaim}
              disabled={claimBusy || !claimAmount}
              style={{ ...btnPrimary, opacity: claimBusy || !claimAmount ? 0.6 : 1 }}
            >
              {claimBusy ? 'Building…' : '⬇ Build Claim XDR'}
            </button>
          </div>
          {claimXdr && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--green)' }}>
              ✓ Claim XDR ready — submit via Transaction Signer.
              <div style={{ marginTop: '4px', wordBreak: 'break-all', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {claimXdr.slice(0, 80)}…
              </div>
            </div>
          )}
          {claimError && (
            <div role="alert" style={{ marginTop: '8px', fontSize: '11px', color: 'var(--red)' }}>✗ {claimError}</div>
          )}
        </div>
      )}

      {/* Close builder */}
      {channel.status !== 'closed' && (
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleBuildClose}
            disabled={closeBusy}
            style={{ ...btnDanger, opacity: closeBusy ? 0.6 : 1 }}
          >
            {closeBusy ? 'Building…' : '✕ Build Close Transaction'}
          </button>
          {closeXdr && (
            <>
              <span style={{ fontSize: '11px', color: 'var(--yellow, #f5a623)' }}>
                Close XDR ready — sign &amp; submit, then confirm:
              </span>
              <button onClick={handleMarkClosed} style={{ ...btnPrimary, fontSize: '11px', padding: '6px 12px' }}>
                Mark Closed
              </button>
            </>
          )}
          {closeError && (
            <span role="alert" style={{ fontSize: '11px', color: 'var(--red)' }}>✗ {closeError}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fee Analyzer panel ─────────────────────────────────────────────────────

function FeeAnalyzer() {
  const [count, setCount] = useState(20);
  const [feeStroops, setFeeStroops] = useState(100);
  const [analysis, setAnalysis] = useState<FeeAnalysis>(() => analyzeFeeSavings(20, 100));

  function handleCalculate() {
    setAnalysis(analyzeFeeSavings(count, feeStroops));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Planned Payments
          </span>
          <input
            style={inputStyle}
            type="number"
            min="1"
            step="1"
            value={count}
            onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            aria-label="Number of planned payments"
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Base Fee (stroops)
          </span>
          <input
            style={inputStyle}
            type="number"
            min="100"
            step="1"
            value={feeStroops}
            onChange={(e) => setFeeStroops(Math.max(100, parseInt(e.target.value, 10) || 100))}
            aria-label="Base fee in stroops"
          />
        </label>
        <button onClick={handleCalculate} style={btnPrimary}>Calculate</button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        {[
          { label: 'Standard Cost', value: `${analysis.standardCostStroops.toLocaleString()} stroops`, sub: `${(analysis.standardCostStroops / 1e7).toFixed(5)} XLM`, color: 'var(--red)' },
          { label: 'Channel Cost', value: `${analysis.channelCostStroops.toLocaleString()} stroops`, sub: `${(analysis.channelCostStroops / 1e7).toFixed(5)} XLM`, color: 'var(--cyan)' },
          { label: 'Fee Savings', value: `${analysis.savingsStroops.toLocaleString()} stroops`, sub: `${analysis.savingsPercent}% cheaper`, color: 'var(--green)' },
          { label: 'Break-even', value: `${analysis.breakEvenCount} payments`, sub: 'channel cheaper after this', color: 'var(--yellow, #f5a623)' },
        ].map(({ label, value, sub, color }) => (
          <div
            key={label}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
              {label}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
              {value}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--cyan-dim)' }}>
        <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong> Standard direct payments each require one on-chain transaction.
        Payment channels batch claims off-chain — only the open and close transactions hit the ledger,
        plus a periodic settlement every ~10 claims. Savings grow with payment frequency.
      </div>
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────

type ActiveView = 'channels' | 'create' | 'fees';

export default function PaymentChannels() {
  const { connectedAddress, network } = useStore();
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>('channels');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentChannel['status']>('all');

  const refresh = useCallback(() => {
    setChannels(loadChannels().filter((c) => c.sourceAccount === connectedAddress || connectedAddress === ''));
  }, [connectedAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleCreated(channel: PaymentChannel) {
    setChannels((prev) => {
      const exists = prev.find((c) => c.id === channel.id);
      return exists ? prev.map((c) => (c.id === channel.id ? channel : c)) : [channel, ...prev];
    });
    setActiveView('channels');
  }

  function handleUpdate(updated: PaymentChannel) {
    setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  const filtered = channels.filter((c) => statusFilter === 'all' || c.status === statusFilter);
  const openCount = channels.filter((c) => c.status === 'open').length;

  const tabStyle = (view: ActiveView): React.CSSProperties => ({
    padding: '8px 18px',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: activeView === view ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
    color: activeView === view ? 'var(--cyan)' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page header */}
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>
          Payment Channels
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Optimize recurring transaction costs with Stellar payment channels
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Channels', value: channels.length },
          { label: 'Open', value: openCount },
          { label: 'Pending Close', value: channels.filter((c) => c.status === 'pending_close').length },
          { label: 'Closed', value: channels.filter((c) => c.status === 'closed').length },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--cyan)', marginTop: '4px' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button style={tabStyle('channels')} onClick={() => setActiveView('channels')} aria-pressed={activeView === 'channels'}>
          ◈ My Channels
        </button>
        <button style={tabStyle('create')} onClick={() => setActiveView('create')} aria-pressed={activeView === 'create'}>
          ⊕ Create Channel
        </button>
        <button style={tabStyle('fees')} onClick={() => setActiveView('fees')} aria-pressed={activeView === 'fees'}>
          ◍ Fee Analysis
        </button>
      </div>

      {/* Create channel */}
      {activeView === 'create' && (
        <section aria-labelledby="create-heading">
          <SectionTitle><span id="create-heading">Create Payment Channel</span></SectionTitle>
          {!connectedAddress ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Connect an account to create payment channels.
            </div>
          ) : (
            <CreateChannelForm
              connectedAddress={connectedAddress}
              network={network}
              onCreated={handleCreated}
            />
          )}
        </section>
      )}

      {/* Channel list */}
      {activeView === 'channels' && (
        <section aria-labelledby="channels-heading">
          <SectionTitle>
            <span id="channels-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>My Channels</span>
              <span style={{ display: 'flex', gap: '6px' }}>
                {(['all', 'open', 'pending_close', 'closed'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: statusFilter === s ? 'var(--cyan-glow)' : 'transparent',
                      color: statusFilter === s ? 'var(--cyan)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                    aria-pressed={statusFilter === s}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </span>
            </span>
          </SectionTitle>

          {filtered.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '32px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              {channels.length === 0
                ? 'No channels yet. Create one to get started.'
                : 'No channels match the selected filter.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filtered.map((ch) => (
                <ChannelCard key={ch.id} channel={ch} network={network} onUpdate={handleUpdate} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Fee analysis */}
      {activeView === 'fees' && (
        <section aria-labelledby="fees-heading">
          <SectionTitle><span id="fees-heading">Fee Analysis &amp; Optimization</span></SectionTitle>
          <FeeAnalyzer />
        </section>
      )}
    </div>
  );
}
