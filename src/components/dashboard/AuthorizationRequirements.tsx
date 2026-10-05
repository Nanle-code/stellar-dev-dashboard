import React from "react";
import { Shield, Lock, Unlock, Key, Users, AlertTriangle, CheckCircle2, Info } from "lucide-react";

function Badge({ label, variant }) {
  const colors = {
    critical: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
    high: { bg: "rgba(249,115,22,0.15)", text: "#f97316" },
    medium: { bg: "rgba(234,179,8,0.15)", text: "#eab308" },
    low: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
    safe: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
    info: { bg: "rgba(59,130,246,0.15)", text: "#3b82f6" },
  };
  const c = colors[variant] || colors.info;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 6px",
        borderRadius: "4px",
        background: c.bg,
        color: c.text,
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {label}
    </span>
  );
}

function RequirementCard({ title, icon, description, severity, children }) {
  const severityColors = {
    critical: { border: "#ef4444", bg: "rgba(239,68,68,0.05)" },
    high: { border: "#f97316", bg: "rgba(249,115,22,0.05)" },
    medium: { border: "#eab308", bg: "rgba(234,179,8,0.05)" },
    low: { border: "#22c55e", bg: "rgba(34,197,94,0.05)" },
    safe: { border: "#22c55e", bg: "rgba(34,197,94,0.05)" },
    info: { border: "#3b82f6", bg: "rgba(59,130,246,0.05)" },
  };
  const colors = severityColors[severity] || severityColors.info;

  return (
    <div
      style={{
        padding: "12px",
        borderLeft: `3px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: "0 var(--radius-md) var(--radius-md) 0",
        marginBottom: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        {icon}
        <span style={{ fontSize: "13px", fontWeight: 600 }}>{title}</span>
        <Badge label={severity} variant={severity} />
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
        {description}
      </div>
      {children}
    </div>
  );
}

interface AuthorizationRequirementsProps {
  contractId?: string;
  wasmHash?: string;
  upgradeAuth?: string;
  network?: string;
  historicalData?: Array<{
    wasmHash: string;
    authorization: string;
    timestamp: number;
  }>;
}

export default function AuthorizationRequirements({
  contractId,
  wasmHash,
  upgradeAuth,
  network = "testnet",
  historicalData = [],
}: AuthorizationRequirementsProps) {
  // Validate inputs
  const isValidContractId = contractId && typeof contractId === 'string' && contractId.length > 0;
  const isValidWasmHash = wasmHash && typeof wasmHash === 'string' && wasmHash.length > 0;
  const isValidNetwork = network && typeof network === 'string' && ['testnet', 'mainnet', 'public', 'custom'].includes(network);

  if (!isValidNetwork) {
    return (
      <div style={{
        padding: "16px",
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: "var(--radius-md)",
        color: "#ef4444",
        fontSize: "12px",
      }}>
        Invalid network specified. Please provide a valid network (testnet, mainnet, public, or custom).
      </div>
    );
  }

  const parseAuthRequirements = (auth: string) => {
    if (!auth || auth === "none") {
      return {
        type: "public",
        severity: "safe",
        requirements: [],
        description: "No authorization required - anyone can invoke",
      };
    }

    const requirements = [];
    let severity = "low";

    if (auth.includes("admin")) {
      requirements.push({
        type: "admin",
        description: "Admin privileges required",
        icon: <Shield size={14} color="#ef4444" />,
      });
      severity = "critical";
    }

    if (auth.includes("owner")) {
      requirements.push({
        type: "owner",
        description: "Contract owner authorization required",
        icon: <Key size={14} color="#f97316" />,
      });
      severity = severity === "critical" ? "critical" : "high";
    }

    if (auth.includes("multisig")) {
      requirements.push({
        type: "multisig",
        description: "Multi-signature approval required",
        icon: <Users size={14} color="#eab308" />,
      });
      severity = severity === "critical" ? "critical" : severity === "high" ? "high" : "medium";
    }

    if (auth.includes("auth") && !auth.includes("admin") && !auth.includes("owner")) {
      requirements.push({
        type: "custom",
        description: "Custom authorization requirements",
        icon: <Lock size={14} color="#3b82f6" />,
      });
      severity = severity === "safe" ? "low" : severity;
    }

    if (requirements.length === 0) {
      requirements.push({
        type: "unknown",
        description: "Unknown authorization requirements",
        icon: <Info size={14} color="#3b82f6" />,
      });
    }

    return {
      type: "restricted",
      severity,
      requirements,
      description: auth,
    };
  };

  const currentAuth = parseAuthRequirements(upgradeAuth || "none");

  const getAuthChangeHistory = () => {
    if (historicalData.length === 0) return null;

    const changes = [];
    for (let i = 1; i < historicalData.length; i++) {
      const prev = historicalData[i - 1];
      const curr = historicalData[i];
      
      if (prev.authorization !== curr.authorization) {
        changes.push({
          from: prev.authorization,
          to: curr.authorization,
          timestamp: curr.timestamp,
          hash: curr.wasmHash,
        });
      }
    }

    return changes;
  };

  const authChanges = getAuthChangeHistory();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Shield size={18} />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            Authorization Requirements
          </span>
        </div>
        <div style={{ padding: "18px" }}>
          {contractId && (
            <div style={{ marginBottom: "12px" }}>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                }}
              >
                Contract ID
              </span>
              <div
                style={{
                  marginTop: "4px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--text-primary)",
                }}
              >
                {contractId.slice(0, 12)}...{contractId.slice(-4)}
              </div>
            </div>
          )}

          {wasmHash && (
            <div style={{ marginBottom: "12px" }}>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                }}
              >
                Current WASM Hash
              </span>
              <div
                style={{
                  marginTop: "4px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--cyan)",
                }}
              >
                {wasmHash.slice(0, 20)}...
              </div>
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              Current Authorization Status
            </span>
            <div style={{ marginTop: "8px" }}>
              <RequirementCard
                title={currentAuth.type === "public" ? "Public Access" : "Restricted Access"}
                icon={currentAuth.type === "public" ? <Unlock size={16} color="#22c55e" /> : <Lock size={16} color="#f97316" />}
                description={currentAuth.description}
                severity={currentAuth.severity}
              >
                {currentAuth.requirements.length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {currentAuth.requirements.map((req, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                        {req.icon}
                        <span>{req.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </RequirementCard>
            </div>
          </div>

          {authChanges && authChanges.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                }}
              >
                Authorization Change History
              </span>
              <div style={{ marginTop: "8px" }}>
                {authChanges.map((change, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "10px",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--radius-md)",
                      marginBottom: "8px",
                      borderLeft: "3px solid var(--cyan)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <AlertTriangle size={12} color="#eab308" />
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>
                        Authorization Changed
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {new Date(change.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      <div>From: {change.from || "none"}</div>
                      <div>To: {change.to || "none"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {network && (
            <div style={{ marginTop: "16px", fontSize: "11px", color: "var(--text-muted)" }}>
              Network: <Badge label={network} variant="info" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
