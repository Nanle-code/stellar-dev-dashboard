/**
 * Mock data and test scenario fixtures for contract testing both Horizon and RPC read sources (#971).
 */

export const MOCK_LEDGER_FIXTURE = {
  sequence: 524100,
  hash: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
  closeTime: '2026-09-26T12:00:00Z',
  successfulTransactionCount: 42,
  failedTransactionCount: 3,
  operationCount: 156,
};

export const MOCK_TRANSACTION_FIXTURE = {
  hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
  ledger: 524100,
  createdAt: '2026-09-26T12:00:00Z',
  sourceAccount: 'GBZC6Y2Y7Q3ZQ2Y4QZJ2XZ3Z5YXZ6Z7Z2Y4QZJ2XZ3Z5YXZ6Z7Z2Y4',
  feePaid: '100',
  operationCount: 2,
  envelopeXdr: 'AAAAAgAAAAC1...',
  resultXdr: 'AAAAAAAAAGQ...',
  resultMetaXdr: 'AAAAAQAAAAE...',
  status: 'SUCCESS' as const,
};

export const MOCK_EVENT_FIXTURE = {
  id: '0000524100-0000000001-0000000000',
  type: 'contract' as const,
  ledger: 524100,
  ledgerClosedAt: '2026-09-26T12:00:00Z',
  contractId: 'CCJZ5DGASBWQXR5MPFCJXMBI333XE5U3FSJTNQU7RIKE3P5GN2K2WYD5',
  topic: ['transfer', 'GBZC6Y2Y7Q3ZQ2Y4QZJ2XZ3Z5YXZ6Z7Z2Y4QZJ2XZ3Z5YXZ6Z7Z2Y4'],
  value: { amount: '1000000' },
  txHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
  pagingToken: '524100-1',
};

export const MOCK_OFFER_FIXTURE = {
  id: '123456',
  seller: 'GBZC6Y2Y7Q3ZQ2Y4QZJ2XZ3Z5YXZ6Z7Z2Y4QZJ2XZ3Z5YXZ6Z7Z2Y4',
  sellingAsset: 'XLM',
  buyingAsset: 'USDC:GA5ZSEJYB37JRC5AVCIA5XYKX4G5AVJJELDNXY655GS7G7OJ37C3T5L3',
  amount: '100.0000000',
  price: '0.1250000',
  lastModifiedLedger: 524090,
  source: 'horizon' as const,
};

export const HORIZON_RECORDS_FIXTURE = {
  ledgers: [
    {
      sequence: 524100,
      hash: MOCK_LEDGER_FIXTURE.hash,
      closed_at: MOCK_LEDGER_FIXTURE.closeTime,
      successful_transaction_count: 42,
      failed_transaction_count: 3,
      operation_count: 156,
      paging_token: '524100',
    },
    {
      sequence: 524099,
      hash: '8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e',
      closed_at: '2026-09-26T11:59:55Z',
      successful_transaction_count: 38,
      failed_transaction_count: 1,
      operation_count: 120,
      paging_token: '524099',
    },
  ],
  transactions: [
    {
      hash: MOCK_TRANSACTION_FIXTURE.hash,
      ledger_attr: MOCK_TRANSACTION_FIXTURE.ledger,
      created_at: MOCK_TRANSACTION_FIXTURE.createdAt,
      successful: true,
      source_account: MOCK_TRANSACTION_FIXTURE.sourceAccount,
      fee_charged: '100',
      operation_count: 2,
      envelope_xdr: MOCK_TRANSACTION_FIXTURE.envelopeXdr,
      result_xdr: MOCK_TRANSACTION_FIXTURE.resultXdr,
      result_meta_xdr: MOCK_TRANSACTION_FIXTURE.resultMetaXdr,
      paging_token: '524100-1',
    },
  ],
  operations: [
    {
      id: MOCK_EVENT_FIXTURE.id,
      type: 'invoke_host_function',
      ledger_attr: MOCK_EVENT_FIXTURE.ledger,
      created_at: MOCK_EVENT_FIXTURE.ledgerClosedAt,
      contract_id: MOCK_EVENT_FIXTURE.contractId,
      function_name: 'transfer',
      details: MOCK_EVENT_FIXTURE.value,
      transaction_hash: MOCK_EVENT_FIXTURE.txHash,
      paging_token: MOCK_EVENT_FIXTURE.pagingToken,
    },
  ],
  offers: [
    {
      id: 123456,
      seller: MOCK_OFFER_FIXTURE.seller,
      selling: { asset_type: 'native' },
      buying: { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5XYKX4G5AVJJELDNXY655GS7G7OJ37C3T5L3' },
      amount: MOCK_OFFER_FIXTURE.amount,
      price: MOCK_OFFER_FIXTURE.price,
      last_modified_ledger: MOCK_OFFER_FIXTURE.lastModifiedLedger,
      paging_token: '123456',
    },
  ],
};

export const RPC_RECORDS_FIXTURE = {
  latestLedger: {
    id: MOCK_LEDGER_FIXTURE.hash,
    sequence: 524100,
    protocolVersion: '21',
  },
  transactions: [
    {
      hash: MOCK_TRANSACTION_FIXTURE.hash,
      ledger: MOCK_TRANSACTION_FIXTURE.ledger,
      createdAt: 1790424000,
      status: 'SUCCESS',
      envelopeXdr: MOCK_TRANSACTION_FIXTURE.envelopeXdr,
      resultXdr: MOCK_TRANSACTION_FIXTURE.resultXdr,
      resultMetaXdr: MOCK_TRANSACTION_FIXTURE.resultMetaXdr,
    },
  ],
  events: [
    {
      id: MOCK_EVENT_FIXTURE.id,
      type: 'contract',
      ledger: MOCK_EVENT_FIXTURE.ledger,
      ledgerClosedAt: MOCK_EVENT_FIXTURE.ledgerClosedAt,
      contractId: MOCK_EVENT_FIXTURE.contractId,
      topic: MOCK_EVENT_FIXTURE.topic,
      value: MOCK_EVENT_FIXTURE.value,
      txHash: MOCK_EVENT_FIXTURE.txHash,
      pagingToken: MOCK_EVENT_FIXTURE.pagingToken,
    },
  ],
};
