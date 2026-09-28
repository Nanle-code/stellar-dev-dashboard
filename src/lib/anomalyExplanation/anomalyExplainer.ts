/**
 * anomalyExplainer.ts
 * Feature #591: AI-Powered Anomaly Explanation Engine
 *
 * Generates human-readable explanations for detected anomalies by combining:
 *  - Feature importance analysis (which factors contributed most)
 *  - Template-based natural-language explanation generation
 *  - Context analysis from DetectedPattern and AnomalyScore data
 *  - Actionable recommendation synthesis
 */

import type {
  DetectedPattern,
  PatternSeverity,
  AnomalyScore,
  StellarTransaction,
  StellarOperation,
} from '../transactionPatternAnalysis'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExplanationConfidence = 'high' | 'medium' | 'low'

export interface FeatureImportance {
  /** Human-readable name of the contributing factor */
  name: string
  /** Normalised contribution weight (0–1) */
  weight: number
  /** One-sentence description of why this factor matters */
  description: string
  /** Direction of the deviation: above / below / unusual */
  direction: 'above_normal' | 'below_normal' | 'unusual'
  /** Observed value as a formatted string */
  observedValue: string
  /** Typical baseline for comparison */
  typicalValue: string
}

export interface AnomalyExplanation {
  id: string
  /** Plain-English headline (≤ 12 words) */
  headline: string
  /** Two-to-three sentence summary for non-experts */
  summary: string
  /** Ordered list of top contributing features */
  topFeatures: FeatureImportance[]
  /** Severity inherited from the source pattern/score */
  severity: PatternSeverity
  /** Confidence in this explanation */
  confidence: ExplanationConfidence
  /** 0–100 overall anomaly magnitude */
  anomalyMagnitude: number
  /** What the user should do next */
  actionItems: string[]
  /** Deep-dive technical context */
  technicalContext: string
  /** Category of anomaly for UI grouping */
  category: string
  /** ISO timestamp of when the explanation was generated */
  generatedAt: string
}

export interface ExplainerContext {
  transactions: StellarTransaction[]
  operations: StellarOperation[]
  accountAddress?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const toNum = (v: string | number | undefined, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const mean = (arr: number[]): number =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

const median = (sorted: number[]): number => {
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const pct = (n: number, total: number): string =>
  total > 0 ? `${Math.round((n / total) * 100)}%` : '0%'

const fmt = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `${(n / 1_000).toFixed(1)}K`
    : String(Math.round(n))

// ---------------------------------------------------------------------------
// Feature extraction from raw transaction data
// ---------------------------------------------------------------------------

interface RawFeatures {
  txCount: number
  failureRate: number       // 0–1
  failedCount: number
  avgFeeStroops: number
  medianFeeStroops: number
  maxFeeStroops: number
  feeRatio: number          // max / median
  burstRatio: number        // peak-hour count / average-hour count
  peakHourCount: number
  uniqueCounterparties: number
  cpRatio: number           // counterparties / txCount
  opTypeDiversity: number   // number of distinct op types
  avgOpCount: number
  hasLargeTransfer: boolean
  largeTransferAmt: number
  nightActivityPct: number  // 0–1 (22:00–06:00 UTC)
  memoUsagePct: number      // 0–1
}

function extractRawFeatures(
  transactions: StellarTransaction[],
  operations: StellarOperation[]
): RawFeatures {
  const n = transactions.length
  if (n === 0) {
    return {
      txCount: 0, failureRate: 0, failedCount: 0,
      avgFeeStroops: 0, medianFeeStroops: 0, maxFeeStroops: 0, feeRatio: 1,
      burstRatio: 1, peakHourCount: 0,
      uniqueCounterparties: 0, cpRatio: 0,
      opTypeDiversity: 0, avgOpCount: 0,
      hasLargeTransfer: false, largeTransferAmt: 0,
      nightActivityPct: 0, memoUsagePct: 0,
    }
  }

  const failedCount = transactions.filter(tx => !tx.successful).length
  const failureRate = failedCount / n

  const fees = transactions.map(tx => toNum(tx.fee_charged)).filter(f => f > 0).sort((a, b) => a - b)
  const avgFeeStroops = mean(fees)
  const medianFeeStroops = median(fees) || 100
  const maxFeeStroops = fees.length ? fees[fees.length - 1] : 0
  const feeRatio = maxFeeStroops / medianFeeStroops

  // Hourly burst
  const hourCounts: Record<number, number> = {}
  let nightCount = 0
  for (const tx of transactions) {
    const h = new Date(tx.created_at).getUTCHours()
    if (!isNaN(h)) {
      hourCounts[h] = (hourCounts[h] || 0) + 1
      if (h >= 22 || h < 6) nightCount++
    }
  }
  const peakHourCount = Math.max(...Object.values(hourCounts), 0)
  const avgHourCount = n / 24
  const burstRatio = avgHourCount > 0 ? peakHourCount / avgHourCount : 1

  // Counterparties
  const cpSet = new Set<string>()
  const opTypes = new Set<string>()
  let totalAmt = 0
  let largeTransferAmt = 0
  for (const op of operations) {
    if (op.to) cpSet.add(op.to)
    if (op.from) cpSet.add(op.from)
    opTypes.add(op.type || 'unknown')
    const amt = toNum(op.amount)
    totalAmt += amt
    if (amt > largeTransferAmt) largeTransferAmt = amt
  }

  // Large transfer threshold: 10 000 XLM in stroops
  const LARGE_THRESHOLD = 10_000 * 10_000_000
  const hasLargeTransfer = largeTransferAmt > LARGE_THRESHOLD

  const memoCount = transactions.filter(tx => tx.memo && String(tx.memo).trim()).length

  return {
    txCount: n,
    failureRate,
    failedCount,
    avgFeeStroops: Math.round(avgFeeStroops),
    medianFeeStroops: Math.round(medianFeeStroops),
    maxFeeStroops: Math.round(maxFeeStroops),
    feeRatio: Math.round(feeRatio * 10) / 10,
    burstRatio: Math.round(burstRatio * 10) / 10,
    peakHourCount,
    uniqueCounterparties: cpSet.size,
    cpRatio: Math.round((cpSet.size / n) * 100) / 100,
    opTypeDiversity: opTypes.size,
    avgOpCount: Math.round((mean(transactions.map(tx => toNum(tx.operation_count, 1)))) * 10) / 10,
    hasLargeTransfer,
    largeTransferAmt: Math.round(largeTransferAmt),
    nightActivityPct: Math.round((nightCount / n) * 100) / 100,
    memoUsagePct: Math.round((memoCount / n) * 100) / 100,
  }
}

// ---------------------------------------------------------------------------
// Feature importance calculation
// Weights are derived by comparing observed values to expected baselines.
// ---------------------------------------------------------------------------

const BASELINES = {
  failureRate: 0.05,        // 5 % typical failure rate
  feeRatio: 3,              // max fee up to 3× median is normal
  burstRatio: 3,            // peak hour up to 3× average is normal
  cpRatio: 0.5,             // ~50 % unique counterparties is normal
  opTypeDiversity: 4,       // 4 op types is typical
  nightActivityPct: 0.15,   // 15 % night activity is normal
  memoUsagePct: 0.3,        // 30 % memo usage is typical
}

function computeFeatureImportances(raw: RawFeatures): FeatureImportance[] {
  const features: FeatureImportance[] = []

  // --- Failure rate ---
  if (raw.txCount > 0) {
    const deviation = Math.max(0, raw.failureRate - BASELINES.failureRate)
    if (deviation > 0.02) {
      features.push({
        name: 'Transaction Failure Rate',
        weight: Math.min(1, deviation / 0.5),
        description: `${pct(raw.failedCount, raw.txCount)} of transactions failed, which is higher than the typical ~5%.`,
        direction: 'above_normal',
        observedValue: pct(raw.failedCount, raw.txCount),
        typicalValue: '~5%',
      })
    }
  }

  // --- Fee spike ---
  if (raw.feeRatio > BASELINES.feeRatio) {
    const deviation = (raw.feeRatio - BASELINES.feeRatio) / BASELINES.feeRatio
    features.push({
      name: 'Fee Spike',
      weight: Math.min(1, deviation / 5),
      description: `The highest fee (${fmt(raw.maxFeeStroops)} stroops) was ${raw.feeRatio}× the median fee, indicating a fee spike.`,
      direction: 'above_normal',
      observedValue: `${raw.feeRatio}× median`,
      typicalValue: '≤ 3× median',
    })
  }

  // --- Transaction burst ---
  if (raw.burstRatio > BASELINES.burstRatio) {
    const deviation = (raw.burstRatio - BASELINES.burstRatio) / BASELINES.burstRatio
    features.push({
      name: 'Transaction Burst',
      weight: Math.min(1, deviation / 5),
      description: `The busiest hour had ${raw.peakHourCount} transactions — ${raw.burstRatio}× the hourly average, suggesting an unusual activity spike.`,
      direction: 'above_normal',
      observedValue: `${raw.peakHourCount} txs in 1 hour`,
      typicalValue: `${Math.round(raw.txCount / 24)} txs/hour avg`,
    })
  }

  // --- Counterparty diversity ---
  if (raw.cpRatio > BASELINES.cpRatio * 1.5) {
    const deviation = (raw.cpRatio - BASELINES.cpRatio) / BASELINES.cpRatio
    features.push({
      name: 'High Counterparty Diversity',
      weight: Math.min(1, deviation / 3),
      description: `Interactions involved ${raw.uniqueCounterparties} unique addresses (${pct(Math.round(raw.cpRatio * raw.txCount), raw.txCount)} of transactions), suggesting a broad scatter of recipients.`,
      direction: 'above_normal',
      observedValue: `${raw.uniqueCounterparties} unique addresses`,
      typicalValue: `~${Math.round(BASELINES.cpRatio * raw.txCount)} expected`,
    })
  }

  // --- Op type diversity ---
  if (raw.opTypeDiversity > BASELINES.opTypeDiversity) {
    const deviation = (raw.opTypeDiversity - BASELINES.opTypeDiversity) / BASELINES.opTypeDiversity
    features.push({
      name: 'Unusual Operation Diversity',
      weight: Math.min(1, deviation / 2),
      description: `${raw.opTypeDiversity} distinct operation types were used — above the typical 4, indicating complex or multi-purpose activity.`,
      direction: 'unusual',
      observedValue: `${raw.opTypeDiversity} op types`,
      typicalValue: `≤ ${BASELINES.opTypeDiversity} op types`,
    })
  }

  // --- Night-time activity ---
  if (raw.nightActivityPct > BASELINES.nightActivityPct * 2) {
    const deviation = (raw.nightActivityPct - BASELINES.nightActivityPct) / BASELINES.nightActivityPct
    features.push({
      name: 'Off-Hours Activity',
      weight: Math.min(1, deviation / 4),
      description: `${pct(Math.round(raw.nightActivityPct * raw.txCount), raw.txCount)} of transactions occurred between 22:00–06:00 UTC, which is above the typical 15%.`,
      direction: 'above_normal',
      observedValue: pct(Math.round(raw.nightActivityPct * raw.txCount), raw.txCount) + ' at night',
      typicalValue: '~15% at night',
    })
  }

  // --- Large transfer ---
  if (raw.hasLargeTransfer) {
    features.push({
      name: 'Large Value Transfer',
      weight: 0.7,
      description: `A single operation transferred ${fmt(raw.largeTransferAmt / 10_000_000)} XLM, which is unusually large.`,
      direction: 'above_normal',
      observedValue: `${fmt(raw.largeTransferAmt / 10_000_000)} XLM`,
      typicalValue: '< 10,000 XLM',
    })
  }

  // Sort by weight descending, keep top 5
  return features.sort((a, b) => b.weight - a.weight).slice(0, 5)
}

// ---------------------------------------------------------------------------
// Template-based explanation generation
// ---------------------------------------------------------------------------

function determineConfidence(features: FeatureImportance[], magnitude: number): ExplanationConfidence {
  if (features.length >= 3 && magnitude >= 60) return 'high'
  if (features.length >= 2 || magnitude >= 40) return 'medium'
  return 'low'
}

function buildHeadline(pattern: DetectedPattern, features: FeatureImportance[]): string {
  // Use the top feature to craft a specific headline
  const top = features[0]
  if (!top) return pattern.title

  const templates: Record<string, string> = {
    'Transaction Failure Rate': 'Elevated transaction failures detected',
    'Fee Spike':                'Unusual fee spike in recent transactions',
    'Transaction Burst':        'Abnormal transaction burst identified',
    'High Counterparty Diversity': 'Unusually wide recipient scatter observed',
    'Unusual Operation Diversity': 'Complex multi-type operation pattern found',
    'Off-Hours Activity':       'Significant off-hours activity detected',
    'Large Value Transfer':     'Large-value transfer flagged for review',
  }
  return templates[top.name] || pattern.title
}

function buildSummary(
  pattern: DetectedPattern,
  features: FeatureImportance[],
  raw: RawFeatures
): string {
  const topNames = features.slice(0, 2).map(f => f.name.toLowerCase())

  if (topNames.includes('transaction failure rate')) {
    return (
      `${pct(raw.failedCount, raw.txCount)} of your recent transactions failed, compared to a typical rate below 5%. ` +
      `This could indicate insufficient fees, sequence number issues, or network congestion. ` +
      `Reviewing the failed transactions individually will help pinpoint the root cause.`
    )
  }
  if (topNames.includes('fee spike')) {
    return (
      `A fee of ${fmt(raw.maxFeeStroops)} stroops was observed — ${raw.feeRatio}× higher than the median fee of ${fmt(raw.medianFeeStroops)} stroops. ` +
      `Fee spikes can occur during network congestion when transactions compete for limited ledger space. ` +
      `Using dynamic fee estimation can help avoid overpaying in the future.`
    )
  }
  if (topNames.includes('transaction burst')) {
    return (
      `${raw.peakHourCount} transactions were submitted within a single hour, which is ${raw.burstRatio}× the normal hourly rate. ` +
      `Such bursts are common in automated or scripted activity. ` +
      `If this was not intentional, it may indicate an automated process running without proper throttling.`
    )
  }
  if (topNames.includes('large value transfer')) {
    return (
      `A transfer of ${fmt(raw.largeTransferAmt / 10_000_000)} XLM was flagged as unusually large. ` +
      `Large transfers warrant additional scrutiny to confirm they are authorised. ` +
      `Check that the destination address and amount are correct before proceeding.`
    )
  }
  if (topNames.includes('off-hours activity')) {
    return (
      `${pct(Math.round(raw.nightActivityPct * raw.txCount), raw.txCount)} of transactions occurred between 22:00–06:00 UTC. ` +
      `This off-hours activity is above the expected baseline of ~15% and may warrant review. ` +
      `If this is from an automated system, confirm it is operating as intended.`
    )
  }

  // Generic fallback using pattern description
  return (
    `${pattern.description} ` +
    `This pattern was detected across ${pattern.affectedTxCount} transaction${pattern.affectedTxCount !== 1 ? 's' : ''} ` +
    `with ${Math.round(pattern.confidence * 100)}% confidence. ` +
    `${pattern.recommendation}`
  )
}

function buildActionItems(
  pattern: DetectedPattern,
  features: FeatureImportance[],
  raw: RawFeatures
): string[] {
  const actions: string[] = []

  for (const f of features) {
    switch (f.name) {
      case 'Transaction Failure Rate':
        actions.push('Review failed transactions to identify common error codes (e.g. tx_bad_seq, op_underfunded).')
        actions.push('Ensure your fee is at or above the network base fee of 100 stroops per operation.')
        break
      case 'Fee Spike':
        actions.push('Enable dynamic fee estimation so your app adjusts fees automatically during congestion.')
        actions.push('Consider using surge pricing windows to schedule non-urgent transactions during off-peak periods.')
        break
      case 'Transaction Burst':
        actions.push('Add rate-limiting or throttling if transactions are submitted programmatically.')
        actions.push('Verify no runaway loop or misconfigured automation is sending repeated transactions.')
        break
      case 'High Counterparty Diversity':
        actions.push('Audit the recipient list to ensure all addresses are correct and expected.')
        actions.push('If this is a batch payment run, verify the source list was not corrupted.')
        break
      case 'Large Value Transfer':
        actions.push('Double-check the destination address using a block explorer before confirming the transfer.')
        actions.push('Consider splitting very large transfers into smaller tranches for risk management.')
        break
      case 'Off-Hours Activity':
        actions.push('Review which system or user triggered transactions between 22:00–06:00 UTC.')
        actions.push('Set up transaction alerts so you are notified of off-hours activity in real time.')
        break
      case 'Unusual Operation Diversity':
        actions.push('Check whether all operation types used are expected for your application workflow.')
        break
    }
  }

  // Always add the pattern's own recommendation
  if (pattern.recommendation && !actions.includes(pattern.recommendation)) {
    actions.push(pattern.recommendation)
  }

  // Deduplicate while preserving order
  return [...new Set(actions)].slice(0, 5)
}

function buildTechnicalContext(raw: RawFeatures, features: FeatureImportance[]): string {
  const lines: string[] = [
    `Analysed ${raw.txCount} transaction${raw.txCount !== 1 ? 's' : ''}.`,
    `Failure rate: ${pct(raw.failedCount, raw.txCount)} (${raw.failedCount} failed).`,
    `Fee range: ${fmt(raw.medianFeeStroops)}–${fmt(raw.maxFeeStroops)} stroops (median → max).`,
    `Peak activity: ${raw.peakHourCount} txs in one hour (${raw.burstRatio}× average).`,
    `Unique counterparties: ${raw.uniqueCounterparties} (ratio ${raw.cpRatio.toFixed(2)}).`,
    `Operation type diversity: ${raw.opTypeDiversity} distinct types.`,
  ]
  if (features.length) {
    lines.push(`Top contributing factors: ${features.map(f => f.name).join(', ')}.`)
  }
  return lines.join(' ')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable AnomalyExplanation for a single DetectedPattern.
 */
export function explainPattern(
  pattern: DetectedPattern,
  context: ExplainerContext
): AnomalyExplanation {
  const raw = extractRawFeatures(context.transactions, context.operations)
  const allFeatures = computeFeatureImportances(raw)

  // Filter to features relevant to this pattern's category
  const categoryFeatureMap: Record<string, string[]> = {
    failure:      ['Transaction Failure Rate'],
    fee:          ['Fee Spike'],
    frequency:    ['Transaction Burst'],
    counterparty: ['High Counterparty Diversity'],
    amount:       ['Large Value Transfer'],
    timing:       ['Off-Hours Activity'],
    asset:        ['Unusual Operation Diversity'],
    anomaly:      allFeatures.map(f => f.name),
  }
  const relevant = categoryFeatureMap[pattern.category] || allFeatures.map(f => f.name)
  const topFeatures = allFeatures.filter(f => relevant.includes(f.name))

  // Fall back to all features if none matched by category
  const featuresToUse = topFeatures.length ? topFeatures : allFeatures.slice(0, 3)

  const magnitude = Math.round(pattern.confidence * 100)
  const confidence = determineConfidence(featuresToUse, magnitude)

  return {
    id: `exp-${pattern.id}-${Date.now()}`,
    headline: buildHeadline(pattern, featuresToUse),
    summary: buildSummary(pattern, featuresToUse, raw),
    topFeatures: featuresToUse,
    severity: pattern.severity,
    confidence,
    anomalyMagnitude: magnitude,
    actionItems: buildActionItems(pattern, featuresToUse, raw),
    technicalContext: buildTechnicalContext(raw, featuresToUse),
    category: pattern.category,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Generate an AnomalyExplanation directly from an overall AnomalyScore
 * (used when there is no specific DetectedPattern to explain).
 */
export function explainAnomalyScore(
  anomalyScore: AnomalyScore,
  context: ExplainerContext
): AnomalyExplanation {
  const raw = extractRawFeatures(context.transactions, context.operations)
  const features = computeFeatureImportances(raw)
  const magnitude = anomalyScore.score

  const severity: PatternSeverity =
    magnitude >= 70 ? 'critical' : magnitude >= 40 ? 'warning' : 'info'

  // Build a synthetic pattern shell
  const syntheticPattern: DetectedPattern = {
    id: 'overall-anomaly',
    title: anomalyScore.label || 'Anomalous activity detected',
    description: `The overall anomaly score is ${magnitude}/100, indicating ${severity}-level deviations.`,
    severity,
    confidence: magnitude / 100,
    affectedTxCount: raw.txCount,
    recommendation: features.length
      ? `Focus on: ${features[0].name}.`
      : 'Review recent transactions for unusual patterns.',
    category: 'anomaly',
  }

  const explanation = explainPattern(syntheticPattern, context)
  return { ...explanation, id: `exp-overall-${Date.now()}` }
}

/**
 * Batch-explain all patterns from an analysis run.
 * Returns explanations sorted by anomaly magnitude (highest first).
 */
export function explainPatterns(
  patterns: DetectedPattern[],
  context: ExplainerContext
): AnomalyExplanation[] {
  return patterns
    .map(p => explainPattern(p, context))
    .sort((a, b) => b.anomalyMagnitude - a.anomalyMagnitude)
}
