/**
 * useDataExport hook (#114).
 *
 * Provides export/import actions bound to the live Zustand store state.
 */

import { useCallback, useState } from "react";
import { useStore } from "../lib/store";
import {
  buildBackupPayload,
  exportJson,
  exportCsv,
  exportRowsJson,
  exportParquet,
  flattenTransaction,
  flattenBalance,
} from "../utils/export";
import { readFileAsText, parseBackup, validateBackupPayload, applyBackupToStore } from "../lib/import";

export type ExportFormat = "csv" | "json" | "parquet";

/**
 * A generic exportable row (transaction or balance record).
 */
export type ExportableRow = Record<string, unknown>;

/**
 * Return value of the {@link useDataExport} hook.
 */
export interface UseDataExportReturn {
  isExporting: boolean;
  isImporting: boolean;
  exportError: string | null;
  importError: string | null;
  importSuccess: boolean;
  exportDashboard: () => void;
  exportTransactions: (transactions: ExportableRow[], format?: ExportFormat) => Promise<void>;
  exportBalances: (balances: ExportableRow[], format?: ExportFormat) => Promise<void>;
  importBackup: (file: File) => Promise<void>;
}

/**
 * @returns Export/import actions bound to the live Zustand store state.
 */
export function useDataExport(): UseDataExportReturn {
  const store = useStore();
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);

  const exportDashboard = useCallback((): void => {
    setIsExporting(true);
    setExportError(null);
    try {
      const payload = buildBackupPayload(store);
      const slug = store.connectedAddress
        ? store.connectedAddress.slice(0, 6)
        : "dashboard";
      exportJson(payload, `stellar-${slug}-backup`);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  }, [store]);

  const exportTransactions = useCallback(async (transactions: ExportableRow[], format: ExportFormat = "csv"): Promise<void> => {
    setIsExporting(true);
    setExportError(null);
    try {
      const rows = (transactions || []).map(flattenTransaction);
      if (format === "csv") {
        exportCsv(rows, "stellar-transactions");
      } else if (format === "json") {
        exportRowsJson(rows, "stellar-transactions");
      } else if (format === "parquet") {
        await exportParquet(rows, "stellar-transactions");
      }
    } catch (err) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportBalances = useCallback(async (balances: ExportableRow[], format: ExportFormat = "csv"): Promise<void> => {
    setIsExporting(true);
    setExportError(null);
    try {
      const rows = (balances || []).map(flattenBalance);
      if (format === "csv") {
        exportCsv(rows, "stellar-balances");
      } else if (format === "json") {
        exportRowsJson(rows, "stellar-balances");
      } else if (format === "parquet") {
        await exportParquet(rows, "stellar-balances");
      }
    } catch (err) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const importBackup = useCallback(
    async (file: File): Promise<void> => {
      setIsImporting(true);
      setImportError(null);
      setImportSuccess(false);
      try {
        const text = await readFileAsText(file);
        const result = parseBackup(text);
        if (!result.ok) {
          setImportError(result.error);
          return;
        }
        const validationErrors = validateBackupPayload(result.data);
        if (validationErrors.length > 0) {
          setImportError(validationErrors.join(" "));
          return;
        }
        applyBackupToStore(result.data, store);
        setImportSuccess(true);
      } catch (err) {
        setImportError(err.message);
      } finally {
        setIsImporting(false);
      }
    },
    [store],
  );

  return {
    isExporting,
    isImporting,
    exportError,
    importError,
    importSuccess,
    exportDashboard,
    exportTransactions,
    exportBalances,
    importBackup,
  };
}
