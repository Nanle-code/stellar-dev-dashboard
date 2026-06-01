import { useCallback, useState } from 'react';
import { useStore } from '../lib/store';
import {
  buildBackupPayload,
  exportJson,
  exportCsv,
  flattenTransaction,
  flattenBalance,
} from '../utils/export';
import { readFileAsText, parseBackup, validateBackupPayload, applyBackupToStore } from '../lib/import';

export interface UseDataExportReturn {
  isExporting: boolean;
  isImporting: boolean;
  exportError: string | null;
  importError: string | null;
  importSuccess: boolean;
  exportDashboard: () => void;
  exportTransactions: (transactions: Record<string, unknown>[]) => void;
  exportBalances: (balances: Record<string, unknown>[]) => void;
  importBackup: (file: File) => Promise<void>;
}

export function useDataExport(): UseDataExportReturn {
  const store = useStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const exportDashboard = useCallback(() => {
    setIsExporting(true);
    setExportError(null);
    try {
      const payload = buildBackupPayload(store);
      const slug = store.connectedAddress ? store.connectedAddress.slice(0, 6) : 'dashboard';
      exportJson(payload, `stellar-${slug}-backup`);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, [store]);

  const exportTransactions = useCallback((transactions: Record<string, unknown>[]) => {
    setIsExporting(true);
    setExportError(null);
    try {
      exportCsv((transactions ?? []).map(flattenTransaction), 'stellar-transactions');
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportBalances = useCallback((balances: Record<string, unknown>[]) => {
    setIsExporting(true);
    setExportError(null);
    try {
      exportCsv((balances ?? []).map(flattenBalance), 'stellar-balances');
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const importBackup = useCallback(
    async (file: File) => {
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
          setImportError(validationErrors.join(' '));
          return;
        }
        applyBackupToStore(result.data, store);
        setImportSuccess(true);
      } catch (err) {
        setImportError((err as Error).message);
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
