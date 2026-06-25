/**
 * transactionPatternAnalysis.ts
 * D-005: AI-powered transaction pattern analysis engine.
 *
 * All analysis runs client-side using statistical / heuristic methods so that
 * no external AI API key is required.  The functions produce human-readable
 * insight strings that the UI can render directly.
 */

import * as tf from '@tensorflow/tfjs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StellarTransaction {
  id: string
  hash: string
  created_at: string
  fee_charged: string | number
  operation_count: number | string
  successful: boolean
  memo?: string
  memo_type?: string
  source_account?: string
}

export interface StellarOperation {
  id: string
  type: string
  created_at: string
  amount?: string | number
  asset_code?: string
  from?: string
  to?: string
  source_account?: string
  transaction_hash?: string
}

export type PatternSeverity = 'info' | 'warning' | 'critical'

export interface DetectedPattern {
  id: string
  title: string
  description: string
  severity: PatternSeverity
  confidence: number // 0-1
  affectedTxCount: number
  recommendation: string
  category: PatternCategory
}

export type PatternCategory =
  | 'frequency'
  | 'fee'
  | 'amount'
  | 'failure'
  | 'timing'
  | 'counterparty'
  | 'asset'
  | 'anomaly'

export interface HourlyBucket {
  hour: number // 0-23
  label: string
  count: number
}

export interface PeakActivity {
  hour: number
  label: string
  count: number
  percentage: number
}

export interface TransactionCluster {
  label: string
  count: number
  percentage: number
  avgFee: number
  successRate: number
}

export interface CounterpartyInsight {
  address: string
  txCount: number
  totalAmount: number
  assetCodes: string[]
  firstSeen: string
  lastSeen: string
  relationshipScore: number // 0-100
}

export interface FeeIntelligence {
  avgFee: number
  medianFee: number
  p90Fee: number
  recommendation: string
  overpayingPct: number // percentage of txs paying more than 2x p50
  savingsEstimate: number // stroops that could be saved
}

export interface AnomalyScore {
  score: number // 0-100; higher = more anomalous
  label: string
  color: string
}

export interface PatternAnalysisResult {
  patterns: DetectedPattern[]
  hourlyActivity: HourlyBucket[]
  peakActivity: PeakActivity | null
  clusters: TransactionCluster[]
  topCounterparties: CounterpartyInsight[]
  feeIntelligence: FeeIntelligence
  anomalyScore: AnomalyScore
  operationMix: { type: string; count: number; percentage: number }[]
  insights: string[] // high-level natural-language summary bullets
  analyzedAt: string
  txCount: number
  opCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toNum = (v: string | number | undefined, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const percentile = (sorted: number[], p: number): number => {
  if (!sorted.length) return 0
  const idx = Math.floor((p / 100) * (sorted.length - 1))
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

const median = (sorted: number[]): number => percentile(sorted, 50)

const stdDev = (values: number[], mean: number): number => {
  if (values.length < 2) return 0
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

const HOUR_LABELS = [
  '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM',
  '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM',
  '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM',
  '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM',
]

// ---------------------------------------------------------------------------
// Hourly activity
// ---------------------------------------------------------------------------

export function buildHourlyActivity(transactions: StellarTransaction[]): HourlyBucket[] {
  const buckets: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: HOUR_LABELS[h],
    count: 0,
  }))

  for (const tx of transactions) {
    const d = new Date(tx.created_at)
    if (!isNaN(d.getTime())) {
      buckets[d.getUTCHours()].count += 1
    }
  }

  return buckets
}

// ---------------------------------------------------------------------------
// Peak activity
// ---------------------------------------------------------------------------

export function findPeakActivity(hourly: HourlyBucket[], total: number): PeakActivity | null {
  if (!total) return null
  const peak = hourly.reduce((max, b) => (b.count > max.count ? b : max), hourly[0])
  return {
    hour: peak.hour,
    label: peak.label,
    count: peak.count,
    percentage: total > 0 ? Math.round((peak.count / total) * 100) : 0,
  }
}

// ---------------------------------------------------------------------------
// Operation mix
// ---------------------------------------------------------------------------

export function buildOperationMix(
  operations: StellarOperation[]
): { type: string; count: number; percentage: number }[] {
  const counts: Record<string, number> = {}
  for (const op of operations) {
    const t = op.type || 'unknown'
    counts[t] = (counts[t] || 0) + 1
  }
  const total = operations.length || 1
  return Object.entries(counts)
    .map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Fee intelligence
// ---------------------------------------------------------------------------

export function analyzeFees(transactions: StellarTransaction[]): FeeIntelligence {
  const fees = transactions
    .map((tx) => toNum(tx.fee_charged))
    .filter((f) => f > 0)
    .sort((a, b) => a - b)

  if (!fees.length) {
    return {
      avgFee: 0,
      medianFee: 100,
      p90Fee: 100,
      recommendation: 'No fee data available yet.',
      overpayingPct: 0,
      savingsEstimate: 0,
    }
  }

  const avg = fees.reduce((s, f) => s + f, 0) / fees.length
  const med = median(fees)
  const p90 = percentile(fees, 90)
  const overpaying = fees.filter((f) => f > med * 2).length
  const overpayingPct = Math.round((overpaying / fees.length) * 100)
  const savingsEstimate = fees
    .filter((f) => f > med * 2)
    .reduce((sum, f) => sum + (f - med * 2), 0)

  let recommendation = 'Your fees look healthy — close to the network median.'
  if (overpayingPct > 40) {
    recommendation = `~${overpayingPct}% of transactions paid 2× the median fee. Consider using the fee oracle for dynamic fee selection.`
  } else if (overpayingPct > 20) {
    recommendation = `~${overpayingPct}% of transactions overpaid fees. Minor optimisation possible.`
  }

  return {
    avgFee: Math.round(avg),
    medianFee: med,
    p90Fee: p90,
    recommendation,
    overpayingPct,
    savingsEstimate: Math.round(savingsEstimate),
  }
}

// ---------------------------------------------------------------------------
// Top counterparties
// ---------------------------------------------------------------------------

export function findTopCounterparties(
  operations: StellarOperation[],
  selfAddress: string,
  limit = 8
): CounterpartyInsight[] {
  const map: Record<
    string,
    {
      txCount: number
      totalAmount: number
      assetCodes: Set<string>
      timestamps: number[]
    }
  > = {}

  for (const op of operations) {
    const counterparty =
      op.from === selfAddress ? op.to :
      op.to === selfAddress ? op.from :
      null
    if (!counterparty || counterparty === selfAddress) continue

    if (!map[counterparty]) {
      map[counterparty] = { txCount: 0, totalAmount: 0, assetCodes: new Set(), timestamps: [] }
    }
    const entry = map[counterparty]
    entry.txCount += 1
    entry.totalAmount += toNum(op.amount)
    if (op.asset_code) entry.assetCodes.add(op.asset_code)
    const ts = new Date(op.created_at).getTime()
    if (!isNaN(ts)) entry.timestamps.push(ts)
  }

  return Object.entries(map)
    .map(([address, data]) => {
      const sorted = data.timestamps.sort((a, b) => a - b)
      const relationshipScore = Math.min(100, Math.round(data.txCount * 10 + data.assetCodes.size * 5))
      return {
        address,
        txCount: data.txCount,
        totalAmount: data.totalAmount,
        assetCodes: Array.from(data.assetCodes),
        firstSeen: sorted.length ? new Date(sorted[0]).toISOString().slice(0, 10) : '—',
        lastSeen: sorted.length ? new Date(sorted[sorted.length - 1]).toISOString().slice(0, 10) : '—',
        relationshipScore,
      }
    })
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Transaction clusters
// ---------------------------------------------------------------------------

export function clusterTransactions(transactions: StellarTransaction[]): TransactionCluster[] {
  const clusters: Record<string, StellarTransaction[]> = {
    'Single-op': [],
    'Multi-op': [],
    'Memo-tagged': [],
    'Failed': [],
  }

  for (const tx of transactions) {
    if (!tx.successful) {
      clusters['Failed'].push(tx)
    } else if (tx.memo && tx.memo.trim()) {
      clusters['Memo-tagged'].push(tx)
    } else if (toNum(tx.operation_count) > 1) {
      clusters['Multi-op'].push(tx)
    } else {
      clusters['Single-op'].push(tx)
    }
  }

  const total = transactions.length || 1
  return Object.entries(clusters)
    .filter(([, txs]) => txs.length > 0)
    .map(([label, txs]) => {
      const fees = txs.map((tx) => toNum(tx.fee_charged)).filter((f) => f > 0)
      const avgFee = fees.length ? fees.reduce((s, f) => s + f, 0) / fees.length : 0
      const successful = txs.filter((tx) => tx.successful).length
      return {
        label,
        count: txs.length,
        percentage: Math.round((txs.length / total) * 100),
        avgFee: Math.round(avgFee),
        successRate: txs.length > 0 ? Math.round((successful / txs.length) * 100) : 0,
      }
    })
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Anomaly scoring
// ---------------------------------------------------------------------------

export function computeAnomalyScore(
  transactions: StellarTransaction[],
  operations: StellarOperation[]
): AnomalyScore {
  if (!transactions.length) return { score: 0, label: 'Insufficient data', color: 'var(--text-muted)' }

  let score = 0

  // High failure rate
  const failRate = transactions.filter((tx) => !tx.successful).length / transactions.length
  if (failRate > 0.3) score += 30
  else if (failRate > 0.1) score += 15

  // Fee spikes
  const fees = transactions.map((tx) => toNum(tx.fee_charged)).filter((f) => f > 0).sort((a, b) => a - b)
  if (fees.length >= 3) {
    const med = median(fees)
    const max = fees[fees.length - 1]
    if (max > med * 20) score += 20
    else if (max > med * 10) score += 10
  }

  // Burst of transactions (many in a single hour)
  const hourCounts: Record<number, number> = {}
  for (const tx of transactions) {
    const d = new Date(tx.created_at)
    if (!isNaN(d.getTime())) {
      const h = d.getUTCHours()
      hourCounts[h] = (hourCounts[h] || 0) + 1
    }
  }
  const maxHour = Math.max(...Object.values(hourCounts), 0)
  const avgHour = transactions.length / 24
  if (maxHour > avgHour * 5 && maxHour > 10) score += 20
  else if (maxHour > avgHour * 3) score += 10

  // Unusual op diversity
  const opTypes = new Set(operations.map((op) => op.type))
  if (opTypes.size > 8) score += 10
  else if (opTypes.size > 5) score += 5

  // Many unique counterparties relative to tx count
  const counterparties = new Set(
    operations.filter((op) => op.to).map((op) => op.to)
  )
  const cpRatio = counterparties.size / Math.max(transactions.length, 1)
  if (cpRatio > 0.9) score += 10
  else if (cpRatio > 0.7) score += 5

  score = Math.min(100, Math.round(score))

  let label = 'Normal'
  let color = 'var(--green)'
  if (score >= 60) {
    label = 'High Anomaly'
    color = 'var(--red)'
  } else if (score >= 35) {
    label = 'Moderate Anomaly'
    color = 'var(--amber)'
  } else if (score >= 15) {
    label = 'Low Anomaly'
    color = 'var(--cyan)'
  }

  return { score, label, color }
}

// ---------------------------------------------------------------------------
// Pattern detection
// ---------------------------------------------------------------------------

export function detectPatterns(
  transactions: StellarTransaction[],
  operations: StellarOperation[],
  hourly: HourlyBucket[]
): DetectedPattern[] {
  const patterns: DetectedPattern[] = []
  if (!transactions.length) return patterns

  const fees = transactions.map((tx) => toNum(tx.fee_charged)).filter((f) => f > 0).sort((a, b) => a - b)
  const failedTxs = transactions.filter((tx) => !tx.successful)
  const failRate = failedTxs.length / transactions.length

  // --- Failure rate ---
  if (failRate > 0.3) {
    patterns.push({
      id: 'high-failure-rate',
      title: 'High Transaction Failure Rate',
      description: `${Math.round(failRate * 100)}% of your transactions are failing. This is significantly above the healthy threshold of 5%.`,
      severity: 'critical',
      confidence: 0.95,
      affectedTxCount: failedTxs.length,
      recommendation: 'Review transaction parameters, fee settings, and sequence numbers. Check for insufficient balance or expired time bounds.',
      category: 'failure',
    })
  } else if (failRate > 0.1) {
    patterns.push({
      id: 'elevated-failure-rate',
      title: 'Elevated Transaction Failure Rate',
      description: `${Math.round(failRate * 100)}% of transactions have failed — slightly above the normal baseline.`,
      severity: 'warning',
      confidence: 0.85,
      affectedTxCount: failedTxs.length,
      recommendation: 'Inspect failed transactions for common error codes such as tx_insufficient_fee or op_no_destination.',
      category: 'failure',
    })
  }

  // --- Fee spikes ---
  if (fees.length >= 5) {
    const med = median(fees)
    const mean = fees.reduce((s, f) => s + f, 0) / fees.length
    const sd = stdDev(fees, mean)
    const spikes = fees.filter((f) => f > mean + 3 * sd)
    if (spikes.length > 0) {
      patterns.push({
        id: 'fee-spikes',
        title: 'Fee Spike Detected',
        description: `${spikes.length} transaction(s) paid fees more than 3 standard deviations above the mean (${Math.round(med)} stroops).`,
        severity: spikes.length > 3 ? 'warning' : 'info',
        confidence: 0.9,
        affectedTxCount: spikes.length,
        recommendation: 'Use the fee oracle to select optimal fees before submitting high-value transactions.',
        category: 'fee',
      })
    }
  }

  // --- Night-time activity ---
  const nightCount = hourly.slice(0, 6).reduce((s, b) => s + b.count, 0)
  const nightRate = nightCount / Math.max(transactions.length, 1)
  if (nightRate > 0.5 && transactions.length > 5) {
    patterns.push({
      id: 'night-activity',
      title: 'Unusual Night-Time Activity',
      description: `${Math.round(nightRate * 100)}% of transactions occur between midnight and 6 AM UTC — unusual for typical user accounts.`,
      severity: 'warning',
      confidence: 0.75,
      affectedTxCount: nightCount,
      recommendation: 'If these transactions were not intentional, consider reviewing your automation scripts or connected applications.',
      category: 'timing',
    })
  }

  // --- Activity burst ---
  const maxHour = Math.max(...hourly.map((b) => b.count))
  const avgHour = transactions.length / 24
  if (maxHour > avgHour * 5 && maxHour > 5) {
    const burstHour = hourly.find((b) => b.count === maxHour)!
    patterns.push({
      id: 'activity-burst',
      title: 'Activity Burst Detected',
      description: `${maxHour} transactions were sent in a single hour (${burstHour.label} UTC) — ${Math.round(maxHour / avgHour)}× the hourly average.`,
      severity: 'info',
      confidence: 0.88,
      affectedTxCount: maxHour,
      recommendation: 'Bursts may indicate batch operations or automated scripts. Ensure rate limits are respected.',
      category: 'frequency',
    })
  }

  // --- Memo usage ---
  const memoTxs = transactions.filter((tx) => tx.memo && tx.memo.trim())
  const memoRate = memoTxs.length / transactions.length
  if (memoRate > 0.8 && transactions.length > 5) {
    patterns.push({
      id: 'consistent-memo',
      title: 'Consistent Memo Usage',
      description: `${Math.round(memoRate * 100)}% of transactions include a memo field — indicates structured payment references.`,
      severity: 'info',
      confidence: 0.92,
      affectedTxCount: memoTxs.length,
      recommendation: 'Good practice! Memos help recipients identify payment purposes. Ensure memos do not contain sensitive data.',
      category: 'anomaly',
    })
  }

  // --- Multi-op preference ---
  const multiOpTxs = transactions.filter((tx) => toNum(tx.operation_count) > 1)
  const multiOpRate = multiOpTxs.length / transactions.length
  if (multiOpRate > 0.4 && transactions.length > 10) {
    patterns.push({
      id: 'multi-op-pattern',
      title: 'Multi-Operation Transaction Pattern',
      description: `${Math.round(multiOpRate * 100)}% of transactions use multiple operations — an efficient batching pattern.`,
      severity: 'info',
      confidence: 0.9,
      affectedTxCount: multiOpTxs.length,
      recommendation: 'Multi-op batching is cost-effective. Verify each operation is necessary to keep fees optimal.',
      category: 'frequency',
    })
  }

  // --- Dominant operation type ---
  const opCounts: Record<string, number> = {}
  for (const op of operations) {
    opCounts[op.type || 'unknown'] = (opCounts[op.type || 'unknown'] || 0) + 1
  }
  const topOpEntry = Object.entries(opCounts).sort((a, b) => b[1] - a[1])[0]
  if (topOpEntry && operations.length > 5) {
    const [topType, topCount] = topOpEntry
    const topRate = topCount / operations.length
    if (topRate > 0.7) {
      patterns.push({
        id: 'dominant-op-type',
        title: `Dominant Operation Type: ${topType.replace(/_/g, ' ')}`,
        description: `${Math.round(topRate * 100)}% of all operations are of type "${topType.replace(/_/g, ' ')}".`,
        severity: 'info',
        confidence: 0.93,
        affectedTxCount: topCount,
        recommendation: `Your account has a specialised usage pattern centred on ${topType.replace(/_/g, ' ')} operations.`,
        category: 'asset',
      })
    }
  }

  return patterns
}

// ---------------------------------------------------------------------------
// Natural-language insights
// ---------------------------------------------------------------------------

export function generateInsights(
  transactions: StellarTransaction[],
  operations: StellarOperation[],
  feeIntel: FeeIntelligence,
  anomaly: AnomalyScore,
  peak: PeakActivity | null
): string[] {
  const insights: string[] = []
  const total = transactions.length
  if (!total) {
    insights.push('No transactions available for analysis. Connect an account with history to see AI insights.')
    return insights
  }

  const successRate = Math.round(
    (transactions.filter((tx) => tx.successful).length / total) * 100
  )
  insights.push(`Analysed ${total} transaction${total !== 1 ? 's' : ''} and ${operations.length} operation${operations.length !== 1 ? 's' : ''} — overall success rate: ${successRate}%.`)

  if (peak && peak.count > 0) {
    insights.push(`Peak activity occurs at ${peak.label} UTC (${peak.percentage}% of all traffic).`)
  }

  if (feeIntel.medianFee > 0) {
    insights.push(`Median fee: ${feeIntel.medianFee} stroops. ${feeIntel.recommendation}`)
  }

  if (feeIntel.savingsEstimate > 1000) {
    const xlmSavings = (feeIntel.savingsEstimate / 10_000_000).toFixed(4)
    insights.push(`Estimated fee savings potential: ~${feeIntel.savingsEstimate.toLocaleString()} stroops (${xlmSavings} XLM) if optimised fees were used.`)
  }

  insights.push(`Anomaly score: ${anomaly.score}/100 — ${anomaly.label}.`)

  return insights
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function analyzeTransactionPatterns(
  transactions: StellarTransaction[],
  operations: StellarOperation[],
  selfAddress = ''
): PatternAnalysisResult {
  const hourly = buildHourlyActivity(transactions)
  const peak = findPeakActivity(hourly, transactions.length)
  const opMix = buildOperationMix(operations)
  const feeIntel = analyzeFees(transactions)
  const anomaly = computeAnomalyScore(transactions, operations)
  const patterns = detectPatterns(transactions, operations, hourly)
  const clusters = clusterTransactions(transactions)
  const counterparties = findTopCounterparties(operations, selfAddress)
  const insights = generateInsights(transactions, operations, feeIntel, anomaly, peak)

  return {
    patterns,
    hourlyActivity: hourly,
    peakActivity: peak,
    clusters,
    topCounterparties: counterparties,
    feeIntelligence: feeIntel,
    anomalyScore: anomaly,
    operationMix: opMix,
    insights,
    analyzedAt: new Date().toISOString(),
    txCount: transactions.length,
    opCount: operations.length,
  }
}

// ---------------------------------------------------------------------------
// ML / AI Pattern Recognition & Anomaly Detection (D-005)
// ---------------------------------------------------------------------------

// ---- Isolation Forest ----
interface ITreeNode {
  splitFeature?: number
  splitValue?: number
  left?: ITreeNode
  right?: ITreeNode
  size: number
}

export class IsolationForest {
  private trees: ITreeNode[] = []
  private numTrees: number
  private subSampleSize: number

  constructor(numTrees = 100, subSampleSize = 256) {
    this.numTrees = numTrees
    this.subSampleSize = subSampleSize
  }

  fit(X: number[][]) {
    this.trees = []
    const n = X.length
    if (n === 0) return

    const limit = Math.ceil(Math.log2(Math.max(this.subSampleSize, 2)))

    for (let i = 0; i < this.numTrees; i++) {
      const indices: number[] = []
      const sampleSize = Math.min(this.subSampleSize, n)
      while (indices.length < sampleSize) {
        const idx = Math.floor(Math.random() * n)
        if (!indices.includes(idx)) {
          indices.push(idx)
        }
      }
      const sample = indices.map((idx) => X[idx])
      this.trees.push(this.buildTree(sample, 0, limit))
    }
  }

  private buildTree(X: number[][], currentHeight: number, limit: number): ITreeNode {
    const size = X.length
    if (size <= 1 || currentHeight >= limit) {
      return { size }
    }

    const numFeatures = X[0].length
    const splitFeature = Math.floor(Math.random() * numFeatures)

    let min = X[0][splitFeature]
    let max = X[0][splitFeature]
    for (let i = 1; i < size; i++) {
      const v = X[i][splitFeature]
      if (v < min) min = v
      if (v > max) max = v
    }

    if (min === max) {
      return { size }
    }

    const splitValue = min + Math.random() * (max - min)
    const leftX = X.filter((row) => row[splitFeature] < splitValue)
    const rightX = X.filter((row) => row[splitFeature] >= splitValue)

    return {
      splitFeature,
      splitValue,
      left: this.buildTree(leftX, currentHeight + 1, limit),
      right: this.buildTree(rightX, currentHeight + 1, limit),
      size,
    }
  }

  score(x: number[]): number {
    if (this.trees.length === 0) return 0
    const pathLengths = this.trees.map((tree) => this.pathLength(x, tree, 0))
    const avgPathLength = pathLengths.reduce((s, l) => s + l, 0) / this.trees.length

    const n = Math.min(this.subSampleSize, 256)
    const cn = n > 2 ? 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n) : n === 2 ? 1 : 0
    if (cn === 0) return 0

    return Math.pow(2, -avgPathLength / cn)
  }

  private pathLength(x: number[], node: ITreeNode, currentPathLength: number): number {
    if (!node.left || !node.right) {
      const n = node.size
      const cn = n > 2 ? 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n) : n === 2 ? 1 : 0
      return currentPathLength + cn
    }

    const val = x[node.splitFeature!]
    if (val < node.splitValue!) {
      return this.pathLength(x, node.left, currentPathLength + 1)
    } else {
      return this.pathLength(x, node.right, currentPathLength + 1)
    }
  }
}

// ---- Feature Extraction ----
export interface ExtractedFeatures {
  transactionIds: string[]
  features: number[][]
  rawValues: Array<{ amount: number; timeDiff: number; fee: number; opCount: number }>
}

export function extractFeatures(
  transactions: StellarTransaction[],
  operations: StellarOperation[]
): ExtractedFeatures {
  const sortedTxs = [...transactions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const txOpsMap: Record<string, StellarOperation[]> = {}
  for (const op of operations) {
    if (op.transaction_hash) {
      if (!txOpsMap[op.transaction_hash]) {
        txOpsMap[op.transaction_hash] = []
      }
      txOpsMap[op.transaction_hash].push(op)
    }
  }

  const features: number[][] = []
  const transactionIds: string[] = []
  const rawValues: Array<{ amount: number; timeDiff: number; fee: number; opCount: number }> = []

  for (let i = 0; i < sortedTxs.length; i++) {
    const tx = sortedTxs[i]
    const ops = txOpsMap[tx.hash] || []

    let totalAmt = 0
    for (const op of ops) {
      if (op.amount) {
        totalAmt += Number(op.amount) || 0
      }
    }
    const logAmt = Math.log1p(totalAmt)

    let timeDiff = 0
    if (i > 0) {
      const currentTs = new Date(tx.created_at).getTime()
      const prevTs = new Date(sortedTxs[i - 1].created_at).getTime()
      timeDiff = Math.max(0, (currentTs - prevTs) / 1000)
    }
    const logTimeDiff = Math.log1p(timeDiff)

    const counterparties = new Set<string>()
    for (const op of ops) {
      if (op.from) counterparties.add(op.from)
      if (op.to) counterparties.add(op.to)
    }
    const cpCount = counterparties.size

    const fee = Number(tx.fee_charged) || 0
    const logFee = Math.log1p(fee)
    const opCount = Number(tx.operation_count) || ops.length || 1
    const isFailed = tx.successful ? 0 : 1

    features.push([logAmt, logTimeDiff, cpCount, logFee, opCount, isFailed])
    transactionIds.push(tx.id)
    rawValues.push({ amount: totalAmt, timeDiff, fee, opCount })
  }

  return { transactionIds, features, rawValues }
}

export function extractTrainingData(
  transactions: StellarTransaction[],
  operations: StellarOperation[],
  feedback: Record<string, 'confirm' | 'deny'> = {}
): { features: number[][]; labels: number[][] } {
  const { transactionIds, features, rawValues } = extractFeatures(transactions, operations)

  const fees = rawValues.map((r) => r.fee).filter((f) => f > 0).sort((a, b) => a - b)
  const medianFee = fees.length ? fees[Math.floor(fees.length / 2)] : 100

  const augmentedFeatures: number[][] = []
  const augmentedLabels: number[][] = []

  for (let i = 0; i < features.length; i++) {
    const txId = transactionIds[i]
    const raw = rawValues[i]
    const isFailed = features[i][5]
    const txFeedback = feedback[txId]

    let labelIndex = 0 // Normal

    if (txFeedback === 'deny') {
      labelIndex = 0 // Override to Normal
    } else if (txFeedback === 'confirm') {
      if (isFailed === 1) {
        labelIndex = 3 // Failure Storm
      } else if (raw.fee > medianFee * 10) {
        labelIndex = 2 // Fee Spike
      } else if (raw.timeDiff > 0 && raw.timeDiff < 5) {
        labelIndex = 1 // High Frequency Burst
      } else {
        labelIndex = 2 // anomaly default
      }
    } else {
      if (isFailed === 1) {
        labelIndex = 3
      } else if (raw.fee > medianFee * 10) {
        labelIndex = 2
      } else if (raw.timeDiff > 0 && raw.timeDiff < 5) {
        labelIndex = 1
      } else {
        labelIndex = 0
      }
    }

    const oneHot = [0, 0, 0, 0]
    oneHot[labelIndex] = 1

    augmentedFeatures.push(features[i])
    augmentedLabels.push(oneHot)

    if (txFeedback) {
      for (let d = 0; d < 5; d++) {
        augmentedFeatures.push(features[i])
        augmentedLabels.push(oneHot)
      }
    }
  }

  return { features: augmentedFeatures, labels: augmentedLabels }
}

// ---- Model Training Pipeline ----
let mlModel: tf.LayersModel | null = null
let isModelTraining = false

export async function initOrLoadModel(inputDim = 6): Promise<tf.LayersModel> {
  if (mlModel) return mlModel

  try {
    mlModel = await tf.loadLayersModel('indexeddb://stellar-tx-pattern-model')
    mlModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    })
    return mlModel
  } catch {
    const model = tf.sequential()
    model.add(
      tf.layers.dense({
        units: 16,
        activation: 'relu',
        inputShape: [inputDim],
      })
    )
    model.add(
      tf.layers.dense({
        units: 8,
        activation: 'relu',
      })
    )
    model.add(
      tf.layers.dense({
        units: 4,
        activation: 'softmax',
      })
    )

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    })

    mlModel = model
    return mlModel
  }
}

export async function trainMLModel(
  transactions: StellarTransaction[],
  operations: StellarOperation[],
  feedback: Record<string, 'confirm' | 'deny'> = {}
): Promise<{ accuracy: number; loss: number }> {
  if (isModelTraining) {
    return { accuracy: 1, loss: 0 }
  }
  isModelTraining = true

  try {
    const model = await initOrLoadModel(6)
    const { features, labels } = extractTrainingData(transactions, operations, feedback)

    if (features.length === 0) {
      isModelTraining = false
      return { accuracy: 0, loss: 0 }
    }

    const xs = tf.tensor2d(features)
    const ys = tf.tensor2d(labels)

    const history = await model.fit(xs, ys, {
      epochs: 10,
      batchSize: Math.min(32, features.length),
      shuffle: true,
      verbose: 0,
    })

    try {
      await model.save('indexeddb://stellar-tx-pattern-model')
    } catch {
      // Ignore save error in node/vitest tests
    }

    xs.dispose()
    ys.dispose()

    const lastAcc = history.history.accuracy
      ? (history.history.accuracy[history.history.accuracy.length - 1] as number)
      : 1
    const lastLoss = history.history.loss
      ? (history.history.loss[history.history.loss.length - 1] as number)
      : 0

    isModelTraining = false
    return { accuracy: lastAcc, loss: lastLoss }
  } catch (err) {
    isModelTraining = false
    throw err
  }
}

// ---- Real-time Scoring Endpoint ----
export interface ScoreResult {
  anomalyScore: number
  predictedClass: string
  confidence: number
  latencyMs: number
  explanations: string[]
}

export async function scoreTransaction(
  tx: StellarTransaction,
  ops: StellarOperation[],
  allTxs: StellarTransaction[],
  allOps: StellarOperation[],
  forest?: IsolationForest
): Promise<ScoreResult> {
  const startTime = performance.now()

  const sortedTxs = [...allTxs]
  if (!sortedTxs.some((t) => t.id === tx.id)) {
    sortedTxs.push(tx)
  }
  sortedTxs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const txIdx = sortedTxs.findIndex((t) => t.id === tx.id)
  const prevTx = txIdx > 0 ? sortedTxs[txIdx - 1] : null

  let totalAmt = 0
  for (const op of ops) {
    if (op.amount) {
      totalAmt += Number(op.amount) || 0
    }
  }
  const logAmt = Math.log1p(totalAmt)

  let timeDiff = 0
  if (prevTx) {
    timeDiff = Math.max(0, (new Date(tx.created_at).getTime() - new Date(prevTx.created_at).getTime()) / 1000)
  }
  const logTimeDiff = Math.log1p(timeDiff)

  const counterparties = new Set<string>()
  for (const op of ops) {
    if (op.from) counterparties.add(op.from)
    if (op.to) counterparties.add(op.to)
  }
  const cpCount = counterparties.size
  const fee = Number(tx.fee_charged) || 0
  const logFee = Math.log1p(fee)
  const opCount = Number(tx.operation_count) || ops.length || 1
  const isFailed = tx.successful ? 0 : 1

  const x = [logAmt, logTimeDiff, cpCount, logFee, opCount, isFailed]

  let forestScore = 0
  if (forest) {
    forestScore = forest.score(x)
  } else {
    const mockForest = new IsolationForest()
    const { features } = extractFeatures(allTxs, allOps)
    mockForest.fit(features)
    forestScore = mockForest.score(x)
  }

  let predictedClass = 'Normal'
  let confidence = 1.0

  try {
    const model = await initOrLoadModel(6)
    const inputTensor = tf.tensor2d([x])
    const predTensor = model.predict(inputTensor) as tf.Tensor
    const probabilities = await predTensor.data()

    inputTensor.dispose()
    predTensor.dispose()

    const maxIdx = probabilities.indexOf(Math.max(...probabilities))
    const classes = ['Normal', 'High Frequency Burst', 'Fee Spike', 'Failure Storm']
    predictedClass = classes[maxIdx]
    confidence = probabilities[maxIdx]
  } catch {
    if (isFailed === 1) {
      predictedClass = 'Failure Storm'
    } else if (fee > 5000) {
      predictedClass = 'Fee Spike'
    } else if (timeDiff > 0 && timeDiff < 5) {
      predictedClass = 'High Frequency Burst'
    }
  }

  const explanations: string[] = []
  if (isFailed === 1) {
    explanations.push('Transaction operation failed')
  }
  if (fee > 1000) {
    explanations.push(`High transaction fee charged: ${fee} stroops`)
  }
  if (timeDiff > 0 && timeDiff < 5) {
    explanations.push(`Extremely short interval since previous transaction: ${timeDiff.toFixed(1)}s`)
  }
  if (cpCount > 5) {
    explanations.push(`High counterparty diversity in single transaction: ${cpCount} accounts`)
  }

  if (explanations.length === 0) {
    explanations.push('Transaction parameters within normal baseline thresholds')
  }

  const latencyMs = performance.now() - startTime

  return {
    anomalyScore: Math.round(forestScore * 100),
    predictedClass,
    confidence,
    latencyMs,
    explanations,
  }
}
