import React, { useState } from "react";
import { useAnalytics } from "../../hooks/useAnalytics";
import AnalyticsChart from "../charts/AnalyticsChart";
import CorrelationGraph from "../charts/CorrelationGraph";
import { StatCard } from "./Card";
import CustomReports from "./CustomReports";
import EnhancedTable, { type TableDensity, type ColumnPreset } from "../common/EnhancedTable";
import { useTablePresets } from "../../hooks/useTablePresets";
import type { AlertEntry } from "./types";

const RISK_SIGNAL_COLUMNS = [
  { id: 'label', label: 'Risk Signal', width: '2fr' },
  { id: 'severity', label: 'Severity', width: '1fr' },
  { id: 'status', label: 'Status', width: '1fr' },
];

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

  // Table presets for risk signals
  const riskPresets = useTablePresets('analytics-risk-signals', ['label', 'severity', 'status'], 'comfortable');

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

      <CorrelationGraph />

      {/* Risk Signals Table */}
      <EnhancedTable
        columns={RISK_SIGNAL_COLUMNS}
        visibleColumns={riskPresets.visibleColumns}
        onVisibleColumnsChange={riskPresets.setVisibleColumns}
        density={riskPresets.density}
        onDensityChange={riskPresets.setDensity}
        presets={riskPresets.presets}
        onPresetSave={riskPresets.onPresetSave}
        onPresetDelete={riskPresets.onPresetDelete}
        onPresetApply={riskPresets.onPresetApply}
        stickyHeader={true}
        maxHeight="400px"
      >
        {risks.map((risk) => (
          <div
            key={risk.id}
            style={{
              display: 'grid',
              gridTemplateColumns: riskPresets.visibleColumns.map((id) => {
                const col = RISK_SIGNAL_COLUMNS.find((c) => c.id === id);
                return col?.width || '1fr';
              }).join(' '),
              gap: '12px',
              padding: riskPresets.density === 'compact' ? '8px 12px' : riskPresets.density === 'comfortable' ? '12px 18px' : '16px 24px',
              borderBottom: '1px solid var(--border)',
              fontSize: riskPresets.density === 'compact' ? '11px' : riskPresets.density === 'comfortable' ? '12px' : '13px',
              alignItems: 'center',
            }}
          >
            {riskPresets.visibleColumns.includes('label') && (
              <span style={{ color: 'var(--text-primary)' }}>{risk.label}</span>
            )}
            {riskPresets.visibleColumns.includes('severity') && (
              <span style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                background: risk.severity === 'high' ? 'var(--red-glow-sm)' : risk.severity === 'medium' ? 'var(--amber-glow-sm)' : 'var(--cyan-glow-sm)',
                color: risk.severity === 'high' ? 'var(--red)' : risk.severity === 'medium' ? 'var(--amber)' : 'var(--cyan)',
                border: `1px solid ${risk.severity === 'high' ? 'var(--red)' : risk.severity === 'medium' ? 'var(--amber)' : 'var(--cyan)'}`,
              }}>
                {risk.severity}
              </span>
            )}
            {riskPresets.visibleColumns.includes('status') && (
              <span style={{ color: risk.active ? 'var(--green)' : 'var(--text-muted)' }}>
                {risk.active ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
        ))}
      </EnhancedTable>
    </div>
  );
}
