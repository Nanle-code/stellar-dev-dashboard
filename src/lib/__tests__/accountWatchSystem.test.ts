/**
 * Tests for the Advanced Account Watch System
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AccountSnapshot, WatchRule } from '../../types/accountWatch'
import {
  aggregateBalances,
  detectAnomalies,
  evaluateWatchRules,
  normalizeBalances,
  AccountWatchSystem,
} from '../accountWatchSystem'
import * as stellar from '../stellar'

vi.mock('../stellar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stellar')>()
  return {
    ...actual,
    fetchAccount: vi.fn(),
  }
})

function snapshot(
  address: string,
  balances: AccountSnapshot['balances'],
  error?: string,
): AccountSnapshot {
  return {
    address,
    fetchedAt: 0,
    balances,
    xlmBalance: balances.find((b) => b.assetCode === 'XLM')?.balance ?? 0,
    error,
  }
}

describe('normalizeBalances', () => {
  it('maps native to XLM and parses numeric balances', () => {
    const result = normalizeBalances([
      { asset_type: 'native', balance: '100.5' },
      { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER', balance: '42' },
    ])
    expect(result).toEqual([
      { assetCode: 'XLM', assetIssuer: undefined, balance: 100.5 },
      { assetCode: 'USDC', assetIssuer: 'GISSUER', balance: 42 },
    ])
  })
})

describe('aggregateBalances', () => {
  it('rolls balances up across accounts and counts health', () => {
    const snaps = [
      snapshot('A', [{ assetCode: 'XLM', balance: 100 }, { assetCode: 'USDC', balance: 10 }]),
      snapshot('B', [{ assetCode: 'XLM', balance: 50 }]),
      snapshot('C', [], 'not found'),
    ]

    const insights = aggregateBalances(snaps)

    expect(insights.totalAccounts).toBe(3)
    expect(insights.healthyAccounts).toBe(2)
    expect(insights.erroredAccounts).toBe(1)
    expect(insights.totalXlm).toBe(150)
    const xlm = insights.balancesByAsset.find((b) => b.assetCode === 'XLM')
    expect(xlm).toMatchObject({ total: 150, accountCount: 2 })
  })
})

describe('evaluateWatchRules', () => {
  const rules: WatchRule[] = [
    { id: 'r1', kind: 'balance_below', assetCode: 'XLM', threshold: 100, enabled: true },
  ]

  it('fires balance_below when under threshold', () => {
    const alerts = evaluateWatchRules(rules, [snapshot('A', [{ assetCode: 'XLM', balance: 50 }])])
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ accountAddress: 'A', kind: 'balance_below', level: 'warning' })
  })

  it('does not fire when at/above threshold', () => {
    const alerts = evaluateWatchRules(rules, [snapshot('A', [{ assetCode: 'XLM', balance: 150 }])])
    expect(alerts).toHaveLength(0)
  })

  it('skips disabled rules and errored snapshots', () => {
    const disabled = [{ ...rules[0], enabled: false }]
    expect(evaluateWatchRules(disabled, [snapshot('A', [{ assetCode: 'XLM', balance: 1 }])])).toHaveLength(0)
    expect(evaluateWatchRules(rules, [snapshot('A', [], 'err')])).toHaveLength(0)
  })

  it('fires balance_change_pct against the previous snapshot', () => {
    const changeRule: WatchRule[] = [
      { id: 'r2', kind: 'balance_change_pct', assetCode: 'XLM', threshold: 50, enabled: true },
    ]
    const previous = new Map([['A', snapshot('A', [{ assetCode: 'XLM', balance: 100 }])]])
    const alerts = evaluateWatchRules(changeRule, [snapshot('A', [{ assetCode: 'XLM', balance: 20 }])], previous)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe('balance_change_pct')
  })

  it('honors a per-account rule scope', () => {
    const scoped: WatchRule[] = [{ ...rules[0], accountAddress: 'B' }]
    const snaps = [snapshot('A', [{ assetCode: 'XLM', balance: 1 }]), snapshot('B', [{ assetCode: 'XLM', balance: 1 }])]
    const alerts = evaluateWatchRules(scoped, snaps)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].accountAddress).toBe('B')
  })
})

describe('detectAnomalies', () => {
  it('flags large swings against the previous snapshot', () => {
    const previous = new Map([['A', snapshot('A', [{ assetCode: 'XLM', balance: 100 }])]])
    const anomalies = detectAnomalies([snapshot('A', [{ assetCode: 'XLM', balance: 10 }])], previous, 50)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({ accountAddress: 'A', assetCode: 'XLM', previous: 100, current: 10 })
    expect(anomalies[0].changePct).toBeCloseTo(-90)
  })

  it('ignores small changes and missing history', () => {
    const previous = new Map([['A', snapshot('A', [{ assetCode: 'XLM', balance: 100 }])]])
    expect(detectAnomalies([snapshot('A', [{ assetCode: 'XLM', balance: 95 }])], previous, 50)).toHaveLength(0)
    expect(detectAnomalies([snapshot('Z', [{ assetCode: 'XLM', balance: 0 }])], previous, 50)).toHaveLength(0)
  })
})

describe('AccountWatchSystem', () => {
  const VALID = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof localStorage !== 'undefined') localStorage.clear()
    vi.spyOn(stellar, 'isValidPublicKey').mockImplementation((k) => k.startsWith('G'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects invalid and duplicate accounts', () => {
    const sys = new AccountWatchSystem()
    expect(sys.addAccount('bad')).toBe(false)
    expect(sys.addAccount(VALID)).toBe(true)
    expect(sys.addAccount(VALID)).toBe(false)
    expect(sys.getAccounts()).toHaveLength(1)
  })

  it('refreshes with bounded concurrency and aggregates results', async () => {
    const fetchAccount = vi.mocked(stellar.fetchAccount)
    fetchAccount.mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '25' }],
    } as never)

    const sys = new AccountWatchSystem({ concurrency: 4 })
    for (let i = 0; i < 10; i++) sys.addAccount(`G${i}`)

    const update = await sys.refresh()

    expect(fetchAccount).toHaveBeenCalledTimes(10)
    expect(update.insights.healthyAccounts).toBe(10)
    expect(update.insights.totalXlm).toBe(250)
  })

  it('captures per-account fetch errors without failing the refresh', async () => {
    const fetchAccount = vi.mocked(stellar.fetchAccount)
    fetchAccount.mockRejectedValue(new Error('not found'))

    const sys = new AccountWatchSystem()
    sys.addAccount(VALID)
    const update = await sys.refresh()

    expect(update.insights.erroredAccounts).toBe(1)
    expect(update.snapshots[0].error).toBe('not found')
  })

  it('notifies subscribers on refresh', async () => {
    vi.mocked(stellar.fetchAccount).mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '5' }],
    } as never)
    const sys = new AccountWatchSystem()
    sys.addAccount(VALID)
    const listener = vi.fn()
    sys.subscribe(listener)
    await sys.refresh()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
