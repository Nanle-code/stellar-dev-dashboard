import type { Horizon } from '@stellar/stellar-sdk'

export interface Insight {
  id: string
  type: 'trend' | 'outlier' | 'summary'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

export interface AnalyticsSummary {
  insights: Insight[]
  stats: {
    totalTransactions: number
    totalOperations: number
    avgFee: number
    successRate: number
  }
}

/**
 * Calculates a standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0
  const squareDiffs = values.map((value) => {
    const diff = value - mean
    return diff * diff
  })
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(avgSquareDiff)
}

/**
 * Generates natural language insights based on transaction and operations data
 */
export function generateInsights(
  transactions: Horizon.ServerApi.TransactionRecord[],
  operations: Horizon.ServerApi.OperationRecord[]
): AnalyticsSummary {
  const insights: Insight[] = []
  
  if (!transactions.length) {
    return {
      insights: [{
        id: 'no-data',
        type: 'summary',
        title: 'No Data Available',
        description: 'Insufficient data to generate meaningful insights at this time.',
        severity: 'low'
      }],
      stats: { totalTransactions: 0, totalOperations: 0, avgFee: 0, successRate: 0 }
    }
  }

  // Basic Stats
  const successfulTxs = transactions.filter(t => t.successful).length
  const successRate = (successfulTxs / transactions.length) * 100
  const fees = transactions.map(t => parseInt(t.fee_charged, 10)).filter(f => !isNaN(f))
  const avgFee = fees.length ? fees.reduce((a, b) => a + b, 0) / fees.length : 0

  const summaryStats = {
    totalTransactions: transactions.length,
    totalOperations: operations.length,
    avgFee: Math.round(avgFee),
    successRate: Math.round(successRate * 10) / 10
  }

  // 1. Success Rate Insight
  if (successRate < 80) {
    insights.push({
      id: 'low-success',
      type: 'trend',
      title: 'Elevated Failure Rate',
      description: `Your transaction success rate has dropped to ${summaryStats.successRate}%. Review recent failed transactions for potential network or fee issues.`,
      severity: 'high'
    })
  } else if (successRate === 100) {
    insights.push({
      id: 'perfect-success',
      type: 'summary',
      title: 'Perfect Execution',
      description: '100% of your recent transactions were successful. Your current fee strategy is highly effective.',
      severity: 'low'
    })
  }

  // 2. Fee Outliers
  if (fees.length > 5) {
    const stdDevFee = calculateStdDev(fees, avgFee)
    const highFeeThreshold = avgFee + (stdDevFee * 2)
    
    const outliers = transactions.filter(t => parseInt(t.fee_charged, 10) > highFeeThreshold)
    if (outliers.length > 0) {
      insights.push({
        id: 'fee-outlier',
        type: 'outlier',
        title: 'Spike in Transaction Fees',
        description: `We detected ${outliers.length} transaction(s) with unusually high fees (>$${Math.round(highFeeThreshold)} stroops). This might indicate sudden network congestion.`,
        severity: 'medium'
      })
    }
  }

  // 3. Operation Trends (detecting specific patterns)
  const operationTypes = operations.reduce((acc, op) => {
    acc[op.type] = (acc[op.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topOperation = Object.entries(operationTypes).sort((a, b) => b[1] - a[1])[0]
  if (topOperation) {
    const percentage = Math.round((topOperation[1] / operations.length) * 100)
    if (percentage > 50) {
      insights.push({
        id: 'dominant-operation',
        type: 'trend',
        title: 'Dominant Activity Pattern',
        description: `The majority of your recent activity (${percentage}%) consists of '${topOperation[0]}' operations.`,
        severity: 'low'
      })
    }
  }

  // Prioritize high severity
  insights.sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 }
    return order[b.severity] - order[a.severity]
  })

  return {
    insights,
    stats: summaryStats
  }
}

// ─── Snapshot helpers ──────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

function toNumber(value: string | number | undefined | null, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function summarizeBalances(accountData: Horizon.ServerApi.AccountRecord | null) {
  const balances = accountData?.balances || []
  const native = balances.find((balance) => balance.asset_type === 'native')
  const nonNative = balances.filter((balance) => balance.asset_type !== 'native')

  return {
    xlmBalance: toNumber(native?.balance),
    trustlineCount: nonNative.length,
    totalAssets: balances.length,
    nonNativeBalanceCount: nonNative.reduce((sum, balance) => {
      return sum + (toNumber(balance.balance) > 0 ? 1 : 0)
    }, 0),
  }
}

export function summarizeTransactions(
  transactions: Horizon.ServerApi.TransactionRecord[] = [],
  operations: Horizon.ServerApi.OperationRecord[] = []
) {
  const sortedTx = [...transactions].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  const recent7d = Date.now() - 7 * DAY_MS

  const successful = sortedTx.filter((tx) => tx.successful).length
  const failed = sortedTx.length - successful
  const txInLastWeek = sortedTx.filter((tx) => {
    return new Date(tx.created_at).getTime() >= recent7d
  }).length

  const opTypeCounts = operations.reduce(
    (acc, op) => {
      const type = op.type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return {
    totalTransactions: sortedTx.length,
    successfulTransactions: successful,
    failedTransactions: failed,
    successRate: sortedTx.length ? successful / sortedTx.length : 0,
    weeklyActivity: txInLastWeek,
    averageOperationsPerTx: sortedTx.length ? operations.length / sortedTx.length : 0,
    opTypeCounts,
  }
}

export function buildActivityTimeseries(
  transactions: Horizon.ServerApi.TransactionRecord[] = [],
  days = 14
) {
  const now = Date.now()
  const start = now - (days - 1) * DAY_MS
  const map = new Map<string, {
    date: string
    transactions: number
    failedTxs: number
    fees: number
    successRate: number
    averageFee: number
  }>()

  for (let i = 0; i < days; i += 1) {
    const stamp = new Date(start + i * DAY_MS).toISOString().slice(0, 10)
    map.set(stamp, { date: stamp, transactions: 0, failedTxs: 0, fees: 0, successRate: 0, averageFee: 0 })
  }

  transactions.forEach((tx) => {
    const stamp = new Date(tx.created_at).toISOString().slice(0, 10)
    const bucket = map.get(stamp)
    if (!bucket) return
    bucket.transactions += 1
    if (!tx.successful) bucket.failedTxs += 1
    bucket.fees += toNumber(tx.fee_charged)
  })

  const values = Array.from(map.values()).map((bucket) => {
    bucket.successRate = bucket.transactions > 0 ? (bucket.transactions - bucket.failedTxs) / bucket.transactions : 1
    bucket.averageFee = bucket.transactions > 0 ? bucket.fees / bucket.transactions : 0
    return bucket
  })

  return values
}

export function computeAverageCloseTime(ledgers: Horizon.ServerApi.LedgerRecord[] = []) {
  if (ledgers.length < 2) return 0

  const sorted = [...ledgers].sort((a, b) => {
    return new Date(a.closed_at).getTime() - new Date(b.closed_at).getTime()
  })

  const diffs: number[] = []
  for (let i = 1; i < sorted.length; i += 1) {
    const curr = new Date(sorted[i].closed_at).getTime()
    const prev = new Date(sorted[i - 1].closed_at).getTime()
    const diffSec = (curr - prev) / 1000
    if (Number.isFinite(diffSec) && diffSec >= 0) {
      diffs.push(diffSec)
    }
  }

  if (!diffs.length) return 0
  return diffs.reduce((sum, n) => sum + n, 0) / diffs.length
}

export function summarizeNetwork(
  networkStats: { latestLedger?: Partial<Horizon.ServerApi.LedgerRecord> | null; feeStats?: { last_ledger_base_fee?: string; p90_accepted_fee?: string } | null } | null,
  recentLedgers: Horizon.ServerApi.LedgerRecord[] = []
) {
  const latestLedger = networkStats?.latestLedger || recentLedgers[0]
  const feeStats = networkStats?.feeStats

  return {
    latestLedgerSequence: (latestLedger as Horizon.ServerApi.LedgerRecord)?.sequence || null,
    baseFee: toNumber(feeStats?.last_ledger_base_fee),
    p90Fee: toNumber(feeStats?.p90_accepted_fee),
    txSuccessCount: toNumber((latestLedger as Horizon.ServerApi.LedgerRecord)?.successful_transaction_count),
    txFailedCount: toNumber((latestLedger as Horizon.ServerApi.LedgerRecord)?.failed_transaction_count),
    operationCount: toNumber((latestLedger as Horizon.ServerApi.LedgerRecord)?.operation_count),
    averageCloseSeconds: computeAverageCloseTime(recentLedgers),
  }
}

export function calculateRiskSignals(
  accountData: Horizon.ServerApi.AccountRecord | null,
  transactions: Horizon.ServerApi.TransactionRecord[] = []
) {
  const thresholds = accountData?.thresholds || ({} as Horizon.ServerApi.AccountRecord['thresholds'])
  const signers = accountData?.signers || []
  const flags = accountData?.flags || ({} as Horizon.ServerApi.AccountRecord['flags'])
  const mergedOps = transactions.filter((tx) => !tx.successful).length

  const signals = [
    {
      id: 'high-failed-rate',
      label: 'High failed transaction count',
      active: mergedOps > 5,
      severity: 'medium' as const,
    },
    {
      id: 'master-single-point',
      label: 'Single signer controls high threshold',
      active:
        signers.length <= 1 &&
        toNumber((thresholds as Record<string, string | undefined>).high_threshold || (thresholds as Record<string, string | undefined>).high) > 0,
      severity: 'high' as const,
    },
    {
      id: 'auth-revocable',
      label: 'Account has revocable authorization flag',
      active: Boolean((flags as Record<string, boolean | undefined>).auth_revocable),
      severity: 'low' as const,
    },
  ]

  return signals
}

export function buildAnalyticsSnapshot({
  accountData,
  transactions,
  operations,
  networkStats,
  recentLedgers = [],
}: {
  accountData: Horizon.ServerApi.AccountRecord | null
  transactions: Horizon.ServerApi.TransactionRecord[]
  operations: Horizon.ServerApi.OperationRecord[]
  networkStats: { latestLedger?: Partial<Horizon.ServerApi.LedgerRecord> | null; feeStats?: { last_ledger_base_fee?: string; p90_accepted_fee?: string } | null } | null
  recentLedgers: Horizon.ServerApi.LedgerRecord[]
}) {
  return {
    account: summarizeBalances(accountData),
    transactions: summarizeTransactions(transactions, operations),
    network: summarizeNetwork(networkStats, recentLedgers),
    activity: buildActivityTimeseries(transactions),
    risks: calculateRiskSignals(accountData, transactions),
    generatedAt: new Date().toISOString(),
  }
}
