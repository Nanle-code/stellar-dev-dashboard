import React, { useState, useEffect, useCallback } from "react";
import { getContractInteractions, clearContractInteractions } from "../../lib/storage";

function textInputStyle() {
  return {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-bright)",
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

export default function ContractHistory({ onReplay }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    contractId: "",
    functionName: "",
    type: "all",
    status: "all"
  });

  const ITEMS_PER_PAGE = 50;
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const data = await getContractInteractions(filters);
    setHistory(data);
    setLoading(false);
    setPage(1); // reset pagination when filters change
  }, [filters]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear the entire contract interaction history?")) {
      await clearContractInteractions();
      loadHistory();
    }
  };

  const exportJSON = () => {
    const jsonStr = JSON.stringify(history, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contract_history_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (history.length === 0) return;
    const headers = ["ID", "Timestamp", "Network", "Type", "Status", "Contract ID", "Function Name", "Source Account", "Args", "Error", "Result"];
    const rows = history.map(row => {
      return [
        row.id,
        new Date(row.timestamp).toISOString(),
        row.network,
        row.type,
        row.status,
        row.contractId,
        row.functionName,
        row.sourceAccount,
        JSON.stringify(row.args || []),
        row.error || "",
        JSON.stringify(row.result || {})
      ].map(field => {
        // Escape CSV values
        const str = String(field).replace(/"/g, '""');
        return `"${str}"`;
      }).join(",");
    });
    
    const csvStr = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvStr], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contract_history_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const paginatedHistory = history.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = paginatedHistory.length < history.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "14px" }}>
            Filters & Export
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <ActionButton label="Export JSON" onClick={exportJSON} tone="secondary" disabled={history.length === 0} />
            <ActionButton label="Export CSV" onClick={exportCSV} tone="secondary" disabled={history.length === 0} />
            <ActionButton label="Clear History" onClick={handleClear} tone="danger" disabled={history.length === 0} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            placeholder="Contract ID..."
            value={filters.contractId}
            onChange={(e) => setFilters(prev => ({ ...prev, contractId: e.target.value }))}
            style={textInputStyle()}
          />
          <input
            placeholder="Function Name..."
            value={filters.functionName}
            onChange={(e) => setFilters(prev => ({ ...prev, functionName: e.target.value }))}
            style={textInputStyle()}
          />
          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            style={textInputStyle()}
          >
            <option value="all">All Types</option>
            <option value="simulate">Simulate</option>
            <option value="invoke">Invoke</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            style={textInputStyle()}
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden"
      }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>Loading...</div>
        ) : paginatedHistory.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No contract interactions found.</div>
        ) : (
          <div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>Date</th>
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>Contract</th>
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>Function</th>
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>Type</th>
                  <th style={{ padding: "12px", color: "var(--text-muted)" }}>Status</th>
                  <th style={{ padding: "12px", textAlign: "right", color: "var(--text-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map(record => (
                  <React.Fragment key={record.id}>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px" }}>{new Date(record.timestamp).toLocaleString()}</td>
                      <td style={{ padding: "12px" }}>{record.contractId.slice(0, 6)}...{record.contractId.slice(-4)}</td>
                      <td style={{ padding: "12px" }}>{record.functionName}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: record.type === 'simulate' ? 'rgba(0, 255, 255, 0.1)' : 'rgba(255, 184, 0, 0.1)',
                          color: record.type === 'simulate' ? 'var(--cyan)' : 'var(--amber)'
                        }}>
                          {record.type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: record.status === 'success' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                          color: record.status === 'success' ? 'var(--green)' : 'var(--red)'
                        }}>
                          {record.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right" }}>
                        <button
                          onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                          style={{ background: "transparent", border: "none", color: "var(--cyan)", cursor: "pointer", marginRight: "12px", fontSize: "12px" }}
                        >
                          {expandedId === record.id ? "Hide Details" : "View"}
                        </button>
                        <button
                          onClick={() => onReplay(record)}
                          style={{ background: "transparent", border: "none", color: "var(--text-primary)", cursor: "pointer", fontSize: "12px" }}
                        >
                          Replay
                        </button>
                      </td>
                    </tr>
                    {expandedId === record.id && (
                      <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                        <td colSpan={6} style={{ padding: "16px" }}>
                          <div style={{ display: "grid", gap: "12px" }}>
                            <div>
                              <strong style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase" }}>Arguments</strong>
                              <pre style={{ margin: "4px 0 0", padding: "10px", background: "var(--bg-base)", borderRadius: "4px", overflowX: "auto" }}>
                                {JSON.stringify(record.args, null, 2)}
                              </pre>
                            </div>
                            {record.error ? (
                              <div>
                                <strong style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase" }}>Error</strong>
                                <pre style={{ margin: "4px 0 0", padding: "10px", background: "var(--bg-base)", borderRadius: "4px", color: "var(--red)", overflowX: "auto" }}>
                                  {record.error}
                                </pre>
                              </div>
                            ) : (
                              <div>
                                <strong style={{ color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase" }}>Result</strong>
                                <pre style={{ margin: "4px 0 0", padding: "10px", background: "var(--bg-base)", borderRadius: "4px", overflowX: "auto" }}>
                                  {JSON.stringify(record.result, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div style={{ padding: "16px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
                <ActionButton label="Load More" onClick={() => setPage(page + 1)} tone="secondary" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
