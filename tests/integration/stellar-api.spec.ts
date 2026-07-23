import { describe, it, expect } from 'vitest'
import {
  fetchXLMPrice,
  fetchAssetPrice,
  fundTestnetAccount,
  fetchAccount,
  fetchTransactions,
  fetchOperations,
  probeAllNetworks,
  calculateAccountReserves,
  getOperationLabel,
} from '../../src/lib/stellar'

describe('Stellar API integration (MSW)', () => {
  it('fetchXLMPrice returns XLM price from Coingecko', async () => {
    const price = await fetchXLMPrice()
    expect(price).toHaveProperty('usd')
    expect(price.usd).toBeCloseTo(0.5)
    expect(price.source).toBe('coingecko')
  })

  it('fetchAssetPrice returns midpoint estimate from order_book', async () => {
    const asset = { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER' }
    const estimate = await fetchAssetPrice(asset)
    expect(estimate).not.toBeNull()
    expect(estimate?.source).toBe('sdex')
    // midpoint of 0.1 and 0.2 is 0.15
    expect(estimate?.xlm).toBeCloseTo(0.15)
  })

  it('fundTestnetAccount calls friendbot and returns json', async () => {
    const res = await fundTestnetAccount('GTESTFRIENDBOT')
    expect(res).toHaveProperty('funded')
    expect((res as any).funded).toBeTruthy()
  })

  it('fetchAccount loads account data', async () => {
    const publicKey = 'GTESTACCOUNT'
    const account = await fetchAccount(publicKey)
    expect(account.account_id).toBe(publicKey)
    expect(account.balances?.length).toBeGreaterThan(0)
  })

  it('fetchTransactions and fetchOperations return records', async () => {
    const txs = await fetchTransactions('GTESTACCOUNT')
    expect(Array.isArray(txs.records)).toBe(true)
    expect(txs.records.length).toBeGreaterThan(0)

    const ops = await fetchOperations('GTESTACCOUNT')
    expect(Array.isArray(ops.records)).toBe(true)
    expect(ops.records.length).toBeGreaterThan(0)
  })

  it('probeAllNetworks returns probe results for configured networks', async () => {
    const results = await probeAllNetworks()
    expect(Array.isArray(results)).toBe(true)
    // Find testnet probe
    const testnet = results.find((r) => r.network === 'testnet')
    expect(testnet).toBeDefined()
    expect(testnet?.horizon.status).toBeDefined()
  })

  it('calculateAccountReserves returns sensible numbers', () => {
    const accountData: any = {
      account_id: 'GTEST',
      balances: [{ asset_type: 'native', balance: '100.0' }, { asset_type: 'credit_alphanum4' }],
      signers: [{ key: 'GTEST', weight: 1 }],
      subentry_count: 2,
    }

    const networkStats: any = { latestLedger: { base_reserve: '10000000' } }
    const reserves = calculateAccountReserves(accountData, networkStats, 1)
    // baseReserve should be 1 XLM
    expect(reserves.baseReserve).toBeCloseTo(1)
    expect(reserves.totalReserves).toBeGreaterThanOrEqual(1)
    expect(reserves.availableBalance).toBeGreaterThanOrEqual(0)
  })

  it('getOperationLabel falls back to title-case for unknown types', () => {
    const label = getOperationLabel('my_custom_op')
    expect(label).toBe('My Custom Op')
  })
})
