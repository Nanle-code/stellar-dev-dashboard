import React from "react";
import { useAnalytics } from "../../hooks/useAnalytics";
import AnalyticsChart from "../charts/AnalyticsChart";
import { StatCard } from "./Card";
import CustomReports from "./CustomReports";
import type { AlertEntry } from "./types";

function RiskItem({ signal }: { signal: AlertEntry }) {
  const color =
    signal.severity === "high"
      ? "var(--red)"
      : signal.severity === "medium"
        ? "var(--amber)"
        : "var(--cyan)";

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${signal.active ? color : "var(--border)"}`,
        background: "var(--bg-elevated)",
        color: signal.active ? color : "var(--text-muted)",
        fontSize: "12px",
      }}
    >
      {signal.label}
    </div>
  );
}

export default function Analytics() {
  const analytics = useAnalytics();
  const account = analytics?.account || {};
  const tx = analytics?.transactions || {};
  const network = analytics?.network || {};
  const risks: AlertEntry[] = analytics?.risks || [];

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700 }}>
        Analytics
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
        <StatCard label="XLM Balance" value={account.xlmBalance?.toFixed?.(2) || "0.00"} accent="var(--cyan)" />
        <StatCard label="Trustlines" value={account.trustlineCount || 0} accent="var(--amber)" />
        <StatCard label="Success Rate" value={`${((tx.successRate || 0) * 100).toFixed(1)}%`} accent="var(--green)" />
        <StatCard label="Weekly Activity" value={tx.weeklyActivity || 0} accent="var(--text-primary)" />
      </div>

      <AnalyticsChart data={analytics.activity || []} />

      <CustomReports analytics={analytics} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
        <StatCard label="Latest Ledger" value={network.latestLedgerSequence || "—"} />
        <StatCard label="Base Fee" value={network.baseFee || 0} />
        <StatCard label="Avg Close Time" value={`${(network.averageCloseSeconds || 0).toFixed(2)}s`} />
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
        <div style={{ fontFamily: "var(--font-display)", fontSize: "13px" }}>Risk Signals</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
          {risks.map((risk) => (
            <RiskItem key={risk.id} signal={risk} />
          ))}
        </div>
      </div>
    </div>
  );
}
