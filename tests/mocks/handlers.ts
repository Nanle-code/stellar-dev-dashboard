import { http, HttpResponse } from 'msw';
import { buildAccountFixture, buildLedgerFixture, buildTransactionsResponse } from '../__factories__';

const HORIZON_BASE = 'https://horizon-testnet.stellar.org';
const HORIZON_MAINNET = 'https://horizon.stellar.org';
const SOROBAN_BASE = 'https://soroban-testnet.stellar.org';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

const mockAccount = buildAccountFixture();
const mockTransactions = buildTransactionsResponse();
const mockLedger = buildLedgerFixture();

export const handlers = [
  // ── Coingecko XLM price ────────────────────────────────────────────────────
  http.get(COINGECKO_URL, () => {
    return HttpResponse.json({ stellar: { usd: 0.5, usd_24h_change: 1.2 } });
  }),

  // ── Friendbot / faucet ─────────────────────────────────────────────────────
  http.get(`${FRIENDBOT_URL}`, () => {
    return HttpResponse.json({ funded: true });
  }),

  // ── Order book (testnet) ───────────────────────────────────────────────────
  http.get(`${HORIZON_BASE}/order_book`, () => {
    return HttpResponse.json({
      bids: [{ price: '0.1', amount: '1000.0' }],
      asks: [{ price: '0.2', amount: '2000.0' }],
    });
  }),

  // ── Account endpoint ───────────────────────────────────────────────────────
  http.get(`${HORIZON_BASE}/accounts/:accountId`, ({ params }) => {
    return HttpResponse.json({
      ...mockAccount,
      id: params.accountId,
      account_id: params.accountId,
    });
  }),

  http.get(`${HORIZON_MAINNET}/accounts/:accountId`, ({ params }) => {
    return HttpResponse.json({
      ...mockAccount,
      id: params.accountId,
      account_id: params.accountId,
    });
  }),

  // ── Transactions ───────────────────────────────────────────────────────────
  http.get(`${HORIZON_BASE}/accounts/:accountId/transactions`, () => {
    return HttpResponse.json(mockTransactions);
  }),

  http.get(`${HORIZON_BASE}/transactions`, () => {
    return HttpResponse.json(mockTransactions);
  }),

  // ── Operations ─────────────────────────────────────────────────────────────
  http.get(`${HORIZON_BASE}/accounts/:accountId/operations`, () => {
    return HttpResponse.json({
      _embedded: { records: [{ id: 'op1', type: 'payment', paging_token: '1' }] },
    });
  }),

  // ── Ledgers ────────────────────────────────────────────────────────────────
  http.get(`${HORIZON_BASE}/ledgers/:sequence`, () => {
    return HttpResponse.json(mockLedger);
  }),

  http.get(`${HORIZON_BASE}/ledgers`, () => {
    return HttpResponse.json({
      _embedded: { records: [mockLedger] },
    });
  }),

  http.get(`${HORIZON_MAINNET}/ledgers`, () => {
    return HttpResponse.json({
      _embedded: { records: [mockLedger] },
    });
  }),

  // ── Fee stats ──────────────────────────────────────────────────────────────
  http.get(`${HORIZON_BASE}/fee_stats`, () => {
    return HttpResponse.json({
      last_ledger_base_fee: '100',
      min_accepted_fee: '100',
      median_accepted_fee: '150',
      p90_accepted_fee: '300',
    });
  }),

  // ── Soroban RPC probe ──────────────────────────────────────────────────────
  http.post(SOROBAN_BASE, () => {
    return HttpResponse.json({ jsonrpc: '2.0', id: 1, result: { status: 'healthy' } });
  }),

  // ── Generic Horizon HEAD probes (for probeAllNetworks) ────────────────────
  http.head(`${HORIZON_BASE}`, () => new HttpResponse(null, { status: 200 })),
  http.head(`${HORIZON_MAINNET}`, () => new HttpResponse(null, { status: 200 })),
  http.get(`${HORIZON_BASE}`, () => HttpResponse.json({ horizon_version: '2.0.0' })),
  http.get(`${HORIZON_MAINNET}`, () => HttpResponse.json({ horizon_version: '2.0.0' })),
];
