const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function summarizeBalances(accountData) {
  const balances = accountData?.balances || [];
  const native = balances.find((balance) => balance.asset_type === "native");
  const nonNative = balances.filter((balance) => balance.asset_type !== "native");

  return {
    xlmBalance: toNumber(native?.balance),
    trustlineCount: nonNative.length,
    totalAssets: balances.length,
    nonNativeBalanceCount: nonNative.reduce((sum, balance) => {
      return sum + (toNumber(balance.balance) > 0 ? 1 : 0);
    }, 0),
  };
}

export function summarizeTransactions(transactions = [], operations = []) {
  const sortedTx = [...transactions].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const recent7d = Date.now() - 7 * DAY_MS;

  const successful = sortedTx.filter((tx) => tx.successful).length;
  const failed = sortedTx.length - successful;
  const txInLastWeek = sortedTx.filter((tx) => {
    return new Date(tx.created_at).getTime() >= recent7d;
  }).length;

  const opTypeCounts = operations.reduce((acc, op) => {
    const type = op.type || "unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return {
    totalTransactions: sortedTx.length,
    successfulTransactions: successful,
    failedTransactions: failed,
    successRate: sortedTx.length ? successful / sortedTx.length : 0,
    weeklyActivity: txInLastWeek,
    averageOperationsPerTx: sortedTx.length
      ? operations.length / sortedTx.length
      : 0,
    opTypeCounts,
  };
}

export function buildActivityTimeseries(transactions = [], days = 14) {
  const now = Date.now();
  const start = now - (days - 1) * DAY_MS;
  const map = new Map();

  for (let i = 0; i < days; i += 1) {
    const stamp = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    map.set(stamp, { date: stamp, transactions: 0, fees: 0 });
  }

  transactions.forEach((tx) => {
    const stamp = new Date(tx.created_at).toISOString().slice(0, 10);
    const bucket = map.get(stamp);
    if (!bucket) return;
    bucket.transactions += 1;
    bucket.fees += toNumber(tx.fee_charged);
  });

  return Array.from(map.values());
}

export function summarizeNetwork(networkStats, recentLedgers = []) {
  const latestLedger = networkStats?.latestLedger || recentLedgers[0];
  const feeStats = networkStats?.feeStats;
  const averageCloseSeconds = computeAverageCloseTime(recentLedgers);

  return {
    latestLedgerSequence: latestLedger?.sequence || null,
    baseFee: toNumber(feeStats?.last_ledger_base_fee),
    p90Fee: toNumber(feeStats?.p90_accepted_fee),
    txSuccessCount: toNumber(latestLedger?.successful_transaction_count),
    txFailedCount: toNumber(latestLedger?.failed_transaction_count),
    operationCount: toNumber(latestLedger?.operation_count),
    averageCloseSeconds,
  };
}

export function computeAverageCloseTime(ledgers = []) {
  if (ledgers.length < 2) return 0;

  const sorted = [...ledgers].sort((a, b) => {
    return new Date(a.closed_at).getTime() - new Date(b.closed_at).getTime();
  });

  const diffs = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const curr = new Date(sorted[i].closed_at).getTime();
    const prev = new Date(sorted[i - 1].closed_at).getTime();
    const diffSec = (curr - prev) / 1000;
    if (Number.isFinite(diffSec) && diffSec >= 0) {
      diffs.push(diffSec);
    }
  }

  if (!diffs.length) return 0;
  return diffs.reduce((sum, n) => sum + n, 0) / diffs.length;
}

export function calculateRiskSignals(accountData, transactions = []) {
  const thresholds = accountData?.thresholds || {};
  const signers = accountData?.signers || [];
  const flags = accountData?.flags || {};
  const mergedOps = transactions.filter((tx) => !tx.successful).length;

  const signals = [
    {
      id: "high-failed-rate",
      label: "High failed transaction count",
      active: mergedOps > 5,
      severity: "medium",
    },
    {
      id: "master-single-point",
      label: "Single signer controls high threshold",
      active:
        signers.length <= 1 &&
        toNumber(thresholds.high_threshold || thresholds.high) > 0,
      severity: "high",
    },
    {
      id: "auth-revocable",
      label: "Account has revocable authorization flag",
      active: Boolean(flags.auth_revocable),
      severity: "low",
    },
  ];

  return signals;
}

export function buildAnalyticsSnapshot({
  accountData,
  transactions,
  operations,
  networkStats,
  recentLedgers = [],
}) {
  return {
    account: summarizeBalances(accountData),
    transactions: summarizeTransactions(transactions, operations),
    network: summarizeNetwork(networkStats, recentLedgers),
    activity: buildActivityTimeseries(transactions),
    risks: calculateRiskSignals(accountData, transactions),
    generatedAt: new Date().toISOString(),
  };
}
