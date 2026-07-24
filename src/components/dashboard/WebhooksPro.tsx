import React, { useState, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliveryStatus = 'delivered' | 'failed' | 'retrying' | 'pending';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret: string;
  created: string;
  successRate: number;
  totalDeliveries: number;
}

interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventType: string;
  status: DeliveryStatus;
  responseCode: number | null;
  latencyMs: number | null;
  attempts: number;
  timestamp: string;
  nextRetry?: string;
  error?: string;
}

interface DeliveryMetric {
  label: string;
  value: string | number;
  color?: string;
  icon: string;
}

// ─── Shared Primitives ────────────────────────────────────────────────────────

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', ...style }}>
    {children}
  </div>
);

const Badge = ({ label, color }: { label: string; color?: string }) => (
  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px', background: `${color ?? 'var(--cyan,#06b6d4)'}22`, color: color ?? 'var(--cyan,#06b6d4)', border: `1px solid ${color ?? 'var(--cyan,#06b6d4)'}55` }}>{label}</span>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{title}</div>
    {subtitle && <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>}
  </div>
);

const Stat = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
  <Card style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '26px', fontWeight: 800, color: color ?? 'var(--cyan,#06b6d4)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{label}</div>
  </Card>
);

const MiniBar = ({ value, max, color }: { value: number; max: number; color?: string }) => (
  <div style={{ height: '6px', background: 'var(--bg-canvas)', borderRadius: '4px', overflow: 'hidden' }}>
    <div style={{ width: `${Math.min((value / max) * 100, 100)}%`, height: '100%', background: color ?? 'var(--cyan,#06b6d4)', borderRadius: '4px', transition: 'width 0.8s ease' }} />
  </div>
);

const StatusIcon = ({ status }: { status: DeliveryStatus }) => {
  const map: Record<DeliveryStatus, { icon: string; color: string }> = {
    delivered: { icon: '✅', color: '#22c55e' },
    failed:    { icon: '❌', color: '#ef4444' },
    retrying:  { icon: '🔄', color: '#eab308' },
    pending:   { icon: '⏳', color: 'var(--text-muted)' },
  };
  const { icon } = map[status];
  return <span style={{ fontSize: '13px' }}>{icon}</span>;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'transaction.created', 'transaction.confirmed', 'transaction.failed',
  'payment.sent', 'payment.received', 'payment.claimable_balance_created',
  'account.created', 'account.credited', 'account.debited', 'account.flags_updated',
  'trustline.created', 'trustline.updated', 'trustline.removed',
  'offer.created', 'offer.updated', 'offer.removed',
  'contract.deployed', 'contract.invoked', 'contract.state_changed',
  'data.entry.created', 'data.entry.updated', 'ledger.closed',
];

const MOCK_ENDPOINTS: WebhookEndpoint[] = [
  { id: 'ep1', name: 'Production API', url: 'https://api.myapp.com/webhooks/stellar', events: ['transaction.created', 'payment.sent', 'payment.received'], enabled: true, secret: 'whsec_prod_•••••••', created: '2026-05-10', successRate: 98.4, totalDeliveries: 4821 },
  { id: 'ep2', name: 'Analytics Pipeline', url: 'https://ingest.analytics.io/stellar', events: ['ledger.closed', 'contract.invoked', 'account.credited'], enabled: true, secret: 'whsec_anl_•••••••', created: '2026-05-22', successRate: 99.7, totalDeliveries: 12340 },
  { id: 'ep3', name: 'Dev / Staging', url: 'https://staging.myapp.dev/hooks', events: ['all'], enabled: false, secret: 'whsec_dev_•••••••', created: '2026-06-01', successRate: 87.2, totalDeliveries: 430 },
];

const MOCK_DELIVERIES: WebhookDelivery[] = [
  { id: 'd1', endpointId: 'ep1', eventType: 'payment.received', status: 'delivered', responseCode: 200, latencyMs: 142, attempts: 1, timestamp: '2026-07-15T13:42:00Z' },
  { id: 'd2', endpointId: 'ep1', eventType: 'transaction.created', status: 'delivered', responseCode: 200, latencyMs: 98, attempts: 1, timestamp: '2026-07-15T13:40:00Z' },
  { id: 'd3', endpointId: 'ep2', eventType: 'ledger.closed', status: 'failed', responseCode: 503, latencyMs: 5000, attempts: 3, timestamp: '2026-07-15T13:38:00Z', error: 'Service unavailable — retries exhausted' },
  { id: 'd4', endpointId: 'ep3', eventType: 'contract.deployed', status: 'retrying', responseCode: 502, latencyMs: null, attempts: 2, timestamp: '2026-07-15T13:35:00Z', nextRetry: '2026-07-15T13:50:00Z' },
  { id: 'd5', endpointId: 'ep1', eventType: 'payment.sent', status: 'delivered', responseCode: 200, latencyMs: 77, attempts: 1, timestamp: '2026-07-15T13:30:00Z' },
  { id: 'd6', endpointId: 'ep2', eventType: 'account.credited', status: 'delivered', responseCode: 201, latencyMs: 114, attempts: 1, timestamp: '2026-07-15T13:22:00Z' },
  { id: 'd7', endpointId: 'ep1', eventType: 'transaction.failed', status: 'pending', responseCode: null, latencyMs: null, attempts: 0, timestamp: '2026-07-15T13:20:00Z' },
];

const METRIC_HISTORY = [
  { hour: '08:00', delivered: 840, failed: 12 },
  { hour: '09:00', delivered: 1200, failed: 8 },
  { hour: '10:00', delivered: 1560, failed: 21 },
  { hour: '11:00', delivered: 980, failed: 14 },
  { hour: '12:00', delivered: 1100, failed: 9 },
  { hour: '13:00', delivered: 1380, failed: 7 },
];

// ─── Step 1 – Webhook Creation ────────────────────────────────────────────────

function WebhookCreation() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>(MOCK_ENDPOINTS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[] });
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, 'ok' | 'fail'>>({});

  const toggleEvent = (ev: string) => {
    setForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));
  };

  const handleCreate = () => {
    if (!form.name || !form.url || form.events.length === 0) return;
    const newEp: WebhookEndpoint = {
      id: `ep${Date.now()}`, name: form.name, url: form.url, events: form.events,
      enabled: true, secret: `whsec_new_${Math.random().toString(36).slice(2, 9)}`,
      created: new Date().toISOString().slice(0, 10), successRate: 100, totalDeliveries: 0,
    };
    setEndpoints(prev => [newEp, ...prev]);
    setForm({ name: '', url: '', events: [] });
    setShowForm(false);
  };

  const runTest = (id: string) => {
    setTesting(id);
    setTimeout(() => {
      setTestResult(prev => ({ ...prev, [id]: Math.random() > 0.2 ? 'ok' : 'fail' }));
      setTesting(null);
    }, 1800);
  };

  const toggleEnabled = (id: string) => {
    setEndpoints(prev => prev.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Webhook Management" subtitle="Create, configure, and test webhook endpoints for real-time Stellar event delivery." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Endpoints" value={endpoints.length} color="var(--cyan,#06b6d4)" />
        <Stat label="Active" value={endpoints.filter(e => e.enabled).length} color="#22c55e" />
        <Stat label="Event Types" value={EVENT_TYPES.length} color="#a78bfa" />
        <Stat label="Total Deliveries" value={endpoints.reduce((a, e) => a + e.totalDeliveries, 0).toLocaleString()} color="#f97316" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '9px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, background: showForm ? 'var(--bg-elevated)' : 'var(--cyan,#06b6d4)', color: showForm ? 'var(--text-muted)' : '#000', border: `1px solid ${showForm ? 'var(--border)' : 'transparent'}`, cursor: 'pointer' }}>
          {showForm ? '✕ Cancel' : '+ New Endpoint'}
        </button>
      </div>

      {showForm && (
        <Card style={{ borderColor: 'rgba(6,182,212,.4)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Create Endpoint</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Endpoint" style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>URL</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com/webhook" style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Events (select at least one)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {EVENT_TYPES.slice(0, 12).map(ev => (
                  <button key={ev} onClick={() => toggleEvent(ev)} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontFamily: 'var(--font-mono)', cursor: 'pointer', background: form.events.includes(ev) ? 'rgba(6,182,212,.2)' : 'var(--bg-canvas)', border: `1px solid ${form.events.includes(ev) ? 'var(--cyan,#06b6d4)' : 'var(--border)'}`, color: form.events.includes(ev) ? 'var(--cyan,#06b6d4)' : 'var(--text-muted)' }}>{ev}</button>
                ))}
              </div>
            </div>
            <button onClick={handleCreate} disabled={!form.name || !form.url || form.events.length === 0} style={{ padding: '9px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, background: 'var(--cyan,#06b6d4)', color: '#000', border: 'none', cursor: 'pointer', opacity: (!form.name || !form.url || form.events.length === 0) ? 0.5 : 1 }}>
              Create Endpoint
            </button>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {endpoints.map(ep => (
          <Card key={ep.id} style={{ borderColor: ep.enabled ? 'var(--border)' : 'rgba(239,68,68,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ep.enabled ? '#22c55e' : '#ef4444', boxShadow: ep.enabled ? '0 0 6px #22c55e' : 'none' }} />
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{ep.name}</span>
                  <Badge label={ep.enabled ? 'Active' : 'Disabled'} color={ep.enabled ? '#22c55e' : '#ef4444'} />
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--cyan,#06b6d4)', marginBottom: '6px' }}>{ep.url}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {ep.events.slice(0, 4).map(e => <Badge key={e} label={e} />)}
                  {ep.events.length > 4 && <Badge label={`+${ep.events.length - 4} more`} color="var(--text-muted)" />}
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Success: <strong style={{ color: ep.successRate >= 95 ? '#22c55e' : '#eab308' }}>{ep.successRate}%</strong></span>
                  <span>Deliveries: <strong style={{ color: 'var(--text-primary)' }}>{ep.totalDeliveries.toLocaleString()}</strong></span>
                  <span>Created: {ep.created}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => runTest(ep.id)} disabled={testing === ep.id} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 600, background: 'var(--bg-canvas)', border: '1px solid var(--border)', cursor: testing === ep.id ? 'wait' : 'pointer', color: testResult[ep.id] === 'ok' ? '#22c55e' : testResult[ep.id] === 'fail' ? '#ef4444' : 'var(--text-secondary)' }}>
                  {testing === ep.id ? '⏳' : testResult[ep.id] === 'ok' ? '✓ OK' : testResult[ep.id] === 'fail' ? '✕ Fail' : '▶ Test'}
                </button>
                <button onClick={() => toggleEnabled(ep.id)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 600, background: 'var(--bg-canvas)', border: '1px solid var(--border)', cursor: 'pointer', color: ep.enabled ? '#ef4444' : '#22c55e' }}>
                  {ep.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2 – Events ──────────────────────────────────────────────────────────

function Events() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const categories = ['all', 'transaction', 'payment', 'account', 'trustline', 'offer', 'contract', 'data', 'ledger'];

  const filtered = EVENT_TYPES.filter(ev => {
    if (selectedCategory !== 'all' && !ev.startsWith(selectedCategory)) return false;
    if (search && !ev.includes(search.toLowerCase())) return false;
    return true;
  });

  const EXAMPLE_PAYLOAD = selectedEvent ? `{
  "id": "evt_${Math.random().toString(36).slice(2, 10)}",
  "type": "${selectedEvent}",
  "created": ${Date.now()},
  "livemode": true,
  "data": {
    "object": {
      "id": "txn_8f2a9c3d",
      "type": "${selectedEvent.split('.')[0]}",
      "network": "testnet",
      "ledger": 48291042,
      "timestamp": "${new Date().toISOString()}",
      "source_account": "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
      "fee_charged": 100
    }
  },
  "request": {
    "id": "req_${Math.random().toString(36).slice(2, 10)}",
    "idempotency_key": null
  }
}` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Event Types & Payloads" subtitle="20+ Stellar event types with full payload preview and filtering support." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Total Event Types" value={EVENT_TYPES.length} color="var(--cyan,#06b6d4)" />
        <Stat label="Categories" value={categories.length - 1} color="#a78bfa" />
        <Stat label="Real-time" value="Yes" color="#22c55e" />
        <Stat label="Max Payload" value="256 KB" color="#f97316" />
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-muted)' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter events…" style={{ width: '100%', padding: '8px 12px 8px 30px', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map(c => (
            <button key={c} onClick={() => setSelectedCategory(c)} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: selectedCategory === c ? 'rgba(6,182,212,.15)' : 'var(--bg-elevated)', border: `1px solid ${selectedCategory === c ? 'var(--cyan,#06b6d4)' : 'var(--border)'}`, color: selectedCategory === c ? 'var(--cyan,#06b6d4)' : 'var(--text-muted)' }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedEvent ? '1fr 360px' : '1fr', gap: '14px' }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>{filtered.length} event types</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '12px 16px', maxHeight: '400px', overflowY: 'auto' }}>
            {filtered.map(ev => (
              <button key={ev} onClick={() => setSelectedEvent(selectedEvent === ev ? null : ev)} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontFamily: 'var(--font-mono)', cursor: 'pointer', background: selectedEvent === ev ? 'rgba(6,182,212,.2)' : 'var(--bg-canvas)', border: `1px solid ${selectedEvent === ev ? 'var(--cyan,#06b6d4)' : 'var(--border)'}`, color: selectedEvent === ev ? 'var(--cyan,#06b6d4)' : 'var(--text-secondary)' }}>{ev}</button>
            ))}
          </div>
        </Card>

        {selectedEvent && (
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--cyan,#06b6d4)', fontWeight: 700 }}>{selectedEvent}</div>
              <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}>✕</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Example Payload</div>
            <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflowX: 'auto', lineHeight: 1.6, maxHeight: '360px', overflowY: 'auto' }}>
              {EXAMPLE_PAYLOAD}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Step 3 – Authentication ──────────────────────────────────────────────────

function Authentication() {
  const [revealSecret, setRevealSecret] = useState<Record<string, boolean>>({});
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);

  const rotateSecret = (id: string) => {
    setRotatingId(id);
    setTimeout(() => setRotatingId(null), 1500);
  };

  const SIGNING_EXAMPLE = `// Node.js — verify HMAC-SHA256 signature
const crypto = require('crypto');

function verifySignature(payload, secret, signature) {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  const expected = 'sha256=' + hmac;
  
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Webhook Authentication" subtitle="HMAC-SHA256 signatures, rotating secrets, and API key management for secure delivery." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <Stat label="Signing Algorithm" value="HMAC-256" color="var(--cyan,#06b6d4)" />
        <Stat label="Secrets Active" value={MOCK_ENDPOINTS.length} color="#22c55e" />
        <Stat label="API Keys" value={2} color="#a78bfa" />
      </div>

      {/* Endpoint secrets */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Endpoint Signing Secrets</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {MOCK_ENDPOINTS.map(ep => (
            <div key={ep.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '12px', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.name}</span>
              <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                {revealSecret[ep.id] ? ep.secret.replace('•••••••', Math.random().toString(36).slice(2, 16)) : ep.secret}
              </code>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setRevealSecret(prev => ({ ...prev, [ep.id]: !prev[ep.id] }))} style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  {revealSecret[ep.id] ? '🙈 Hide' : '👁 Show'}
                </button>
                <button onClick={() => rotateSecret(ep.id)} style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '10px', background: rotatingId === ep.id ? 'rgba(234,179,8,.15)' : 'var(--bg-elevated)', border: `1px solid ${rotatingId === ep.id ? '#eab308' : 'var(--border)'}`, cursor: 'pointer', color: rotatingId === ep.id ? '#eab308' : 'var(--text-secondary)' }}>
                  {rotatingId === ep.id ? '⏳' : '🔄 Rotate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* API Keys */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>API Keys</div>
          <button onClick={() => setApiKeyVisible(!apiKeyVisible)} style={{ padding: '5px 10px', fontSize: '11px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-canvas)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            {apiKeyVisible ? '🙈 Hide Keys' : '👁 Show Keys'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { name: 'Production Key', key: 'sk_live_••••••••••••••••••••••••••••••', created: '2026-05-01', lastUsed: '2m ago' },
            { name: 'Read-only Key', key: 'sk_ro_•••••••••••••••••••••••••••••••', created: '2026-06-15', lastUsed: '1d ago' },
          ].map(k => (
            <div key={k.name} style={{ padding: '10px 12px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{k.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last used: {k.lastUsed}</span>
              </div>
              <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{apiKeyVisible ? k.key.replace(/•/g, '•') : k.key}</code>
            </div>
          ))}
        </div>
      </Card>

      {/* Signature verification */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Signature Verification Example</div>
        <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: 'var(--bg-canvas)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflowX: 'auto', lineHeight: 1.7 }}>
          {SIGNING_EXAMPLE}
        </pre>
      </Card>
    </div>
  );
}

// ─── Step 4 – Delivery ────────────────────────────────────────────────────────

function Delivery() {
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  const [selected, setSelected] = useState<WebhookDelivery | null>(null);

  const filtered = MOCK_DELIVERIES.filter(d => statusFilter === 'all' || d.status === statusFilter);
  const counts = MOCK_DELIVERIES.reduce((a, d) => { a[d.status] = (a[d.status] ?? 0) + 1; return a; }, {} as Record<string, number>);

  const statusColor: Record<DeliveryStatus, string> = {
    delivered: '#22c55e', failed: '#ef4444', retrying: '#eab308', pending: 'var(--text-muted)',
  };

  const RETRY_CONFIG = [
    { attempt: 1, delay: 'Immediate' },
    { attempt: 2, delay: '5 minutes' },
    { attempt: 3, delay: '30 minutes' },
    { attempt: 4, delay: '2 hours' },
    { attempt: 5, delay: '8 hours (final)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Delivery & Retry Logic" subtitle="Exponential backoff, delivery tracking, and full event log for every webhook attempt." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Delivered" value={counts.delivered ?? 0} color="#22c55e" />
        <Stat label="Failed" value={counts.failed ?? 0} color="#ef4444" />
        <Stat label="Retrying" value={counts.retrying ?? 0} color="#eab308" />
        <Stat label="Avg Latency" value={`${Math.round(MOCK_DELIVERIES.filter(d => d.latencyMs).reduce((a, d) => a + (d.latencyMs ?? 0), 0) / MOCK_DELIVERIES.filter(d => d.latencyMs).length)}ms`} color="#a78bfa" />
      </div>

      {/* Retry schedule */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Exponential Backoff Schedule</div>
        <div style={{ display: 'flex', gap: '0', overflow: 'hidden', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          {RETRY_CONFIG.map((r, i) => (
            <div key={r.attempt} style={{ flex: 1, padding: '10px 8px', textAlign: 'center', background: i % 2 === 0 ? 'var(--bg-canvas)' : 'transparent', borderRight: i < RETRY_CONFIG.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--cyan,#06b6d4)', marginBottom: '4px' }}>#{r.attempt}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.delay}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['all', 'delivered', 'failed', 'retrying', 'pending'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', background: statusFilter === s ? `${statusColor[s as DeliveryStatus] ?? 'var(--cyan,#06b6d4)'}22` : 'var(--bg-elevated)', border: `1px solid ${statusFilter === s ? (statusColor[s as DeliveryStatus] ?? 'var(--cyan,#06b6d4)') : 'var(--border)'}`, color: statusFilter === s ? (statusColor[s as DeliveryStatus] ?? 'var(--cyan,#06b6d4)') : 'var(--text-muted)' }}>{s}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 300px' : '1fr', gap: '14px' }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map(delivery => (
            <div key={delivery.id} onClick={() => setSelected(selected?.id === delivery.id ? null : delivery)}
              style={{ display: 'grid', gridTemplateColumns: '26px 90px 160px 70px 60px', gap: '12px', padding: '11px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center', background: selected?.id === delivery.id ? 'rgba(6,182,212,.06)' : 'transparent', transition: 'background 0.15s' }}>
              <StatusIcon status={delivery.status} />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{delivery.eventType}</span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--cyan,#06b6d4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {MOCK_ENDPOINTS.find(e => e.id === delivery.endpointId)?.name}
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: delivery.responseCode === 200 || delivery.responseCode === 201 ? '#22c55e' : delivery.responseCode ? '#ef4444' : 'var(--text-muted)' }}>
                {delivery.responseCode ?? '—'}
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textAlign: 'right' }}>
                {delivery.latencyMs ? `${delivery.latencyMs}ms` : '—'}
              </span>
            </div>
          ))}
        </Card>

        {selected && (
          <Card style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Delivery Detail</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}>✕</button>
            </div>
            <StatusIcon status={selected.status} />
            {[
              { l: 'Event Type', v: selected.eventType, mono: true },
              { l: 'Endpoint', v: MOCK_ENDPOINTS.find(e => e.id === selected.endpointId)?.url ?? '—', mono: true },
              { l: 'Status Code', v: String(selected.responseCode ?? '—'), mono: true },
              { l: 'Latency', v: selected.latencyMs ? `${selected.latencyMs}ms` : '—', mono: true },
              { l: 'Attempts', v: `${selected.attempts} / 5`, mono: false },
              { l: 'Timestamp', v: new Date(selected.timestamp).toLocaleString(), mono: false },
            ].map(r => (
              <div key={r.l}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>{r.l}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: r.mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>{r.v}</div>
              </div>
            ))}
            {selected.error && (
              <div style={{ fontSize: '12px', color: '#ef4444', background: 'rgba(239,68,68,.08)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,.2)', lineHeight: 1.5 }}>
                {selected.error}
              </div>
            )}
            {selected.nextRetry && (
              <div style={{ fontSize: '12px', color: '#eab308' }}>
                Next retry: {new Date(selected.nextRetry).toLocaleTimeString()}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Step 5 – Analytics ───────────────────────────────────────────────────────

function WebhookAnalytics() {
  const maxDelivered = Math.max(...METRIC_HISTORY.map(h => h.delivered));
  const totalDelivered = METRIC_HISTORY.reduce((a, h) => a + h.delivered, 0);
  const totalFailed = METRIC_HISTORY.reduce((a, h) => a + h.failed, 0);
  const successRate = Math.round((totalDelivered / (totalDelivered + totalFailed)) * 100);
  const avgLatency = 108;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <SectionHeader title="Webhook Delivery Analytics" subtitle="Delivery rate, latency distribution, failure analysis, and endpoint-level performance metrics." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <Stat label="Success Rate" value={`${successRate}%`} color={successRate >= 95 ? '#22c55e' : '#eab308'} />
        <Stat label="Total Delivered" value={totalDelivered.toLocaleString()} color="var(--cyan,#06b6d4)" />
        <Stat label="Total Failed" value={totalFailed} color="#ef4444" />
        <Stat label="Avg Latency" value={`${avgLatency}ms`} color="#a78bfa" />
      </div>

      {/* Hourly delivery chart */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>Hourly Delivery Volume</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
          {METRIC_HISTORY.map(h => (
            <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${Math.round((h.failed / maxDelivered) * 100)}px`, background: 'rgba(239,68,68,.6)', borderRadius: '3px 3px 0 0', minHeight: h.failed > 0 ? '4px' : '0' }} />
                <div style={{ width: '100%', height: `${Math.round((h.delivered / maxDelivered) * 100)}px`, background: 'var(--cyan,#06b6d4)', borderRadius: '3px 3px 0 0', minHeight: '4px' }} />
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{h.hour}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '11px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--cyan,#06b6d4)' }} />Delivered</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(239,68,68,.6)' }} />Failed</span>
        </div>
      </Card>

      {/* Endpoint performance */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Endpoint Performance</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {MOCK_ENDPOINTS.map(ep => (
            <div key={ep.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                <span style={{ fontWeight: 600 }}>{ep.name}</span>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{ep.totalDeliveries.toLocaleString()} deliveries</span>
                  <span style={{ color: ep.successRate >= 95 ? '#22c55e' : '#eab308', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{ep.successRate}%</span>
                </div>
              </div>
              <MiniBar value={ep.successRate} max={100} color={ep.successRate >= 95 ? '#22c55e' : '#eab308'} />
            </div>
          ))}
        </div>
      </Card>

      {/* Failure breakdown */}
      <Card>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Failure Analysis</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { code: '503', label: 'Service Unavailable', count: 9, pct: 42 },
            { code: '502', label: 'Bad Gateway', count: 7, pct: 33 },
            { code: '408', label: 'Request Timeout', count: 4, pct: 19 },
            { code: '401', label: 'Unauthorized', count: 1, pct: 5 },
          ].map(f => (
            <div key={f.code} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#ef4444', width: '36px', flexShrink: 0 }}>{f.code}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{f.count} ({f.pct}%)</span>
                </div>
                <MiniBar value={f.pct} max={100} color="rgba(239,68,68,.7)" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'creation', label: 'Creation', icon: '🔗', short: 'Creation' },
  { id: 'events', label: 'Events', icon: '📋', short: 'Events' },
  { id: 'auth', label: 'Auth', icon: '🔐', short: 'Auth' },
  { id: 'delivery', label: 'Delivery', icon: '📤', short: 'Delivery' },
  { id: 'analytics', label: 'Analytics', icon: '📊', short: 'Analytics' },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function WebhooksPro() {
  const [activeStep, setActiveStep] = useState<StepId>('creation');
  const idx = STEPS.findIndex(s => s.id === activeStep);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <span style={{ fontSize: '22px' }}>🔗</span>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, margin: 0 }}>Webhooks Pro</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Full-featured webhook platform with 20+ event types, HMAC auth, retry logic, and delivery analytics.</p>
      </div>

      <div style={{ display: 'flex', gap: '0', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {STEPS.map((step, i) => {
          const isActive = activeStep === step.id;
          const isDone = i < idx;
          return (
            <button key={step.id} onClick={() => setActiveStep(step.id)} style={{ flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', background: isActive ? 'rgba(6,182,212,.12)' : 'transparent', borderRight: i < STEPS.length - 1 ? '1px solid var(--border)' : 'none', borderBottom: isActive ? '2px solid var(--cyan,#06b6d4)' : '2px solid transparent', color: isActive ? 'var(--cyan,#06b6d4)' : isDone ? '#22c55e' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', transition: 'var(--transition)' }}>
              <span style={{ fontSize: '13px' }}>{isDone ? '✅' : step.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{i + 1}. {step.short}</span>
            </button>
          );
        })}
      </div>

      {activeStep === 'creation' && <WebhookCreation />}
      {activeStep === 'events' && <Events />}
      {activeStep === 'auth' && <Authentication />}
      {activeStep === 'delivery' && <Delivery />}
      {activeStep === 'analytics' && <WebhookAnalytics />}

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <button disabled={idx === 0} onClick={() => setActiveStep(STEPS[idx - 1].id)} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--text-muted)' : 'var(--text-primary)', opacity: idx === 0 ? 0.4 : 1 }}>← Previous</button>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center', fontFamily: 'var(--font-mono)' }}>Step {idx + 1} of {STEPS.length}</span>
        <button disabled={idx === STEPS.length - 1} onClick={() => setActiveStep(STEPS[idx + 1].id)} style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, background: idx === STEPS.length - 1 ? 'var(--bg-elevated)' : 'var(--cyan,#06b6d4)', border: '1px solid var(--border)', cursor: idx === STEPS.length - 1 ? 'not-allowed' : 'pointer', color: idx === STEPS.length - 1 ? 'var(--text-muted)' : '#000', opacity: idx === STEPS.length - 1 ? 0.4 : 1 }}>Next →</button>
      </div>
    </div>
  );
}
