/**
 * Unit tests for transactionPatternAnalysis.ts (D-005)
 */
import { describe, it, expect } from 'vitest'
import {
  buildHourlyActivity,
  findPeakActivity,
  buildOperationMix,
  analyzeFees,
  findTopCounterparties,
  clusterTransactions,
  computeAnomalyScore,
  detectPatterns,
  generateInsights,
  analyzeTransactionPatterns,
  IsolationForest,
  extractFeatures,
  extractTrainingData,
  scoreTransaction,
} from '../transactionPatternAnalysis'
import type { StellarTransaction, StellarOperation } from '../transactionPatternAnalysis'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<StellarTransaction> = {}): StellarTransaction {
  return {
    id: Math.random().toString(36).slice(2),
    hash: Math.random().toString(36).slice(2).repeat(4),
    created_at: new Date().toISOString(),
    fee_charged: '100',
    operation_count: 1,
    successful: true,
    ...overrides,
  }
}

function makeOp(overrides: Partial<StellarOperation> = {}): StellarOperation {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'payment',
    created_at: new Date().toISOString(),
    amount: '10',
    asset_code: 'XLM',
    from: 'GAAA',
    to: 'GBBB',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildHourlyActivity
// ---------------------------------------------------------------------------
describe('buildHourlyActivity', () => {
  it('returns exactly 24 buckets', () => {
    const result = buildHourlyActivity([])
    expect(result).toHaveLength(24)
  })

  it('counts transactions into the correct UTC hour', () => {
    const txAt3am = makeTx({ created_at: '2024-01-01T03:30:00Z' })
    const txAt15pm = makeTx({ created_at: '2024-01-01T15:00:00Z' })
    const result = buildHourlyActivity([txAt3am, txAt15pm])
    expect(result[3].count).toBe(1)
    expect(result[15].count).toBe(1)
    expect(result[0].count).toBe(0)
  })

  it('ignores invalid dates', () => {
    const bad = makeTx({ created_at: 'not-a-date' })
    const result = buildHourlyActivity([bad])
    const total = result.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// findPeakActivity
// ---------------------------------------------------------------------------
describe('findPeakActivity', () => {
  it('returns null when total is 0', () => {
    const hourly = buildHourlyActivity([])
    expect(findPeakActivity(hourly, 0)).toBeNull()
  })

  it('identifies the busiest hour', () => {
    const hourly = buildHourlyActivity([])
    hourly[14].count = 10
    hourly[3].count = 2
    const peak = findPeakActivity(hourly, 12)
    expect(peak?.hour).toBe(14)
    expect(peak?.count).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// buildOperationMix
// ---------------------------------------------------------------------------
describe('buildOperationMix', () => {
  it('returns empty for no operations', () => {
    expect(buildOperationMix([])).toEqual([])
  })

  it('sums operation types correctly', () => {
    const ops = [
      makeOp({ type: 'payment' }),
      makeOp({ type: 'payment' }),
      makeOp({ type: 'create_account' }),
    ]
    const mix = buildOperationMix(ops)
    expect(mix[0].type).toBe('payment')
    expect(mix[0].count).toBe(2)
    expect(mix[0].percentage).toBe(67)
    expect(mix[1].type).toBe('create_account')
    expect(mix[1].count).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// analyzeFees
// ---------------------------------------------------------------------------
describe('analyzeFees', () => {
  it('returns sensible defaults for empty input', () => {
    const result = analyzeFees([])
    expect(result.medianFee).toBe(100)
    expect(result.avgFee).toBe(0)
  })

  it('computes correct median and average', () => {
    const txs = [100, 200, 300].map((fee) => makeTx({ fee_charged: fee.toString() }))
    const result = analyzeFees(txs)
    expect(result.medianFee).toBe(200)
    expect(result.avgFee).toBe(200)
  })

  it('detects overpaying percentage', () => {
    const txs = [
      makeTx({ fee_charged: '100' }),
      makeTx({ fee_charged: '100' }),
      makeTx({ fee_charged: '5000' }), // spikes
      makeTx({ fee_charged: '5000' }),
    ]
    const result = analyzeFees(txs)
    expect(result.overpayingPct).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// findTopCounterparties
// ---------------------------------------------------------------------------
describe('findTopCounterparties', () => {
  it('returns empty for no operations', () => {
    expect(findTopCounterparties([], 'GAAA')).toEqual([])
  })

  it('identifies the top counterparty', () => {
    const ops = [
      makeOp({ from: 'GAAA', to: 'GBBB', amount: '50' }),
      makeOp({ from: 'GAAA', to: 'GBBB', amount: '30' }),
      makeOp({ from: 'GAAA', to: 'GCCC', amount: '10' }),
    ]
    const result = findTopCounterparties(ops, 'GAAA')
    expect(result[0].address).toBe('GBBB')
    expect(result[0].txCount).toBe(2)
  })

  it('excludes self-to-self operations', () => {
    const ops = [makeOp({ from: 'GAAA', to: 'GAAA' })]
    expect(findTopCounterparties(ops, 'GAAA')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// clusterTransactions
// ---------------------------------------------------------------------------
describe('clusterTransactions', () => {
  it('returns empty for no transactions', () => {
    expect(clusterTransactions([])).toEqual([])
  })

  it('clusters failed transactions separately', () => {
    const txs = [
      makeTx({ successful: false }),
      makeTx({ successful: true }),
    ]
    const clusters = clusterTransactions(txs)
    const failed = clusters.find((c) => c.label === 'Failed')
    expect(failed?.count).toBe(1)
  })

  it('clusters memo-tagged transactions', () => {
    const txs = [makeTx({ memo: 'payment-ref-123', successful: true })]
    const clusters = clusterTransactions(txs)
    const memoCluster = clusters.find((c) => c.label === 'Memo-tagged')
    expect(memoCluster?.count).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// computeAnomalyScore
// ---------------------------------------------------------------------------
describe('computeAnomalyScore', () => {
  it('returns 0 for empty transactions', () => {
    const result = computeAnomalyScore([], [])
    expect(result.score).toBe(0)
  })

  it('returns elevated score for high failure rate', () => {
    const txs = Array.from({ length: 10 }, (_, i) =>
      makeTx({ successful: i < 4 }) // 60% failure
    )
    const result = computeAnomalyScore(txs, [])
    expect(result.score).toBeGreaterThanOrEqual(30)
  })

  it('returns "Normal" label for clean data', () => {
    const txs = Array.from({ length: 5 }, () => makeTx({ successful: true, fee_charged: '100' }))
    const result = computeAnomalyScore(txs, [])
    expect(result.label).toBe('Normal')
  })
})

// ---------------------------------------------------------------------------
// detectPatterns
// ---------------------------------------------------------------------------
describe('detectPatterns', () => {
  it('returns empty for no transactions', () => {
    expect(detectPatterns([], [], buildHourlyActivity([]))).toEqual([])
  })

  it('detects high failure rate pattern', () => {
    const txs = Array.from({ length: 10 }, (_, i) =>
      makeTx({ successful: i >= 7 }) // 70% failure
    )
    const patterns = detectPatterns(txs, [], buildHourlyActivity(txs))
    expect(patterns.some((p) => p.id === 'high-failure-rate')).toBe(true)
  })

  it('detects multi-op pattern', () => {
    const txs = Array.from({ length: 20 }, () =>
      makeTx({ operation_count: 3, successful: true })
    )
    const patterns = detectPatterns(txs, [], buildHourlyActivity(txs))
    expect(patterns.some((p) => p.id === 'multi-op-pattern')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// generateInsights
// ---------------------------------------------------------------------------
describe('generateInsights', () => {
  it('returns a "no data" message for empty transactions', () => {
    const fee = analyzeFees([])
    const anomaly = computeAnomalyScore([], [])
    const insights = generateInsights([], [], fee, anomaly, null)
    expect(insights.length).toBeGreaterThan(0)
    expect(insights[0]).toContain('No transactions')
  })

  it('includes peak activity when present', () => {
    const txs = [makeTx({ created_at: '2024-01-01T10:00:00Z' })]
    const hourly = buildHourlyActivity(txs)
    const peak = findPeakActivity(hourly, txs.length)
    const fee = analyzeFees(txs)
    const anomaly = computeAnomalyScore(txs, [])
    const insights = generateInsights(txs, [], fee, anomaly, peak)
    expect(insights.some((i) => i.includes('Peak activity'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// analyzeTransactionPatterns (integration)
// ---------------------------------------------------------------------------
describe('analyzeTransactionPatterns', () => {
  it('returns a complete result for a small dataset', () => {
    const txs = Array.from({ length: 5 }, () => makeTx())
    const ops = Array.from({ length: 8 }, () => makeOp())
    const result = analyzeTransactionPatterns(txs, ops, 'GAAA')

    expect(result.txCount).toBe(5)
    expect(result.opCount).toBe(8)
    expect(result.hourlyActivity).toHaveLength(24)
    expect(result.insights.length).toBeGreaterThan(0)
    expect(typeof result.anomalyScore.score).toBe('number')
    expect(result.analyzedAt).toBeTruthy()
  })

  it('handles completely empty input gracefully', () => {
    const result = analyzeTransactionPatterns([], [], '')
    expect(result.txCount).toBe(0)
    expect(result.patterns).toEqual([])
    expect(result.clusters).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// ML / AI Pattern Analysis Tests (D-005)
// ---------------------------------------------------------------------------

describe('IsolationForest', () => {
  it('correctly scores normal vs anomalous points', () => {
    const forest = new IsolationForest(20, 10)
    
    // Normal data cluster around [1, 1]
    const X = Array.from({ length: 50 }, () => [
      1 + (Math.random() - 0.5) * 0.1,
      1 + (Math.random() - 0.5) * 0.1,
    ])
    
    forest.fit(X)

    // Score a point inside the cluster
    const normalScore = forest.score([1.0, 1.0])
    // Score a point far outside the cluster
    const anomalyScore = forest.score([10.0, 10.0])

    expect(anomalyScore).toBeGreaterThan(normalScore)
  })

  it('handles empty input gracefully', () => {
    const forest = new IsolationForest()
    forest.fit([])
    expect(forest.score([1, 2])).toBe(0)
  })
})

describe('extractFeatures', () => {
  it('extracts exactly 6 features per transaction', () => {
    const tx = makeTx({ fee_charged: '100', operation_count: 2 })
    const op1 = makeOp({ transaction_hash: tx.hash, amount: '50' })
    const op2 = makeOp({ transaction_hash: tx.hash, amount: '30' })

    const { features, rawValues } = extractFeatures([tx], [op1, op2])

    expect(features).toHaveLength(1)
    expect(features[0]).toHaveLength(6) // logAmt, logTimeDiff, cpCount, logFee, opCount, isFailed
    expect(rawValues[0].amount).toBe(80)
    expect(rawValues[0].fee).toBe(100)
    expect(rawValues[0].opCount).toBe(2)
  })
})

describe('extractTrainingData', () => {
  it('correctly generates labels and handles feedback weighting', () => {
    const tx = makeTx({ fee_charged: '100' })
    const op = makeOp({ transaction_hash: tx.hash, amount: '10' })

    // Normal case
    const dataNormal = extractTrainingData([tx], [op], {})
    expect(dataNormal.features).toHaveLength(1)
    expect(dataNormal.labels[0]).toEqual([1, 0, 0, 0]) // Normal label is index 0

    // Deny feedback should keep it Normal (label 0)
    const feedbackDeny = { [tx.id]: 'deny' as const }
    const dataDeny = extractTrainingData([tx], [op], feedbackDeny)
    expect(dataDeny.labels[0]).toEqual([1, 0, 0, 0])
    // Should duplicate features for weighting
    expect(dataDeny.features.length).toBeGreaterThan(1)
  })
})

describe('scoreTransaction', () => {
  it('performs prediction and returns a score result in <50ms', async () => {
    const tx = makeTx({ fee_charged: '5000' }) // Fee spike
    const op = makeOp({ transaction_hash: tx.hash, amount: '10' })

    // Warm up the model first (resolves cold start/compilation overhead)
    await scoreTransaction(tx, [op], [tx], [op])

    // Benchmark the actual run
    const result = await scoreTransaction(tx, [op], [tx], [op])
    
    expect(result.anomalyScore).toBeGreaterThanOrEqual(0)
    expect(result.predictedClass).toBeDefined()
    expect(result.latencyMs).toBeLessThan(50)
    expect(result.explanations.length).toBeGreaterThan(0)
  })
})

