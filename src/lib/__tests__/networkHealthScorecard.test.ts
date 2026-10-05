import { describe, expect, it, vi } from 'vitest'
import {
  computeHealthScore,
  buildComparativeHealthReport,
  buildHealthCaveats,
  SCORECARD_NETWORKS,
} from '../networkHealthScorecard'

const NOW = Date.parse('2026-09-01T12:00:00Z')

function healthyInput(network: 'mainnet' | 'testnet' = 'mainnet') {
  return {
    network,
    latestLedgerSequence: 55_000_000,
    latestLedgerClosedAt: new Date(NOW - 4_000).toISOString(), // 4s old → fresh
    baseFeeStroops: 100,
    operationCount: 120,
    successfulTransactionCount: 180,
    failedTransactionCount: 2,
  }
}

describe('computeHealthScore', () => {
  it('scores a healthy mainnet snapshot in the healthy band', () => {
    const result = computeHealthScore(healthyInput(), { now: NOW })

    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.grade).toBe('healthy')
    expect(result.indicators.map((i) => i.key)).toEqual(['freshness', 'successRate', 'feePressure', 'throughput'])
    expect(result.warnings).toHaveLength(0)
  })

  it('rejects unsupported networks instead of scoring them silently', () => {
    expect(() => computeHealthScore({ ...(healthyInput() as any), network: 'futurenet' })).toThrow(/unsupported/i)
  })

  it('rejects non-object input with a clear error', () => {
    expect(() => computeHealthScore(null as any)).toThrow(/must be an object/i)
    expect(() => computeHealthScore('ledger' as any)).toThrow(/must be an object/i)
  })

  it('handles missing fields as neutral instead of crashing', () => {
    const result = computeHealthScore({ network: 'testnet' }, { now: NOW })

    expect(result.score).toBeGreaterThan(0)
    expect(result.indicators.every((i) => i.value === 'unknown' || i.subScore === 50 || i.key === 'freshness')).toBe(true)
    expect(result.warnings.length).toBeGreaterThanOrEqual(3)
  })

  it('flags a stale ledger at the boundary (60s) as critical freshness', () => {
    const stale = { ...healthyInput(), latestLedgerClosedAt: new Date(NOW - 61_000).toISOString() }
    const result = computeHealthScore(stale, { now: NOW })

    const freshness = result.indicators.find((i) => i.key === 'freshness')!
    expect(freshness.subScore).toBe(0)
    expect(result.warnings.some((w) => w.includes('stale'))).toBe(true)
  })

  it('keeps a ledger exactly at 15s fully fresh (boundary)', () => {
    const edge = { ...healthyInput(), latestLedgerClosedAt: new Date(NOW - 15_000).toISOString() }
    const result = computeHealthScore(edge, { now: NOW })

    expect(result.indicators.find((i) => i.key === 'freshness')!.subScore).toBe(100)
  })

  it('penalizes a base fee below the 100 stroop minimum as invalid data', () => {
    const bad = { ...healthyInput(), baseFeeStroops: 50 }
    const result = computeHealthScore(bad, { now: NOW })

    expect(result.indicators.find((i) => i.key === 'feePressure')!.subScore).toBe(50)
    expect(result.warnings.some((w) => w.includes('below the protocol minimum'))).toBe(true)
  })

  it('degrades smoothly as base fee rises past the congestion boundary (1000 stroops)', () => {
    const atBoundary = computeHealthScore({ ...healthyInput(), baseFeeStroops: 1000 }, { now: NOW })
    const beyond = computeHealthScore({ ...healthyInput(), baseFeeStroops: 5000 }, { now: NOW })

    expect(atBoundary.indicators.find((i) => i.key === 'feePressure')!.subScore).toBe(100)
    const beyondScore = beyond.indicators.find((i) => i.key === 'feePressure')!.subScore
    expect(beyondScore).toBeGreaterThan(0)
    expect(beyondScore).toBeLessThan(100)
  })

  it('clamps invalid numeric strings to neutral instead of producing NaN scores', () => {
    const result = computeHealthScore(
      { ...healthyInput(), baseFeeStroops: 'not-a-number', operationCount: NaN },
      { now: NOW },
    )

    expect(Number.isFinite(result.score)).toBe(true)
  })

  it('handles a 100% failure rate as a zero success-rate sub-score that drags the composite down', () => {
    const failing = { ...healthyInput(), successfulTransactionCount: 0, failedTransactionCount: 210 }
    const result = computeHealthScore(failing, { now: NOW })
    const baseline = computeHealthScore(healthyInput(), { now: NOW })

    expect(result.indicators.find((i) => i.key === 'successRate')!.subScore).toBe(0)
    expect(result.score).toBeLessThan(baseline.score - 20)
    expect(result.grade).not.toBe('healthy')
  })
})

describe('buildComparativeHealthReport', () => {
  it('compares mainnet and testnet side by side with a delta and leader (primary flow)', async () => {
    const fetchHealth = vi.fn(async (network: 'mainnet' | 'testnet') =>
      network === 'mainnet' ? healthyInput('mainnet') : { ...healthyInput('testnet'), baseFeeStroops: 3000 },
    )

    const report = await buildComparativeHealthReport(fetchHealth, undefined, { now: NOW })

    expect(report.mainnet.ok).toBe(true)
    expect(report.testnet.ok).toBe(true)
    expect(report.leader).toBe('mainnet')
    expect(report.delta).toBeGreaterThan(0)
    expect(report.insights.join(' ')).toMatch(/Mainnet scores \d+\/100/)
    expect(report.caveats.some((c) => c.includes('Testnet XLM has no monetary value'))).toBe(true)
  })

  it('captures a per-network fetch failure without hiding the other scorecard', async () => {
    const fetchHealth = vi.fn(async (network: 'mainnet' | 'testnet') => {
      if (network === 'mainnet') throw new Error('Horizon unreachable')
      return healthyInput('testnet')
    })

    const report = await buildComparativeHealthReport(fetchHealth)

    expect(report.mainnet.ok).toBe(false)
    expect(report.mainnet.error).toMatch(/Horizon unreachable/)
    expect(report.testnet.ok).toBe(true)
    expect(report.delta).toBeUndefined()
    expect(report.leader).toBeNull()
    expect(report.insights.join(' ')).toMatch(/partial/i)
    expect(report.caveats.some((c) => c.includes('Mainnet scorecard unavailable'))).toBe(true)
  })

  it('captures invalid per-network input as an error entry, not a throw', async () => {
    const fetchHealth = async (network: 'mainnet' | 'testnet') =>
      network === 'testnet' ? ({ network: 'soroban-testnet' } as any) : healthyInput('mainnet')

    const report = await buildComparativeHealthReport(fetchHealth)

    expect(report.testnet.ok).toBe(false)
    expect(report.testnet.error).toMatch(/unsupported/i)
    expect(report.mainnet.ok).toBe(true)
  })

  it('rejects unsupported network lists up front', async () => {
    await expect(
      buildComparativeHealthReport(async () => healthyInput(), ['mainnet', 'futurenet' as any]),
    ).rejects.toThrow(/unsupported/i)
  })

  it('defaults to mainnet + testnet when no network list is provided', async () => {
    const fetchHealth = vi.fn(async (network: 'mainnet' | 'testnet') => healthyInput(network))
    const report = await buildComparativeHealthReport(fetchHealth, undefined, { now: NOW })

    expect(fetchHealth).toHaveBeenCalledTimes(2)
    expect(SCORECARD_NETWORKS).toEqual(['mainnet', 'testnet'])
    expect(report.mainnet.network).toBe('mainnet')
    expect(report.testnet.network).toBe('testnet')
  })

  it('treats equal scores as a tie with no leader', async () => {
    const report = await buildComparativeHealthReport(async (network) => healthyInput(network), undefined, { now: NOW })

    expect(report.delta).toBe(0)
    expect(report.leader).toBeNull()
    expect(report.insights.join(' ')).toMatch(/tied/i)
  })
})

describe('buildHealthCaveats', () => {
  it('always includes the standing cross-network semantics caveats', async () => {
    const report = await buildComparativeHealthReport(async (network) => healthyInput(network), undefined, { now: NOW })
    const caveats = buildHealthCaveats(report)

    expect(caveats.length).toBeGreaterThanOrEqual(2)
    expect(caveats.some((c) => c.includes('not directly comparable'))).toBe(true)
  })

  it('propagates per-network warnings into caveats', async () => {
    const report = await buildComparativeHealthReport(async (network) =>
      network === 'mainnet'
        ? { ...healthyInput(), latestLedgerClosedAt: new Date(NOW - 120_000).toISOString() }
        : healthyInput('testnet'),
      undefined,
      { now: NOW },
    )

    expect(report.caveats.some((c) => c.startsWith('Mainnet: Latest ledger is stale'))).toBe(true)
  })
})
