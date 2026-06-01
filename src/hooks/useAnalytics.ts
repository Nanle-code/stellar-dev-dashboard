import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { buildAnalyticsSnapshot } from '../lib/analytics';

export interface AnalyticsSnapshot {
  account: Record<string, unknown>;
  transactions: Record<string, unknown>;
  network: Record<string, unknown>;
  activity: unknown[];
  risks: Record<string, unknown>;
  generatedAt: string;
}

export function useAnalytics(): AnalyticsSnapshot {
  const { accountData, transactions, operations, networkStats } = useStore();

  return useMemo(
    () =>
      buildAnalyticsSnapshot({
        accountData,
        transactions,
        operations,
        networkStats,
        recentLedgers: [],
      }),
    [accountData, transactions, operations, networkStats],
  );
}

export default useAnalytics;
