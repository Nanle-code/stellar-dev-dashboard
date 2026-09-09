import { useMemo } from "react";
import { useStore } from "../lib/store";
import { buildAnalyticsSnapshot } from "../lib/analytics";

export function useAnalytics() {
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
