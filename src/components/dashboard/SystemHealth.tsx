import React from "react";
import { useStore } from '../../lib/store'
import { useMonitoring } from "../../hooks/useMonitoring";
import { StatCard } from "./Card";
import { LatencyTrendChart } from "../charts/AnalyticsChart";
import type { AlertEntry, MonitoringSnapshot, HealthProbe, NetworkHealthProbe } from "./types";
import { ErrorRecoveryPanel } from "../errors/ErrorRecoveryPanel";

function AlertRow({ alert, onClear }: { alert: AlertEntry; onClear: (id: string) => void }) {
  const color =
    alert.severity === "critical"
      ? "var(--red)"
      : alert.severity === "warning"
        ? "var(--amber)"
        : "var(--cyan)";

  return (
    <div
      style={{
        border: `1px solid ${color}`,
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        background: "var(--bg-elevated)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "12px", color, fontWeight: 700 }}>{alert.title}</div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {alert.description}
          </div>
        </div>
        <button
          onClick={() => onClear(alert.id)}
          style={{
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            borderRadius: "var(--radius-sm)",
            height: "26px",
            padding: "0 8px",
            fontSize: "11px",
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function ServiceStatus({ label, probe }: { label: string; probe: HealthProbe }) {
  const color =
    probe.status === "up"
      ? "var(--green)"
      : probe.status === "degraded"
        ? "var(--amber)"
        : "var(--red)";

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-elevated)",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{ fontSize: "16px", color, fontWeight: 700, textTransform: "uppercase" }}>
        {probe.status}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
        {probe.latency != null ? `${probe.latency} ms` : probe.error || "unavailable"}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
        Circuit breaker: {probe.breakerState}
      </div>
    </div>
  );
}

export default function SystemHealth() {
  const { setActiveTab } = useStore()
  const { snapshot, score, alerts, errors, clearAlert, resetAlerts } = useMonitoring() as {
    snapshot: MonitoringSnapshot
    score: number
    alerts: AlertEntry[]
    errors: Array<Record<string, unknown>>
    clearAlert: (id: string) => void
    resetAlerts: () => void
  }
  const memory = snapshot?.memory;
  const networkHealth: NetworkHealthProbe[] = snapshot?.networkHealth || [];
  const latencyHistory: Array<{ timestamp: number; latency: number }> = snapshot?.latencyHistory || [];

  const averageLatency = latencyHistory.length
    ? Math.round(latencyHistory[latencyHistory.length - 1].latency)
    : null;

  const openBreakers = networkHealth.reduce((count: number, network: NetworkHealthProbe) => {
    return (
      count +
      (network.horizon.breakerState === "OPEN" ? 1 : 0) +
      (network.soroban.breakerState === "OPEN" ? 1 : 0)
    );
  }, 0);

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700 }}>
        System Health
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
        <StatCard label="Health Score" value={`${score}/100`} accent={score < 60 ? "var(--red)" : "var(--green)"} />
        <StatCard label="Online" value={snapshot?.online ? "Yes" : "No"} />
        <StatCard label="Visibility" value={snapshot?.visibility || "unknown"} />
        <StatCard label="Runtime Errors" value={errors.length} accent={errors.length ? "var(--amber)" : "var(--cyan)"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
        <StatCard
          label="Heap Used (MB)"
          value={memory?.usedJSHeapSize ? (memory.usedJSHeapSize / (1024 * 1024)).toFixed(2) : "n/a"}
        />
        <StatCard
          label="Heap Total (MB)"
          value={memory?.totalJSHeapSize ? (memory.totalJSHeapSize / (1024 * 1024)).toFixed(2) : "n/a"}
        />
        <StatCard
          label="Load Event (ms)"
          value={snapshot?.navigation?.loadEventMs || "n/a"}
        />
        <StatCard
          label="Avg Latency"
          value={averageLatency != null ? `${averageLatency} ms` : "n/a"}
          accent={averageLatency != null && averageLatency > 1200 ? "var(--amber)" : "var(--green)"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
        <StatCard label="Networks Probed" value={networkHealth.length} />
        <StatCard label="Open Breakers" value={openBreakers} accent={openBreakers ? "var(--red)" : "var(--cyan)"} />
        <StatCard label="Last Updated" value={snapshot?.timestamp || "n/a"} />
        <StatCard
          label="Latency History"
          value={latencyHistory.length ? `${latencyHistory.length} points` : "pending"}
        />
      </div>

      {networkHealth.length > 0 && (
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "13px" }}>Network Probes</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
            {networkHealth.map((netProbe: NetworkHealthProbe) => (
              <div
                key={netProbe.network}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-card)",
                  padding: "14px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "10px" }}>
                  {netProbe.name}
                </div>
                <div style={{ display: "grid", gap: "10px" }}>
                  <ServiceStatus label="Horizon" probe={netProbe.horizon} />
                  <ServiceStatus label="Soroban" probe={netProbe.soroban} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: "13px" }}>Latency Trend</div>
        <LatencyTrendChart data={latencyHistory} />
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "13px" }}>Alerts</div>
          <button
            onClick={resetAlerts}
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "11px",
              padding: "4px 8px",
            }}
          >
            Clear All
          </button>
        </div>
        {alerts.length === 0 && (
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            No active alerts.
          </div>
        )}
        {alerts.map((alert: AlertEntry) => (
          <AlertRow key={alert.id} alert={alert} onClear={clearAlert} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setActiveTab('performance')}
          style={{
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            color: 'var(--cyan)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          View Performance Monitor →
        </button>
      </div>

      {/* D-057 — Error Recovery & Self-Healing panel */}
      <ErrorRecoveryPanel />
    </div>
  );
}
