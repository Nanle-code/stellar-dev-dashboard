import * as StellarSdk from '@stellar/stellar-sdk';
import { getServer, NetworkName } from '../stellar';
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
    const records = response.records || [];

    const ledgers: NormalizedLedger[] = records.map((r: any) => ({
      sequence: r.sequence,
      hash: r.hash || r.id || `ledger-${r.sequence}`,
      closeTime: r.closed_at || r.closeTime || new Date().toISOString(),
      transactionCount: (r.successful_transaction_count ?? 0) + (r.failed_transaction_count ?? 0),
      operationCount: r.operation_count ?? 0,
      successfulTransactionCount: r.successful_transaction_count,
      failedTransactionCount: r.failed_transaction_count,
      headerXdr: r.header_xdr,
      source: 'horizon',
    }));

    const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : undefined;

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
    const records = response.records || [];

    const transactions: NormalizedTransaction[] = records.map((r: any) => ({
      hash: r.hash,
      ledger: r.ledger ?? r.ledger_attr ?? 0,
      createdAt: r.created_at || new Date().toISOString(),
      status: r.successful !== false ? 'SUCCESS' : 'FAILED',
      sourceAccount: r.source_account,
      feePaid: r.fee_charged,
      operationCount: r.operation_count,
      envelopeXdr: r.envelope_xdr,
      resultXdr: r.result_xdr,
      resultMetaXdr: r.result_meta_xdr,
      source: 'horizon',
    }));

    const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : undefined;

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
    const records = response.records || [];

    const events: NormalizedEvent[] = records.map((r: any) => ({
      id: String(r.id),
      type: (r.type === 'invoke_host_function' ? 'contract' : 'system') as 'contract' | 'system',
      ledger: r.ledger ?? r.ledger_attr ?? 0,
      ledgerClosedAt: r.created_at || new Date().toISOString(),
      contractId: r.contract_id,
      topic: r.function_name ? [r.function_name] : [],
      value: r.details || r,
      txHash: r.transaction_hash,
      pagingToken: r.paging_token,
      source: 'horizon',
    }));

    const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : undefined;

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
    const records = response.records || [];

    const offers: NormalizedOffer[] = records.map((r: any) => ({
      id: String(r.id),
      seller: r.seller,
      sellingAsset: r.selling.asset_type === 'native' ? 'XLM' : `${r.selling.asset_code}:${r.selling.asset_issuer}`,
      buyingAsset: r.buying.asset_type === 'native' ? 'XLM' : `${r.buying.asset_code}:${r.buying.asset_issuer}`,
      amount: r.amount,
      price: r.price,
      lastModifiedLedger: r.last_modified_ledger,
      source: 'horizon',
    }));

    const nextCursor = records.length > 0 ? records[records.length - 1].paging_token : undefined;

    return {
      offers,
      cursor: nextCursor,
      hasMore: records.length >= limit,
      source: 'horizon',
      supported: true,
    };
  }
}
