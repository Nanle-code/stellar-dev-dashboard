import React, { useState } from "react";
import { useStore } from "../../lib/store";
import {
  EXPLORERS,
  getAccountUrl,
  getTransactionUrl,
  getContractUrl,
} from "../../lib/externalExplorers";

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              marginTop: "4px",
              fontSize: "11px",
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ padding: "18px" }}>{children}</div>
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function textInputStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-bright)",
    borderRadius: "var(--radius-md)",
    padding: "10px 14px",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
    outline: "none",
    transition: "var(--transition)",
    boxSizing: "border-box",
  };
}

export default function ExplorerEmbed() {
  const { network } = useStore();

  const [resourceType, setResourceType] = useState("account");
  const [resourceId, setResourceId] = useState("");
  const [selectedExplorer, setSelectedExplorer] = useState("stellarExpert");

  function getExplorerUrl(): string | null {
    if (!resourceId.trim()) return null;

    switch (resourceType) {
      case "account":
        return getAccountUrl(selectedExplorer, network, resourceId);
      case "transaction":
        return getTransactionUrl(selectedExplorer, network, resourceId);
      case "contract":
        return getContractUrl(selectedExplorer, network, resourceId);
      default:
        return null;
    }
  }

  const explorerUrl = getExplorerUrl();

  return (
    <div
      className="animate-in"
      style={{ display: "flex", flexDirection: "column", gap: "24px" }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 700,
        }}
      >
        Explorer Integration
      </div>

      <Panel
        title="External Explorer Links"
        subtitle="Quick access to Stellar Expert and Steexp"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
            marginBottom: "14px",
          }}
        >
          <LabeledField label="Resource Type">
            <select
              value={resourceType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setResourceType(e.target.value)}
              style={textInputStyle()}
            >
              <option value="account">Account</option>
              <option value="transaction">Transaction</option>
              <option value="contract">Contract</option>
            </select>
          </LabeledField>

          <LabeledField label="Explorer">
            <select
              value={selectedExplorer}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedExplorer(e.target.value)}
              style={textInputStyle()}
            >
              {Object.entries(EXPLORERS).map(([key, explorer]) => (
                <option key={key} value={key}>
                  {explorer.name}
                </option>
              ))}
            </select>
          </LabeledField>

          <LabeledField
            label={`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} ID`}
          >
            <input
              value={resourceId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResourceId(e.target.value)}
              placeholder={`Enter ${resourceType} ID`}
              style={textInputStyle()}
            />
          </LabeledField>
        </div>

        {explorerUrl && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 16px",
                background: "var(--cyan)",
                color: "var(--bg-base)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                transition: "var(--transition)",
              }}
            >
              <span>{EXPLORERS[selectedExplorer].logo}</span>
              <span>Open in {EXPLORERS[selectedExplorer].name}</span>
              <span>↗</span>
            </a>

            <div
              style={{
                padding: "12px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
                wordBreak: "break-all",
              }}
            >
              {explorerUrl}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Quick Links" subtitle="Popular Stellar explorers and tools">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
          }}
        >
          {Object.entries(EXPLORERS).map(([key, explorer]) => (
            <a
              key={key}
              href={`${explorer.baseUrl}/${network === "mainnet" ? "public" : "testnet"}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "14px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                transition: "var(--transition)",
              }}
            >
              <div style={{ fontSize: "24px" }}>{explorer.logo}</div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {explorer.name}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {explorer.baseUrl}
              </div>
            </a>
          ))}
        </div>
      </Panel>
    </div>
  );
}
