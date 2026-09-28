import { rest } from 'msw'
import { NETWORKS } from '../../src/lib/stellar'

const COINGECKO_PATH = 'https://api.coingecko.com/api/v3/simple/price'

export const handlers = [
  // Coingecko XLM price
  rest.get(COINGECKO_PATH, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ stellar: { usd: 0.5 } }))
  }),

  // Horizon order_book endpoint for testnet
  rest.get(`${NETWORKS.testnet.horizonUrl}/order_book`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        bids: [{ price: '0.1' }],
        asks: [{ price: '0.2' }],
      }),
    )
  }),

  // Accounts endpoint
  rest.get(new RegExp(`${NETWORKS.testnet.horizonUrl}/accounts/.*`), (req, res, ctx) => {
    const url = req.url.pathname
    const id = url.split('/').pop()
    return res(
      ctx.status(200),
      ctx.json({
        account_id: id,
        subentry_count: 2,
        sequence: '1234567890',
        balances: [
          { asset_type: 'native', balance: '100.0' },
          { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER', balance: '50' },
        ],
        signers: [{ key: id, weight: 1 }],
      }),
    )
  }),

  // Transactions and operations list endpoints (simple fixtures)
  rest.get(new RegExp(`${NETWORKS.testnet.horizonUrl}/transactions.*`), (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ records: [{ id: 'tx1', paging_token: '1' }] }),
    )
  }),

  rest.get(new RegExp(`${NETWORKS.testnet.horizonUrl}/operations.*`), (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ records: [{ id: 'op1', type: 'payment', paging_token: '1' }] }),
    )
  }),

  // Friendbot faucet
  rest.get(new RegExp(`${NETWORKS.testnet.faucetUrl}.*`), (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ funded: true }))
  }),

  // Generic HEAD probe for horizon/soroban endpoints
  rest.head(/https?:\/\/.*(horizon|soroban).*$/i, (req, res, ctx) => {
    return res(ctx.status(200))
  }),
]

export default handlers
