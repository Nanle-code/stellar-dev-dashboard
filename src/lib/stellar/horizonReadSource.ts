import * as StellarSdk from '@stellar/stellar-sdk';
import { getServer, NetworkName } from './networks.js';
import {
  StellarReadSource,
  GetLedgersParams,
  GetLedgersResult,
  GetTransactionsParams,
  GetTransactionsResult,
  GetEventsParams,
  GetEventsResult,
  GetOffersParams,
  GetOffersResult,
  NetworkCapabilities,
  NormalizedLedger,
  NormalizedTransaction,
  NormalizedEvent,
  NormalizedOffer,
} from './types';

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return fallback;
  return String(value);
};

export class HorizonReadSource implements StellarReadSource {
  private network: NetworkName;
  private serverGetter?: (_network: NetworkName) => StellarSdk.Horizon.Server;

  constructor(
    network: NetworkName = 'testnet',
    serverGetter?: (_network: NetworkName) => StellarSdk.Horizon.Server
  ) {
    this.network = network;
    this.serverGetter = serverGetter;
  }

  private getServer(): StellarSdk.Horizon.Server {
    if (this.serverGetter) {
      return this.serverGetter(this.network);
    }
    return getServer(this.network);
  }

  getCapabilities(): NetworkCapabilities {
    return {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'horizon',
    };
  }

  async getLedgers(params: GetLedgersParams = {}): Promise<GetLedgersResult> {
    const server = this.getServer();
    const limit = params.limit ?? 10;
    const order = params.order ?? 'desc';

    let builder = server.ledgers().order(order).limit(limit);
    if (params.cursor) {
      builder = builder.cursor(params.cursor);
    }

    const response = await builder.call();
    const records = Array.isArray(response.records) ? response.records : [];

    const ledgers: NormalizedLedger[] = records.map((record) => {
      const r = record as Record<string, unknown>;
      const sequence = toNumber(r.sequence, 0);
      return {
        sequence,
        hash: toString(r.hash ?? r.id ?? `ledger-${sequence}`, `ledger-${sequence}`),
        closeTime: toString(r.closed_at ?? r.closeTime ?? new Date().toISOString()),
        transactionCount: toNumber(r.successful_transaction_count, 0) + toNumber(r.failed_transaction_count, 0),
        operationCount: toNumber(r.operation_count, 0),
        successfulTransactionCount: toNumber(r.successful_transaction_count, 0),
        failedTransactionCount: toNumber(r.failed_transaction_count, 0),
        headerXdr: typeof r.header_xdr === 'string' ? r.header_xdr : undefined,
        source: 'horizon',
      };
    });

    const nextCursor = records.length > 0 ? toString((records[records.length - 1] as Record<string, unknown>).paging_token) || undefined : undefined;

    return {
      ledgers,
      cursor: nextCursor,
      hasMore: records.length >= limit,
      source: 'horizon',
    };
  }

  async getTransactions(params: GetTransactionsParams = {}): Promise<GetTransactionsResult> {
    const server = this.getServer();
    const limit = params.limit ?? 10;
    const order = params.order ?? 'desc';

    let builder = params.accountId
      ? server.transactions().forAccount(params.accountId)
      : server.transactions();

    builder = builder.order(order).limit(limit);
    if (params.cursor) {
      builder = builder.cursor(params.cursor);
    }

    const response = await builder.call();
    const records = Array.isArray(response.records) ? response.records : [];

    const transactions: NormalizedTransaction[] = records.map((record) => {
      const r = record as Record<string, unknown>;
      const ledger = toNumber(r.ledger ?? r.ledger_attr, 0);
      return {
        hash: toString(r.hash, `tx-${ledger}`),
        ledger,
        createdAt: toString(r.created_at ?? new Date().toISOString()),
        status: r.successful !== false ? 'SUCCESS' : 'FAILED',
        sourceAccount: typeof r.source_account === 'string' ? r.source_account : undefined,
        feePaid: r.fee_charged,
        operationCount: toNumber(r.operation_count, 0),
        envelopeXdr: typeof r.envelope_xdr === 'string' ? r.envelope_xdr : undefined,
        resultXdr: typeof r.result_xdr === 'string' ? r.result_xdr : undefined,
        resultMetaXdr: typeof r.result_meta_xdr === 'string' ? r.result_meta_xdr : undefined,
        source: 'horizon',
      };
    });

    const nextCursor = records.length > 0 ? toString((records[records.length - 1] as Record<string, unknown>).paging_token) || undefined : undefined;

    return {
      transactions,
      cursor: nextCursor,
      hasMore: records.length >= limit,
      source: 'horizon',
    };
  }

  async getEvents(params: GetEventsParams = {}): Promise<GetEventsResult> {
    const server = this.getServer();
    const limit = params.limit ?? 10;

    let builder = server.operations().order('desc').limit(limit);
    if (params.cursor) {
      builder = builder.cursor(params.cursor);
    }

    const response = await builder.call();
    const records = Array.isArray(response.records) ? response.records : [];

    const events: NormalizedEvent[] = records.map((record) => {
      const r = record as Record<string, unknown>;
      const ledger = toNumber(r.ledger ?? r.ledger_attr, 0);
      const functionName = typeof r.function_name === 'string' ? r.function_name : undefined;
      return {
        id: toString(r.id, `event-${ledger}`),
        type: r.type === 'invoke_host_function' ? 'contract' : 'system',
        ledger,
        ledgerClosedAt: toString(r.created_at ?? new Date().toISOString()),
        contractId: typeof r.contract_id === 'string' ? r.contract_id : undefined,
        topic: functionName ? [functionName] : [],
        value: r.details ?? r,
        txHash: typeof r.transaction_hash === 'string' ? r.transaction_hash : undefined,
        pagingToken: typeof r.paging_token === 'string' ? r.paging_token : undefined,
        source: 'horizon',
      };
    });

    const nextCursor = records.length > 0 ? toString((records[records.length - 1] as Record<string, unknown>).paging_token) || undefined : undefined;

    return {
      events,
      cursor: nextCursor,
      hasMore: records.length >= limit,
      source: 'horizon',
    };
  }

  async getAccountOffers(accountId: string, params: GetOffersParams = {}): Promise<GetOffersResult> {
    const server = this.getServer();
    const limit = params.limit ?? 10;
    const order = params.order ?? 'desc';

    let builder = server.offers().forAccount(accountId).order(order).limit(limit);
    if (params.cursor) {
      builder = builder.cursor(params.cursor);
    }

    const response = await builder.call();
    const records = Array.isArray(response.records) ? response.records : [];

    const offers: NormalizedOffer[] = records.map((record) => {
      const r = record as Record<string, unknown>;
      const selling = (r.selling ?? {}) as Record<string, unknown>;
      const buying = (r.buying ?? {}) as Record<string, unknown>;
      const sellingAssetType = typeof selling.asset_type === 'string' ? selling.asset_type : 'unknown';
      const buyingAssetType = typeof buying.asset_type === 'string' ? buying.asset_type : 'unknown';
      return {
        id: toString(r.id, `offer-${toNumber(r.last_modified_ledger, 0)}`),
        seller: toString(r.seller),
        sellingAsset: sellingAssetType === 'native' ? 'XLM' : `${toString(selling.asset_code)}:${toString(selling.asset_issuer)}`,
        buyingAsset: buyingAssetType === 'native' ? 'XLM' : `${toString(buying.asset_code)}:${toString(buying.asset_issuer)}`,
        amount: toString(r.amount),
        price: toString(r.price),
        lastModifiedLedger: toNumber(r.last_modified_ledger, 0),
        source: 'horizon',
      };
    });

    const nextCursor = records.length > 0 ? toString((records[records.length - 1] as Record<string, unknown>).paging_token) || undefined : undefined;

    return {
      offers,
      cursor: nextCursor,
      hasMore: records.length >= limit,
      source: 'horizon',
      supported: true,
    };
  }
}
