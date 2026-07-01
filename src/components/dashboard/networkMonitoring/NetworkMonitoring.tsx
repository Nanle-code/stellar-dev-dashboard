import React, { useMemo } from 'react';

import { useNetworkDiagnostics } from '../../../hooks/useNetworkDiagnostics';
import type { LatencyDegradationAlert } from '../../../hooks/useNetworkDiagnostics';

type Severity = 'ok' | 'warning' | 'critical';

type NodeStatusRow = {
  nodeId: string;
  label: string;
  kind: 'core' | 'edge';
  zone: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  endpointMs?: number;
  lastUpdatedAt: number;
};

type TopologyModel = {
  nodes: Array<{ id: string; kind: 'core' | 'edge'; label: string; zone: string; status: 'ok' | 'degraded' | 'down' }>;
  paths: Array<{
    id: string;
    from: string;
    to: string;
    hops: string[];
    estimatedLatencyMs: number;
    degradedRisk: 'low' | 'medium' | 'high';
  }>;
};


function severityToColor(sev: Severity) {
  switch (sev) {
    case 'critical':
      return { border: 'rgba(239,68,68,0.35)', text: 'var(--red)', dot: 'var(--red)' };
    case 'warning':
      return { border: 'rgba(245,158,11,0.35)', text: 'var(--amber)', dot: 'var(--amber)' };
    case 'ok':
    default:
      return { border: 'rgba(34,197,94,0.30)', text: 'var(--green)', dot: 'var(--green)' };
  }
}

function statusToSeverity(status: 'ok' | 'degraded' | 'down' | undefined): Severity {
  if (status === 'down') return 'critical';
  if (status === 'degraded') return 'warning';
  return 'ok';
}

function formatMs(n?: number) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return `${Math.round(n)} ms`;
}

function Panel(props: {
  title: string;
  subtitle?: string;
  severity?: Severity;
  children: React.ReactNode;
}) {
  const c = severityToColor(props.severity ?? 'ok');
  return (
    <section
      className="animate-in"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${props.severity ? c.border : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: props.severity ? c.dot : 'transparent',
              boxShadow: props.severity ? `0 0 10px ${c.dot}` : 'none',
              display: 'inline-block',
            }}
          />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13 }}>{props.title}</div>
        </div>
        {props.subtitle ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{props.subtitle}</div>
        ) : null}
      </div>
      <div style={{ padding: 18 }}>{props.children}</div>
    </section>
  );
}

function AlertsPanel(props: { alerts: LatencyDegradationAlert[]; loading: boolean }) {
  if (props.loading) {
    return (
      <div style={{
        padding: 16,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--text-muted)',
      }}>
        Running connectivity diagnostics…
      </div>
    );
  }

  if (!props.alerts.length) {
    return (
      <div
        style={{
          padding: 16,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}
      >
        No degradation alerts at the moment.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {props.alerts.slice(0, 6).map((a) => {
        const sev: Severity = a.severity === 'critical' ? 'critical' : 'warning';
        const c = severityToColor(sev);
        return (
          <div
            key={a.alertId}
            style={{
              border: `1px solid ${c.border}`,
              borderRadius: 'var(--radius-lg)',
              padding: 14,
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: c.text }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {new Date(a.createdAt).toLocaleTimeString()}
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>{a.summary}</div>
            {a.relatedHosts?.length ? (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Affected: {a.relatedHosts.join(', ')}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StatTile(props: {
  label: string;
  value: string;
  severity?: Severity;
  hint?: string;
}) {
  const c = severityToColor(props.severity ?? 'ok');
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
        background: 'var(--bg-surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{props.label}</div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: props.severity ? c.text : 'var(--text-secondary)',
            fontFamily: 'var(--font-display)',
          }}
        >
          {props.value}
        </div>
      </div>
      {props.hint ? <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{props.hint}</div> : null}
    </div>
  );
}

function NodeStatusGrid(props: { rows: NodeStatusRow[]; loading: boolean }) {
  if (props.loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, background: 'var(--bg-surface)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Loading node status…</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
      {props.rows.map((r) => {
        const sev = statusToSeverity(r.status);
        const c = severityToColor(sev);
        return (
          <div
            key={r.nodeId}
            style={{
              border: `1px solid ${c.border}`,
              borderRadius: 'var(--radius-lg)',
              padding: 14,
              background: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: c.text, fontFamily: 'var(--font-display)' }}>{r.label}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {r.kind.toUpperCase()} • {r.zone} • {r.nodeId}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {new Date(r.lastUpdatedAt).toLocaleTimeString()}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <StatTile label="Ping" value={formatMs(r.latencyMs)} severity={sev} />
              <StatTile label="Endpoint" value={formatMs(r.endpointMs)} severity={sev} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NetworkTopology(props: { topology: TopologyModel; loading: boolean }) {
  const nodeById = useMemo(() => Object.fromEntries(props.topology.nodes.map((n) => [n.id, n])), [props.topology.nodes]);

  if (props.loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, background: 'var(--bg-surface)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13 }}>Network Topology Map</div>
          <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            Loading topology model…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, background: 'var(--bg-surface)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13 }}>Network Topology Map</div>
        <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          Nodes: {props.topology.nodes.length} • Paths: {props.topology.paths.length}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {props.topology.nodes.map((n) => {
          const sev = statusToSeverity(n.status);
          const c = severityToColor(sev);
          return (
            <div
              key={n.id}
              style={{
                border: `1px solid ${c.border}`,
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                minWidth: 185,
                background: 'var(--bg-surface)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {n.kind} • {n.zone}
              </div>
              <div style={{ marginTop: 6, fontWeight: 900, fontSize: 13, color: c.text }}>{n.label}</div>
              <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                Status: <span style={{ color: c.text }}>{n.status.toUpperCase()}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, background: 'var(--bg-surface)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13 }}>Connection Paths</div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {props.topology.paths.map((p) => {
            const riskColor =
              p.degradedRisk === 'high' ? 'var(--red)' : p.degradedRisk === 'medium' ? 'var(--amber)' : 'var(--green)';
            return (
              <div
                key={p.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  background: 'var(--bg-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <div style={{ fontSize: 12, fontWeight: 900 }}>
                    {nodeById[p.from]?.label ?? p.from} → {nodeById[p.to]?.label ?? p.to}
                  </div>
                  <div style={{ fontSize: 11, color: riskColor, fontFamily: 'var(--font-mono)' }}>
                    {p.estimatedLatencyMs} ms • Risk {p.degradedRisk.toUpperCase()}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  {p.hops.join(' → ')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function NetworkMonitoring() {
  const state = useNetworkDiagnostics();

  const severity: Severity = state.degradedLatency.isDegraded
    ? state.degradedLatency.score >= 75
      ? 'critical'
      : 'warning'
    : 'ok';

  const subtitle = state.loading
    ? 'Probing DNS + endpoint health'
    : state.degradedLatency.isDegraded
      ? `Degraded latency score: ${state.degradedLatency.score}/100`
      : `Latency stable • Score: ${state.degradedLatency.score}/100`;

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16 }}>Network Monitoring & Diagnostics</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              background: 'var(--bg-surface)',
              minWidth: 165,
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Avg ping
            </div>
            <div style={{ marginTop: 6, fontWeight: 900, fontFamily: 'var(--font-display)' }}>
              {formatMs(state.degradedLatency.avgPingMs)}
            </div>
          </div>

          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              background: 'var(--bg-surface)',
              minWidth: 165,
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Avg endpoint
            </div>
            <div style={{ marginTop: 6, fontWeight: 900, fontFamily: 'var(--font-display)' }}>
              {formatMs(state.degradedLatency.avgEndpointMs)}
            </div>
          </div>

          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              background: 'var(--bg-surface)',
              minWidth: 140,
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Status
            </div>
            <div style={{ marginTop: 6, fontWeight: 900, fontFamily: 'var(--font-display)', color: severityToColor(severity).text }}>
              {severity.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
        <Panel
          title="Alerts"
          severity={severity === 'ok' ? undefined : severity}
          subtitle={state.degradedLatency.isDegraded ? 'Degraded latency conditions' : 'All systems normal'}
        >
          <AlertsPanel alerts={state.sortedAlerts ?? state.alerts} loading={state.loading} />
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel
            title="Node Status & Latency"
            subtitle={state.loading ? 'Updating probe samples…' : `Last update: ${new Date(state.updatedAt || Date.now()).toLocaleTimeString()}`}
          >
            <NodeStatusGrid rows={state.nodeStatusRows as NodeStatusRow[]} loading={state.loading} />
          </Panel>

          <NetworkTopology topology={state.topology as TopologyModel} loading={state.loading} />
        </div>
      </div>
    </div>
  );
}

