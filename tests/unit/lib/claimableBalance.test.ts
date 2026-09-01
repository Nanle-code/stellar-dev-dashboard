import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the Stellar SDK so the unit tests for the pure predicate/balance helpers
// don't depend on the (heavy, environment-sensitive) SDK bundle.
vi.mock('@stellar/stellar-sdk', () => {
  const Networks = {
    PUBLIC: 'Public Global Stellar Network ; September 2015',
    TESTNET: 'Test SDF Network ; September 2015',
    FUTURENET: 'Future Network ; future',
    LOCAL: 'Local Network ; local',
    CUSTOM: 'Custom Network ; custom',
  }
  class Asset {
    code: string
    issuer?: string
    constructor(code: string, issuer?: string) {
      this.code = code
      this.issuer = issuer
    }
    static native() {
      return new Asset('XLM')
    }
  }
  return {
    Networks,
    Asset,
    Keypair: { fromSecret: () => ({}), random: () => ({}) },
    Operation: {},
    TransactionBuilder: class {},
    Memo: {},
    xdr: {},
    Horizon: { Server: class {} },
    SorobanRpc: { Server: class {} },
  }
})

import {
  explainClaimPredicate,
  buildClaimPredicate,
  fetchClaimableBalanceById,
} from '../../../src/lib/stellar'
import type { PredicateSpec } from '../../../src/lib/stellar'

const NOW = Date.parse('2026-01-01T00:00:00Z')

describe('explainClaimPredicate — primary flow', () => {
  it('explains an unconditional predicate as always claimable', () => {
    const e = explainClaimPredicate({ unconditional: null }, NOW)
    expect(e.kind).toBe('unconditional')
    expect(e.claimableNow).toBe(true)
    expect(e.claimableAt).toBeNull()
  })

  it('treats null / non-object / empty predicates as unconditional', () => {
    expect(explainClaimPredicate(null, NOW).kind).toBe('unconditional')
    expect(explainClaimPredicate('oops', NOW).kind).toBe('unconditional')
    expect(explainClaimPredicate({}, NOW).kind).toBe('unconditional')
  })

  it('explains abs_before as not claimable once the deadline passed', () => {
    const e = explainClaimPredicate({ abs_before: '2025-01-01T00:00:00Z' }, NOW)
    expect(e.kind).toBe('abs_before')
    expect(e.claimableNow).toBe(false)
  })

  it('explains abs_before as claimable before the deadline', () => {
    const e = explainClaimPredicate({ abs_before: '2027-01-01T00:00:00Z' }, NOW)
    expect(e.claimableNow).toBe(true)
  })

  it('explains abs_after and reports claimableAt', () => {
    const e = explainClaimPredicate({ abs_after: '2025-01-01T00:00:00Z' }, NOW)
    expect(e.kind).toBe('abs_after')
    expect(e.claimableNow).toBe(true)
    expect(e.claimableAt).toBe(Date.parse('2025-01-01T00:00:00Z'))
  })

  it('explains rel_before as indeterminate', () => {
    const e = explainClaimPredicate({ rel_before: 86400 }, NOW)
    expect(e.kind).toBe('rel_before')
    expect(e.claimableNow).toBeNull()
  })
})

describe('explainClaimPredicate — boundary (compound predicates)', () => {
  it('AND is claimable only when every child is claimable', () => {
    const ok = explainClaimPredicate(
      { and: [{ abs_after: '2025-01-01T00:00:00Z' }, { abs_before: '2030-01-01T00:00:00Z' }] },
      NOW,
    )
    expect(ok.kind).toBe('and')
    expect(ok.claimableNow).toBe(true)
    expect(ok.children).toHaveLength(2)

    const blocked = explainClaimPredicate(
      { and: [{ abs_after: '2025-01-01T00:00:00Z' }, { abs_before: '2020-01-01T00:00:00Z' }] },
      NOW,
    )
    expect(blocked.claimableNow).toBe(false)
  })

  it('OR is claimable when any child is claimable', () => {
    const ok = explainClaimPredicate(
      { or: [{ abs_before: '2020-01-01T00:00:00Z' }, { abs_after: '2025-01-01T00:00:00Z' }] },
      NOW,
    )
    expect(ok.kind).toBe('or')
    expect(ok.claimableNow).toBe(true)

    const none = explainClaimPredicate(
      { or: [{ abs_before: '2020-01-01T00:00:00Z' }, { abs_before: '2021-01-01T00:00:00Z' }] },
      NOW,
    )
    expect(none.claimableNow).toBe(false)
  })

  it('NOT inverts claimableNow (and preserves null)', () => {
    const inverted = explainClaimPredicate({ not: { abs_before: '2020-01-01T00:00:00Z' } }, NOW)
    expect(inverted.kind).toBe('not')
    expect(inverted.claimableNow).toBe(true) // inner false → not true

    const fromUnknown = explainClaimPredicate({ not: { weird: 1 } }, NOW)
    expect(fromUnknown.claimableNow).toBeNull()
  })

  it('returns an unknown kind with a stringified summary for unrecognized shapes', () => {
    const e = explainClaimPredicate({ somethingElse: 1 }, NOW)
    expect(e.kind).toBe('unknown')
    expect(typeof e.summary).toBe('string')
  })
})

describe('buildClaimPredicate — primary flow', () => {
  it('builds unconditional', () => {
    expect(buildClaimPredicate({ type: 'unconditional' })).toEqual({ unconditional: null })
  })
  it('builds absolute-before from a Date', () => {
    const iso = new Date('2030-01-01T00:00:00Z').toISOString()
    expect(buildClaimPredicate({ type: 'before', date: new Date('2030-01-01T00:00:00Z') })).toEqual({ abs_before: iso })
  })
  it('builds absolute-after from a string', () => {
    const iso = new Date('2030-01-01T00:00:00Z').toISOString()
    expect(buildClaimPredicate({ type: 'after', date: '2030-01-01T00:00:00Z' })).toEqual({ abs_after: iso })
  })
  it('builds relative', () => {
    expect(buildClaimPredicate({ type: 'relative', seconds: 86400 })).toEqual({ rel_before: 86400 })
  })
})

describe('buildClaimPredicate — boundary & failure paths', () => {
  it('builds and/or with two or more predicates', () => {
    const and: PredicateSpec = { type: 'and', predicates: [{ type: 'unconditional' }, { type: 'relative', seconds: 1 }] }
    expect(buildClaimPredicate(and)).toEqual({ and: [{ unconditional: null }, { rel_before: 1 }] })
    const or: PredicateSpec = { type: 'or', predicates: [{ type: 'unconditional' }, { type: 'relative', seconds: 1 }] }
    expect(buildClaimPredicate(or)).toEqual({ or: [{ unconditional: null }, { rel_before: 1 }] })
  })

  it('builds not', () => {
    expect(buildClaimPredicate({ type: 'not', predicate: { type: 'unconditional' } })).toEqual({
      not: { unconditional: null },
    })
  })

  it('throws TypeError on an invalid date', () => {
    expect(() => buildClaimPredicate({ type: 'before', date: 'not-a-date' })).toThrow(TypeError)
    expect(() => buildClaimPredicate({ type: 'after', date: '' })).toThrow(TypeError)
  })

  it('throws TypeError on a non-positive relative time', () => {
    expect(() => buildClaimPredicate({ type: 'relative', seconds: 0 })).toThrow(TypeError)
    expect(() => buildClaimPredicate({ type: 'relative', seconds: -5 })).toThrow(TypeError)
  })

  it('throws TypeError on and/or with fewer than two predicates', () => {
    expect(() => buildClaimPredicate({ type: 'and', predicates: [{ type: 'unconditional' }] })).toThrow(TypeError)
  })

  it('throws TypeError on an unknown predicate type', () => {
    expect(() => buildClaimPredicate({ type: 'wat' } as unknown as PredicateSpec)).toThrow(TypeError)
  })

  it('throws TypeError when spec is not an object', () => {
    expect(() => buildClaimPredicate(null as unknown as PredicateSpec)).toThrow(TypeError)
  })
})

describe('fetchClaimableBalanceById', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws TypeError for an empty balanceId (invalid input)', async () => {
    await expect(fetchClaimableBalanceById('', 'testnet')).rejects.toBeInstanceOf(TypeError)
  })

  it('throws for an unsupported network without calling fetch', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    await expect(fetchClaimableBalanceById('0000', 'notarealnet' as never)).rejects.toThrow(/unsupported/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the record on a successful Horizon response (primary flow)', async () => {
    const record = { id: '0001', asset: 'native', amount: '10', sponsor: 'GSPONSOR', last_modified_ledger: 5, claimants: [] }
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => record,
    })
    const result = await fetchClaimableBalanceById('0001', 'testnet')
    expect(result).toEqual(record)
    const calledUrl = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('/claimable_balances/0001')
  })

  it('throws a not-found error on 404 (failure path)', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    await expect(fetchClaimableBalanceById('missing', 'testnet')).rejects.toThrow(/not found/i)
  })

  it('throws a Horizon error on other non-ok statuses (failure path)', async () => {
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    await expect(fetchClaimableBalanceById('x', 'testnet')).rejects.toThrow(/Horizon error 500/)
  })
})
