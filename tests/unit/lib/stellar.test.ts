// tests/unit/lib/stellar.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as stellar from '../../../src/lib/stellar'
import type { NetworkName } from '../../../src/lib/stellar'

// Mock Stellar SDK classes
vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual('@stellar/stellar-sdk')
  class MockHorizonServer {
    constructor(public url: string, public options?: any) {}
    loadAccount = vi.fn()
    transactions = vi.fn(() => this)
    operations = vi.fn(() => this)
    ledgers = vi.fn(() => this)
    feeStats = vi.fn()
    // chainable methods
    forAccount = vi.fn(() => this)
    order = vi.fn(() => this)
    limit = vi.fn(() => this)
    cursor = vi.fn(() => this)
    call = vi.fn()
    stream = vi.fn()
  }
  return {
    ...actual,
    Horizon: { Server: MockHorizonServer },
    SorobanRpc: { Server: MockHorizonServer },
    xdr: actual.xdr,
    Networks: actual.Networks,
  }
})

// Helper mock server
function createMockServer() {
  const server: any = new (vi.mocked(require('@stellar/stellar-sdk')).Horizon.Server)('https://example.com')
  return server
}

beforeEach(() => {
  // Reset cache between tests
  ;(stellar as any).stellarCache.clear?.()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchAccount', () => {
  it('should return account data from Horizon server', async () => {
    const mockAccount = { account_id: 'GABC', balances: [] }
    const mockServer = createMockServer()
    mockServer.loadAccount.mockResolvedValueOnce(mockAccount)
    ;(stellar as any).getServer = vi.fn(() => mockServer)

    const result = await stellar.fetchAccount('GABC', 'testnet')
    expect(result).toBe(mockAccount)
    expect(mockServer.loadAccount).toHaveBeenCalledOnce()
  })

  it('should cache account data and not call server again', async () => {
    const mockAccount = { account_id: 'GXYZ', balances: [] }
    const mockServer = createMockServer()
    mockServer.loadAccount.mockResolvedValueOnce(mockAccount)
    ;(stellar as any).getServer = vi.fn(() => mockServer)

    const first = await stellar.fetchAccount('GXYZ')
    const second = await stellar.fetchAccount('GXYZ')
    expect(first).toBe(mockAccount)
    expect(second).toBe(mockAccount)
    expect(mockServer.loadAccount).toHaveBeenCalledOnce()
  })

  it('should propagate errors from server', async () => {
    const mockServer = createMockServer()
    mockServer.loadAccount.mockRejectedValueOnce(new Error('network error'))
    ;(stellar as any).getServer = vi.fn(() => mockServer)

    await expect(stellar.fetchAccount('GFAIL')).rejects.toThrow('network error')
  })
})

describe('fetchXLMPrice', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    ;(stellar as any).stellarCache.clear?.()
  })
  afterEach(() => {
    // @ts-ignore
    global.fetch = originalFetch
  })

  it('fetches price from CoinGecko and caches result', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ stellar: { usd: 0.123 } }),
    }
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const price = await stellar.fetchXLMPrice()
    expect(price).toEqual({ usd: 0.123, source: 'coingecko' })
    expect(global.fetch).toHaveBeenCalledOnce()
    // Call again to test cache
    const cached = await stellar.fetchXLMPrice()
    expect(cached).toBe(price)
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('throws when response is not ok', async () => {
    const mockResponse = { ok: false, status: 500 }
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue(mockResponse)
    await expect(stellar.fetchXLMPrice()).rejects.toThrow('XLM price request failed')
  })

  it('throws when USD price is not a finite number', async () => {
    const mockResponse = { ok: true, json: async () => ({ stellar: { usd: null } }) }
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue(mockResponse)
    await expect(stellar.fetchXLMPrice()).rejects.toThrow('XLM price data unavailable')
  })
})

describe('getOperationLabel', () => {
  it('returns known label', () => {
    expect(stellar.getOperationLabel('payment')).toBe('Payment')
  })
  it('fallbacks to title case for unknown types', () => {
    expect(stellar.getOperationLabel('custom_op')).toBe('Custom Op')
  })
})
