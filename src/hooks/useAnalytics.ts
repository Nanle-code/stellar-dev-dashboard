import { useMemo } from "react";
import { useStore } from "../lib/store";
import { buildAnalyticsSnapshot } from "../lib/analytics";

/**
 * Return value of the {@link useAnalytics} hook: the analytics snapshot
 * built from live store state.
 */
export type UseAnalyticsReturn = ReturnType<typeof buildAnalyticsSnapshot>;

export function useAnalytics(): UseAnalyticsReturn {
  const {
    accountData,
    transactions,
    operations,
    networkStats,
  } = useStore();

  return useMemo(() => {
    return buildAnalyticsSnapshot({
      accountData,
      transactions,
      operations,
      networkStats,
      recentLedgers: [],
    });
  }, [accountData, transactions, operations, networkStats]);
}

export default useAnalytics;
