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
  flattenTransaction,
  flattenBalance,
} from "../utils/export";
import { readFileAsText, parseBackup, validateBackupPayload, applyBackupToStore } from "../lib/import";

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
  exportTransactions: (transactions: ExportableRow[]) => void;
  exportBalances: (balances: ExportableRow[]) => void;
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

  const exportTransactions = useCallback((transactions: ExportableRow[]): void => {
    setIsExporting(true);
    setExportError(null);
    try {
      const rows = (transactions || []).map(flattenTransaction);
      exportCsv(rows, "stellar-transactions");
    } catch (err) {
      setExportError(err.message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportBalances = useCallback((balances: ExportableRow[]): void => {
    setIsExporting(true);
    setExportError(null);
    try {
      const rows = (balances || []).map(flattenBalance);
      exportCsv(rows, "stellar-balances");
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
