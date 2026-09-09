/**
 * Unit tests for the AI-Powered Anomaly Explanation engine
 * Feature #591
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  explainPattern,
  explainPatterns,
  explainAnomalyScore,
} from '../anomalyExplanation/anomalyExplainer'
import type {
  ExplainerContext,
} from '../anomalyExplanation/anomalyExplainer'
import {
  buildAnomalyExplanations,
} from '../anomalyExplanation'
import type { DetectedPattern, AnomalyScore, StellarTransaction, StellarOperation } from '../transactionPatternAnalysis'

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

function makePattern(overrides: Partial<DetectedPattern> = {}): DetectedPattern {
  return {
    id: 'p-' + Math.random().toString(36).slice(2),
    title: 'Test Pattern',
    description: 'A test pattern description.',
    severity: 'warning',
    confidence: 0.8,
    affectedTxCount: 5,
    recommendation: 'Review the flagged transactions.',
    category: 'anomaly',
    ...overrides,
  }
}

function makeContext(
  txOverrides: Partial<StellarTransaction>[] = [],
  opOverrides: Partial<StellarOperation>[] = []
): ExplainerContext {
  const transactions = txOverrides.length
    ? txOverrides.map(o => makeTx(o))
    : [makeTx(), makeTx(), makeTx()]
  const operations = opOverrides.length
    ? opOverrides.map(o => makeOp(o))
    : [makeOp(), makeOp()]
  return { transactions, operations }
}

// ---------------------------------------------------------------------------
// explainPattern
// ---------------------------------------------------------------------------

describe('explainPattern', () => {
  it('returns an AnomalyExplanation with required fields', () => {
    const pattern = makePattern()
    const ctx = makeContext()
    const result = explainPattern(pattern, ctx)

    expect(result).toMatchObject({
      id: expect.stringContaining('exp-'),
      headline: expect.any(String),
      summary: expect.any(String),
      severity: pattern.severity,
      category: pattern.category,
      generatedAt: expect.any(String),
    })
    expect(result.actionItems).toBeInstanceOf(Array)
    expect(result.topFeatures).toBeInstanceOf(Array)
    expect(result.anomalyMagnitude).toBe(Math.round(pattern.confidence * 100))
  })

  it('uses pattern confidence as anomaly magnitude', () => {
    const pattern = makePattern({ confidence: 0.65 })
    const ctx = makeContext()
    const result = explainPattern(pattern, ctx)
    expect(result.anomalyMagnitude).toBe(65)
  })

  it('inherits severity from pattern', () => {
    const critical = makePattern({ severity: 'critical' })
    const info = makePattern({ severity: 'info' })
    const ctx = makeContext()
    expect(explainPattern(critical, ctx).severity).toBe('critical')
    expect(explainPattern(info, ctx).severity).toBe('info')
  })

  it('includes the pattern recommendation in action items', () => {
    const pattern = makePattern({ recommendation: 'Check your sequence numbers.' })
    const ctx = makeContext()
    const result = explainPattern(pattern, ctx)
    expect(result.actionItems.some(a => a.includes('Check your sequence numbers'))).toBe(true)
  })

  it('handles empty transaction context gracefully', () => {
    const pattern = makePattern()
    const ctx: ExplainerContext = { transactions: [], operations: [] }
    // Should not throw
    expect(() => explainPattern(pattern, ctx)).not.toThrow()
    const result = explainPattern(pattern, ctx)
    expect(result.headline).toBeTruthy()
  })

  it('produces high confidence for patterns with many features + high magnitude', () => {
    // High failure rate triggers 'Transaction Failure Rate' feature with high weight
    const txs = [
      makeTx({ successful: false }),
      makeTx({ successful: false }),
      makeTx({ successful: false }),
      makeTx({ successful: true }),
    ]
    const pattern = makePattern({ category: 'failure', confidence: 0.9 })
    const ctx: ExplainerContext = { transactions: txs, operations: [makeOp()] }
    const result = explainPattern(pattern, ctx)
    // Should be medium or high, never low for 90% confidence
    expect(['medium', 'high']).toContain(result.confidence)
  })
})

// ---------------------------------------------------------------------------
// Feature importance: failure rate
// ---------------------------------------------------------------------------

describe('explainPattern – failure rate feature', () => {
  it('detects high failure rate and adds it as a top feature', () => {
    // 4/5 failures = 80% failure rate, well above baseline of 5%
    const txs = [
      makeTx({ successful: false }),
      makeTx({ successful: false }),
      makeTx({ successful: false }),
      makeTx({ successful: false }),
      makeTx({ successful: true }),
    ]
    const pattern = makePattern({ category: 'failure' })
    const ctx: ExplainerContext = { transactions: txs, operations: [] }
    const result = explainPattern(pattern, ctx)

    const failureFeature = result.topFeatures.find(f => f.name === 'Transaction Failure Rate')
    expect(failureFeature).toBeDefined()
    expect(failureFeature!.direction).toBe('above_normal')
    expect(failureFeature!.weight).toBeGreaterThan(0)
  })

  it('does NOT add failure rate feature when rate is normal (≤ 5%)', () => {
    const txs = Array.from({ length: 20 }, (_, i) =>
      makeTx({ successful: i < 19 })
    )
    const pattern = makePattern({ category: 'failure' })
    const ctx: ExplainerContext = { transactions: txs, operations: [] }
    const result = explainPattern(pattern, ctx)

    const failureFeature = result.topFeatures.find(f => f.name === 'Transaction Failure Rate')
    expect(failureFeature).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Feature importance: fee spike
// ---------------------------------------------------------------------------

describe('explainPattern – fee spike feature', () => {
  it('detects fee spike when max fee is more than 3× median', () => {
    const txs = [
      makeTx({ fee_charged: '100' }),
      makeTx({ fee_charged: '100' }),
      makeTx({ fee_charged: '100' }),
      makeTx({ fee_charged: '5000' }), // 50× median
    ]
    const pattern = makePattern({ category: 'fee' })
    const ctx: ExplainerContext = { transactions: txs, operations: [] }
    const result = explainPattern(pattern, ctx)

    const feeFeature = result.topFeatures.find(f => f.name === 'Fee Spike')
    expect(feeFeature).toBeDefined()
    expect(feeFeature!.direction).toBe('above_normal')
  })

  it('does not flag fee spike when fees are uniform', () => {
    const txs = [
      makeTx({ fee_charged: '100' }),
      makeTx({ fee_charged: '120' }),
      makeTx({ fee_charged: '110' }),
    ]
    const pattern = makePattern({ category: 'fee' })
    const ctx: ExplainerContext = { transactions: txs, operations: [] }
    const result = explainPattern(pattern, ctx)

    const feeFeature = result.topFeatures.find(f => f.name === 'Fee Spike')
    expect(feeFeature).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// explainAnomalyScore
// ---------------------------------------------------------------------------

describe('explainAnomalyScore', () => {
  it('returns an explanation for a high anomaly score', () => {
    const score: AnomalyScore = { score: 75, label: 'High anomaly', color: 'var(--red)' }
    const ctx = makeContext()
    const result = explainAnomalyScore(score, ctx)

    expect(result.severity).toBe('critical') // 75 ≥ 70
    expect(result.headline).toBeTruthy()
    expect(result.summary).toBeTruthy()
  })

  it('assigns warning severity for mid-range score (40–69)', () => {
    const score: AnomalyScore = { score: 55, label: 'Moderate anomaly', color: 'var(--amber)' }
    const ctx = makeContext()
    const result = explainAnomalyScore(score, ctx)
    expect(result.severity).toBe('warning')
  })

  it('assigns info severity for low score (< 40)', () => {
    const score: AnomalyScore = { score: 20, label: 'Low anomaly', color: 'var(--green)' }
    const ctx = makeContext()
    const result = explainAnomalyScore(score, ctx)
    expect(result.severity).toBe('info')
  })

  it('id starts with exp-overall-', () => {
    const score: AnomalyScore = { score: 50, label: 'Moderate', color: 'var(--amber)' }
    const ctx = makeContext()
    const result = explainAnomalyScore(score, ctx)
    expect(result.id).toMatch(/^exp-overall-/)
  })
})

// ---------------------------------------------------------------------------
// explainPatterns (batch)
// ---------------------------------------------------------------------------

describe('explainPatterns', () => {
  it('returns an explanation for each pattern', () => {
    const patterns = [
      makePattern({ confidence: 0.9, severity: 'critical' }),
      makePattern({ confidence: 0.5, severity: 'warning' }),
      makePattern({ confidence: 0.3, severity: 'info' }),
    ]
    const ctx = makeContext()
    const results = explainPatterns(patterns, ctx)
    expect(results).toHaveLength(3)
  })

  it('sorts results by anomaly magnitude descending', () => {
    const patterns = [
      makePattern({ confidence: 0.3 }),
      makePattern({ confidence: 0.9 }),
      makePattern({ confidence: 0.6 }),
    ]
    const ctx = makeContext()
    const results = explainPatterns(patterns, ctx)
    expect(results[0].anomalyMagnitude).toBe(90)
    expect(results[1].anomalyMagnitude).toBe(60)
    expect(results[2].anomalyMagnitude).toBe(30)
  })

  it('returns empty array for empty input', () => {
    const ctx = makeContext()
    expect(explainPatterns([], ctx)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// buildAnomalyExplanations (integration)
// ---------------------------------------------------------------------------

describe('buildAnomalyExplanations', () => {
  it('returns correct count and flags hasHighConfidence', () => {
    const patterns = [makePattern({ confidence: 0.95, severity: 'critical' })]
    const anomalyScore: AnomalyScore = { score: 75, label: 'High', color: 'var(--red)' }
    const ctx = makeContext()
    const set = buildAnomalyExplanations(patterns, anomalyScore, ctx)

    // 1 pattern explanation + 1 overall explanation
    expect(set.count).toBe(2)
    expect(set.patternExplanations).toHaveLength(1)
    expect(set.overallExplanation).not.toBeNull()
    expect(typeof set.hasHighConfidence).toBe('boolean')
    expect(set.generatedAt).toBeTruthy()
  })

  it('omits overall explanation for low anomaly scores (< 30)', () => {
    const patterns = [makePattern({ confidence: 0.5 })]
    const anomalyScore: AnomalyScore = { score: 10, label: 'Low', color: 'var(--green)' }
    const ctx = makeContext()
    const set = buildAnomalyExplanations(patterns, anomalyScore, ctx)

    expect(set.overallExplanation).toBeNull()
    expect(set.count).toBe(1)
  })

  it('returns 0 count when no patterns and score < 30', () => {
    const anomalyScore: AnomalyScore = { score: 5, label: 'Normal', color: 'var(--green)' }
    const ctx = makeContext()
    // buildAnomalyExplanations expects this to produce an empty set
    const set = buildAnomalyExplanations([], anomalyScore, ctx)
    expect(set.count).toBe(0)
    expect(set.patternExplanations).toHaveLength(0)
    expect(set.overallExplanation).toBeNull()
  })

  it('applies feedback-adjusted confidence (no throw with fresh store)', () => {
    const patterns = [makePattern()]
    const anomalyScore: AnomalyScore = { score: 50, label: 'Medium', color: 'var(--amber)' }
    const ctx = makeContext()
    // Should not throw even with empty feedback store
    expect(() => buildAnomalyExplanations(patterns, anomalyScore, ctx)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Explanation content quality checks
// ---------------------------------------------------------------------------

describe('explanation content quality', () => {
  it('headline is concise (≤ 80 chars)', () => {
    const pattern = makePattern()
    const ctx = makeContext()
    const result = explainPattern(pattern, ctx)
    expect(result.headline.length).toBeLessThanOrEqual(80)
  })

  it('summary is non-empty and longer than headline', () => {
    const pattern = makePattern()
    const ctx = makeContext()
    const result = explainPattern(pattern, ctx)
    expect(result.summary.length).toBeGreaterThan(result.headline.length)
  })

  it('action items are unique (no duplicates)', () => {
    const pattern = makePattern()
    const ctx = makeContext()
    const result = explainPattern(pattern, ctx)
    const unique = new Set(result.actionItems)
    expect(unique.size).toBe(result.actionItems.length)
  })

  it('technicalContext contains transaction count', () => {
    const txs = [makeTx(), makeTx(), makeTx()]
    const pattern = makePattern()
    const ctx: ExplainerContext = { transactions: txs, operations: [] }
    const result = explainPattern(pattern, ctx)
    expect(result.technicalContext).toContain('3')
  })

  it('generatedAt is a valid ISO timestamp', () => {
    const pattern = makePattern()
    const ctx = makeContext()
    const result = explainPattern(pattern, ctx)
    expect(() => new Date(result.generatedAt)).not.toThrow()
    expect(new Date(result.generatedAt).getFullYear()).toBeGreaterThan(2020)
  })
})
