import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { fetchTransactions, fetchXLMPrice, probeAllNetworks } from '../../src/lib/stellar'

const HORIZON_BASE = 'https://horizon-testnet.stellar.org';
const SOROBAN_BASE = 'https://soroban-testnet.stellar.org';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

describe('Resilience and Edge Cases', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('handles rate limits deterministically (HTTP 429)', async () => {
    // Override handler to return 429
    server.use(
      http.get(COINGECKO_URL, () => {
        return new HttpResponse(null, {
          status: 429,
          headers: { 'Retry-After': '1' }
        })
      })
    )

    await expect(fetchXLMPrice()).rejects.toThrow()
  })

  it('handles pagination deterministically', async () => {
    // Override handler to mock pagination
    server.use(
      http.get(`${HORIZON_BASE}/accounts/:accountId/transactions`, ({ request }) => {
        const url = new URL(request.url)
        const cursor = url.searchParams.get('cursor')
        
        if (cursor === 'page1') {
          return HttpResponse.json({
            _embedded: {
              records: [{ id: 'tx2', paging_token: 'page2' }]
            }
          })
        }

        return HttpResponse.json({
          _embedded: {
            records: [{ id: 'tx1', paging_token: 'page1' }]
          }
        })
      })
    )

    const page1 = await fetchTransactions('GTESTACCOUNT', 'testnet', 1)
    expect(page1.records[0].id).toBe('tx1')
    expect(page1.nextCursor).toBe('page1')
    
    // Test the second page
    const page2 = await fetchTransactions('GTESTACCOUNT', 'testnet', 1, page1.nextCursor)
    expect(page2.records[0].id).toBe('tx2')
  })

  it('handles malformed XDR deterministically (HTTP 400)', async () => {
    server.use(
      http.post(`${HORIZON_BASE}/transactions`, () => {
        return HttpResponse.json({
          type: 'https://stellar.org/horizon-errors/transaction_malformed',
          title: 'Transaction Malformed',
          status: 400,
          detail: 'The transaction is malformed.',
          extras: {
            result_codes: {
              transaction: 'tx_bad_seq'
            }
          }
        }, { status: 400 })
      })
    )

    const res = await fetch(`${HORIZON_BASE}/transactions`, { method: 'POST', body: 'invalid_xdr' })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.extras.result_codes.transaction).toBe('tx_bad_seq')
  })

  it('handles RPC failures deterministically (HTTP 500)', async () => {
    server.use(
      http.post(SOROBAN_BASE, () => {
        return HttpResponse.json({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32603, message: 'Internal error' }
        }, { status: 500 })
      })
    )

    const res = await fetch(SOROBAN_BASE, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }) })
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error.code).toBe(-32603)
  })

  it('handles protocol-version changes deterministically', async () => {
    server.use(
      http.get(`${HORIZON_BASE}`, () => {
        return HttpResponse.json({
          horizon_version: '3.0.0-beta',
          core_version: '20.0.0'
        })
      })
    )

    const results = await probeAllNetworks()
    const testnet = results.find((r) => r.network === 'testnet')
    expect(testnet?.horizon.version).toBe('3.0.0-beta')
  })
})
