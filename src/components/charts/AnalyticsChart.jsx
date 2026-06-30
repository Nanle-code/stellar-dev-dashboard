import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

function ChartShell({ title, children, height = 250 }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "13px",
          marginBottom: "10px",
        }}
      >
        {title}
      </div>
      <div style={{ height }}>
        {children}
      </div>
    </div>
  );
}

export function ActivityTrendChart({ data = [] }) {
  return (
    <ChartShell title="14-Day Activity">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
          <Tooltip />
          <Line dataKey="transactions" stroke="var(--cyan)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function LatencyTrendChart({ data = [] }) {
  return (
    <ChartShell title="Latency (Last 24h)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            domain={[0, 'dataMax + 100']}
            unit="ms"
          />
          <Tooltip formatter={(value) => [`${value} ms`, 'Latency']} />
          <Line dataKey="latency" stroke="var(--cyan)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function FeeTrendChart({ data = [] }) {
  return (
    <ChartShell title="Fees (Stroops)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
          <Tooltip />
          <Bar dataKey="fees" fill="var(--amber)" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export default function AnalyticsChart({ data = [], latencyData = [] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
      <ActivityTrendChart data={data} />
      {latencyData.length > 0 && <LatencyTrendChart data={latencyData} />}
      <FeeTrendChart data={data} />
    </div>
  );
}
