import React, { useState, useEffect, useCallback } from "react";
import { getWasmHashHistory, clearWasmHashHistory } from "../../lib/storage";
import { useStore } from "../../lib/store";
import { Hash, AlertTriangle, CheckCircle2, Clock, Shield, ExternalLink, Trash2, Filter, X } from "lucide-react";

function textInputStyle(hasError = false) {
  return {
    width: "100%",
    background: "var(--bg-elevated)",
    border: `1px solid ${hasError ? "var(--red)" : "var(--border-bright)"}`,
    borderRadius: "var(--radius-md)",
    padding: "8px 12px",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
    outline: "none",
    boxSizing: "border-box",
  };
}

function ActionButton({ label, onClick, disabled, tone = "primary" }) {
  const palette =
    tone === "secondary"
      ? {
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-bright)",
        }
      : tone === "danger"
      ? {
          background: "var(--bg-elevated)",
          color: "var(--red)",
          border: "1px solid var(--red)",
        }
      : {
          background: "var(--cyan)",
          color: "var(--bg-base)",
          border: "none",
        };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 14px",
        background: disabled ? "var(--bg-elevated)" : palette.background,
        color: disabled ? "var(--text-muted)" : palette.color,
        border: disabled ? "1px solid var(--border)" : palette.border,
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: "12px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "var(--transition)",
      }}
    >
      {label}
    </button>
  );
}

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

export default function WasmHashHistory() {
  const { network } = useStore();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    contractId: "",
    wasmHash: "",
  });
  const [expandedId, setExpandedId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Check for IndexedDB support
      if (typeof indexedDB === 'undefined') {
        console.warn("IndexedDB not supported in this environment");
        setHistory([]);
        return;
      }

      const data = await getWasmHashHistory({ ...filters, network });
      setHistory(data);
    } catch (error) {
      console.error("Failed to load WASM hash history:", error);
      // Handle quota exceeded errors
      if (error.name === 'QuotaExceededError') {
        console.error("Storage quota exceeded - consider clearing old history");
      }
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [filters, network]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClear = async () => {
    if (
      confirm(
        "Are you sure you want to clear the entire WASM hash history? This action cannot be undone."
      )
    ) {
      await clearWasmHashHistory();
      loadHistory();
    }
  };

  const handleExport = () => {
    if (history.length === 0) return;
    const jsonStr = JSON.stringify(history, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wasm_hash_history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAuthSeverity = (auth) => {
    if (!auth || auth === "none") return "safe";
    if (auth.includes("admin") || auth.includes("owner")) return "critical";
    if (auth.includes("multisig")) return "high";
    return "medium";
  };

  const getAuthLabel = (auth) => {
    if (!auth || auth === "none") return "No Auth";
    if (auth.includes("admin")) return "Admin Auth";
    if (auth.includes("owner")) return "Owner Auth";
    if (auth.includes("multisig")) return "Multisig";
    return "Custom Auth";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Hash size={16} />
            WASM Hash History
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <ActionButton
              label={showFilters ? "Hide Filters" : "Show Filters"}
              onClick={() => setShowFilters(!showFilters)}
              tone="secondary"
            />
            <ActionButton
              label="Export"
              onClick={handleExport}
              tone="secondary"
              disabled={history.length === 0}
            />
            <ActionButton
              label="Clear History"
              onClick={handleClear}
              tone="danger"
              disabled={history.length === 0}
            />
          </div>
        </div>

        {showFilters && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <input
                placeholder="Filter by Contract ID..."
                value={filters.contractId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, contractId: e.target.value }))
                }
                style={textInputStyle()}
              />
            </div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <input
                placeholder="Filter by WASM Hash..."
                value={filters.wasmHash}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, wasmHash: e.target.value }))
                }
                style={textInputStyle()}
              />
            </div>
            {(filters.contractId || filters.wasmHash) && (
              <ActionButton
                label="Clear Filters"
                onClick={() => setFilters({ contractId: "", wasmHash: "" })}
                tone="secondary"
              />
            )}
          </div>
        )}
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            Loading WASM hash history...
          </div>
        ) : history.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "13px",
            }}
          >
            No WASM hash records found. Contract upgrade transactions will be automatically tracked here.
          </div>
        ) : (
          <div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-elevated)",
                    borderBottom: "1px solid var(--border)",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>
                    Date
                  </th>
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>
                    Contract
                  </th>
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>
                    WASM Hash
                  </th>
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>
                    Auth
                  </th>
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>
                    Network
                  </th>
                  <th style={{ padding: "12px", textAlign: "right", color: "var(--text-muted)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <React.Fragment key={record.id}>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={12} style={{ color: "var(--text-muted)" }} />
                          {new Date(record.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        {record.contractId.slice(0, 8)}...
                        {record.contractId.slice(-4)}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Hash size={12} style={{ color: "var(--cyan)" }} />
                          {record.wasmHash.slice(0, 12)}...
                        </div>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <Badge
                          label={getAuthLabel(record.authorization)}
                          variant={getAuthSeverity(record.authorization)}
                        />
                      </td>
                      <td style={{ padding: "12px" }}>
                        <Badge label={record.network} variant="info" />
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <button
                          onClick={() =>
                            setExpandedId(expandedId === record.id ? null : record.id)
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--cyan)",
                            cursor: "pointer",
                            marginRight: "12px",
                            fontSize: "12px",
                          }}
                        >
                          {expandedId === record.id ? "Hide Details" : "View"}
                        </button>
                        {record.transactionHash && (
                          <a
                            href={`https://stellar.expert/explorer/${record.network}/tx/${record.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--text-primary)",
                              cursor: "pointer",
                              fontSize: "12px",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <ExternalLink size={12} />
                            Explorer
                          </a>
                        )}
                      </td>
                    </tr>
                    {expandedId === record.id && (
                      <tr
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: "var(--bg-elevated)",
                        }}
                      >
                        <td colSpan={6} style={{ padding: "16px" }}>
                          <div style={{ display: "grid", gap: "12px" }}>
                            <div>
                              <strong
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: "11px",
                                  textTransform: "uppercase",
                                }}
                              >
                                Contract ID
                              </strong>
                              <pre
                                style={{
                                  margin: "4px 0 0",
                                  padding: "10px",
                                  background: "var(--bg-base)",
                                  borderRadius: "4px",
                                  overflowX: "auto",
                                }}
                              >
                                {record.contractId}
                              </pre>
                            </div>
                            <div>
                              <strong
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: "11px",
                                  textTransform: "uppercase",
                                }}
                              >
                                WASM Hash
                              </strong>
                              <pre
                                style={{
                                  margin: "4px 0 0",
                                  padding: "10px",
                                  background: "var(--bg-base)",
                                  borderRadius: "4px",
                                  overflowX: "auto",
                                }}
                              >
                                {record.wasmHash}
                              </pre>
                            </div>
                            {record.transactionHash && (
                              <div>
                                <strong
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: "11px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Transaction Hash
                                </strong>
                                <pre
                                  style={{
                                    margin: "4px 0 0",
                                    padding: "10px",
                                    background: "var(--bg-base)",
                                    borderRadius: "4px",
                                    overflowX: "auto",
                                  }}
                                >
                                  {record.transactionHash}
                                </pre>
                              </div>
                            )}
                            <div>
                              <strong
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: "11px",
                                  textTransform: "uppercase",
                                }}
                              >
                                Authorization Requirements
                              </strong>
                              <div
                                style={{
                                  margin: "4px 0 0",
                                  padding: "10px",
                                  background: "var(--bg-base)",
                                  borderRadius: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <Shield size={14} style={{ color: "var(--cyan)" }} />
                                <span>{record.authorization || "No specific authorization requirements"}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
