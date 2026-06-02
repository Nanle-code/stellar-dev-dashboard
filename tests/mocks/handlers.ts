import { http, HttpResponse } from 'msw';
import { buildAccountFixture, buildLedgerFixture, buildTransactionsResponse } from '../__factories__';

const HORIZON_BASE = 'https://horizon-testnet.stellar.org';

const mockAccount = buildAccountFixture();
const mockTransactions = buildTransactionsResponse();
const mockLedger = buildLedgerFixture();

export const handlers = [
  // Account endpoint
  http.get(`${HORIZON_BASE}/accounts/:accountId`, ({ params }) => {
    return HttpResponse.json({ ...mockAccount, id: params.accountId, account_id: params.accountId });
  }),

  // Transactions for an account
  http.get(`${HORIZON_BASE}/accounts/:accountId/transactions`, () => {
    return HttpResponse.json(mockTransactions);
  }),

  // Latest ledger
  http.get(`${HORIZON_BASE}/ledgers/:sequence`, () => {
    return HttpResponse.json(mockLedger);
  }),

  // Ledger list
  http.get(`${HORIZON_BASE}/ledgers`, () => {
    return HttpResponse.json({
      _embedded: { records: [mockLedger] },
    });
  }),

  // Operations for an account
  http.get(`${HORIZON_BASE}/accounts/:accountId/operations`, () => {
    return HttpResponse.json({ _embedded: { records: [] } });
  }),
];
