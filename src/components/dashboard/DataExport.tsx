import React, { useRef, useState, type ReactNode } from "react";
import { useDataExport, type ExportFormat } from "../../hooks/useDataExport";
import { useStore } from "../../lib/store";

interface ActionButtonProps {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  variant?: "primary" | "secondary"
}

interface StatusMessageProps {
  error?: string | null
  success?: boolean
}

function ActionButton({ onClick, disabled, children, variant = "primary" }: ActionButtonProps) {
  const base: React.CSSProperties = {
    padding: "9px 18px",
    borderRadius: "var(--radius-md)",
    fontSize: "12px",
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    border: "none",
    transition: "var(--transition)",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  };
  const styles: React.CSSProperties =
    variant === "primary"
      ? { ...base, background: "var(--cyan)", color: "#000" }
      : { ...base, background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-bright)" };
  return (
    <button type="button" style={styles} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function StatusMessage({ error, success }: StatusMessageProps) {
  if (!error && !success) return null;
  return (
    <div
      role="alert"
      style={{
        marginTop: "10px",
        padding: "8px 12px",
        borderRadius: "var(--radius-md)",
        fontSize: "12px",
        background: error ? "var(--red-glow)" : "var(--green-glow)",
        border: `1px solid ${error ? "var(--red)" : "var(--green)"}`,
        color: error ? "var(--red)" : "var(--green)",
      }}
    >
      {error || "Import successful. Settings have been restored."}
    </div>
  );
}

export default function DataExport() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const { transactions, account } = useStore();
  const {
    isExporting,
    isImporting,
    exportError,
    importError,
    importSuccess,
    exportDashboard,
    exportTransactions,
    exportBalances,
    importBackup,
  } = useDataExport();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importBackup(file);
      e.target.value = "";
    }
  };

  const balances = account?.balances ?? [];
  const txList = transactions ?? [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "4px",
      }}
    >
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
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          Export Data
        </div>
        <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            Download your dashboard settings and account data as files you can
            restore later or open in a spreadsheet.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px", marginBottom: "10px" }}>
            <label htmlFor="exportFormatSelect" style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 600 }}>Format:</label>
            <select
              id="exportFormatSelect"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                fontSize: "12px",
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="parquet">Parquet</option>
            </select>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <ActionButton onClick={exportDashboard} disabled={isExporting}>
              ⬇ Export Dashboard Backup (JSON)
            </ActionButton>
            <ActionButton
              onClick={() => exportTransactions(txList, exportFormat)}
              disabled={isExporting || txList.length === 0}
              variant="secondary"
            >
              ⬇ Export Transactions
            </ActionButton>
            <ActionButton
              onClick={() => exportBalances(balances, exportFormat)}
              disabled={isExporting || balances.length === 0}
              variant="secondary"
            >
              ⬇ Export Balances
            </ActionButton>
          </div>
          {exportError && (
            <StatusMessage error={exportError} />
          )}
        </div>
      </div>

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
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          Import Backup
        </div>
        <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            Restore a previously exported dashboard backup JSON file. Your
            current network selection and theme will be updated.
          </p>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={handleFileChange}
              aria-label="Select backup JSON file to import"
            />
            <ActionButton
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              variant="secondary"
            >
              {isImporting ? "⏳ Importing…" : "⬆ Choose Backup File"}
            </ActionButton>
          </div>
          <StatusMessage error={importError} success={importSuccess} />
        </div>
      </div>
    </div>
  );
}
