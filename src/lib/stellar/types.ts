/**
 * Types and interfaces for the Stellar RPC-first data layer with Horizon fallback.
 * Note: Naming as StellarReadSource to avoid collision with offlineReadOnly DataSource.
 */

export interface NetworkCapabilities {
  ledgers: boolean;
  transactions: boolean;
  events: boolean;
  accountOffers: boolean;
  fullHistory: boolean;
  defaultReadSource: 'rpc' | 'horizon';
  retentionLimitLedgers?: number; // e.g. 100,000 ledgers for Soroban RPC
}

export interface NormalizedLedger {
  sequence: number;
  hash: string;
  closeTime: string;
  transactionCount: number;
  operationCount?: number;
  successfulTransactionCount?: number;
  failedTransactionCount?: number;
  headerXdr?: string;
  source: 'rpc' | 'horizon';
}

export interface NormalizedTransaction {
  hash: string;
  ledger: number;
  createdAt: string;
  status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND' | 'PENDING';
  sourceAccount?: string;
  feePaid?: string | number;
  operationCount?: number;
  envelopeXdr?: string;
  resultXdr?: string;
  resultMetaXdr?: string;
  source: 'rpc' | 'horizon';
}

export interface NormalizedEvent {
  id: string;
  type: 'contract' | 'system' | 'diagnostic';
  ledger: number;
  ledgerClosedAt: string;
  contractId?: string;
  topic: string[];
  value: unknown;
  txHash?: string;
  pagingToken?: string;
  source: 'rpc' | 'horizon';
}

export interface NormalizedOffer {
  id: string;
  seller: string;
  sellingAsset: string;
  buyingAsset: string;
  amount: string;
  price: string;
  lastModifiedLedger?: number;
  source: 'horizon';
}

export interface GetLedgersParams {
  limit?: number;
  cursor?: string;
  order?: 'asc' | 'desc';
  startLedger?: number;
}

export interface GetLedgersResult {
  ledgers: NormalizedLedger[];
  cursor?: string;
  hasMore: boolean;
  source: 'rpc' | 'horizon';
  fallbackUsed?: boolean;
  retentionLimitReached?: boolean;
}

export interface GetTransactionsParams {
  limit?: number;
  cursor?: string;
  order?: 'asc' | 'desc';
  startLedger?: number;
  accountId?: string;
}

export interface GetTransactionsResult {
  transactions: NormalizedTransaction[];
  cursor?: string;
  hasMore: boolean;
  source: 'rpc' | 'horizon';
  fallbackUsed?: boolean;
  retentionLimitReached?: boolean;
}

export interface GetEventsParams {
  limit?: number;
  cursor?: string;
  startLedger?: number;
  contractIds?: string[];
  topics?: string[][];
  type?: 'contract' | 'system' | 'diagnostic';
}

export interface GetEventsResult {
  events: NormalizedEvent[];
  cursor?: string;
  hasMore: boolean;
  source: 'rpc' | 'horizon';
  fallbackUsed?: boolean;
  retentionLimitReached?: boolean;
}

export interface GetOffersParams {
  limit?: number;
  cursor?: string;
  order?: 'asc' | 'desc';
}

export interface GetOffersResult {
  offers: NormalizedOffer[];
  cursor?: string;
  hasMore: boolean;
  source: 'horizon';
  supported: boolean;
  message?: string;
}

export class UnsupportedCapabilityError extends Error {
  readonly capability: keyof NetworkCapabilities;
  readonly readSource: 'rpc' | 'horizon';

  constructor(capability: keyof NetworkCapabilities, readSource: 'rpc' | 'horizon', message?: string) {
    super(
      message ??
        `Capability "${capability}" is not supported by the current ${readSource.toUpperCase()} data source.`
    );
    this.name = 'UnsupportedCapabilityError';
    this.capability = capability;
    this.readSource = readSource;
  }
}

export class RetentionWindowExceededError extends Error {
  readonly requestedLedger?: number;
  readonly retentionLimitLedgers: number;

  constructor(retentionLimitLedgers: number, requestedLedger?: number) {
    super(
      `Requested ledger ${requestedLedger ?? 'history'} is outside the Stellar RPC retention window of ${retentionLimitLedgers.toLocaleString()} ledgers.`
    );
    this.name = 'RetentionWindowExceededError';
    this.retentionLimitLedgers = retentionLimitLedgers;
    this.requestedLedger = requestedLedger;
  }
}

export interface StellarReadSource {
  getLedgers(_params?: GetLedgersParams): Promise<GetLedgersResult>;
  getTransactions(_params?: GetTransactionsParams): Promise<GetTransactionsResult>;
  getEvents(_params?: GetEventsParams): Promise<GetEventsResult>;
  getAccountOffers(_accountId: string, _params?: GetOffersParams): Promise<GetOffersResult>;
  getCapabilities(): NetworkCapabilities;
}
