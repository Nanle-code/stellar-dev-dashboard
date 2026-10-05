import { NetworkName, getNetworkDetails } from './networks.js';
import { HorizonReadSource } from './horizonReadSource';
import { RpcReadSource } from './rpcReadSource';
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
} from './types';

export class RpcFirstReadSource implements StellarReadSource {
  private network: NetworkName;
  private rpcSource: StellarReadSource;
  private horizonSource: StellarReadSource;

  constructor(
    network: NetworkName = 'testnet',
    rpcSource?: StellarReadSource,
    horizonSource?: StellarReadSource
  ) {
    this.network = network;
    this.rpcSource = rpcSource ?? new RpcReadSource(network);
    this.horizonSource = horizonSource ?? new HorizonReadSource(network);
  }

  getCapabilities(): NetworkCapabilities {
    const config = getNetworkDetails(this.network);
    const hasHorizon = Boolean(config?.horizonUrl);
    const hasRpc = Boolean(config?.sorobanUrl);

    return {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: hasHorizon,
      fullHistory: hasHorizon,
      defaultReadSource: hasRpc ? 'rpc' : 'horizon',
      retentionLimitLedgers: hasRpc ? 100_000 : undefined,
    };
  }

  async getLedgers(params: GetLedgersParams = {}): Promise<GetLedgersResult> {
    const config = getNetworkDetails(this.network);
    const hasRpc = Boolean(config?.sorobanUrl);
    const hasHorizon = Boolean(config?.horizonUrl);

    if (hasRpc) {
      try {
        const rpcResult = await this.rpcSource.getLedgers(params);
        if (!rpcResult.retentionLimitReached || !hasHorizon) {
          return {
            ...rpcResult,
            fallbackUsed: false,
          };
        }
      } catch (rpcErr) {
        if (!hasHorizon) throw rpcErr;
      }
    }

    if (hasHorizon) {
      const horizonResult = await this.horizonSource.getLedgers(params);
      return {
        ...horizonResult,
        fallbackUsed: hasRpc,
      };
    }

    throw new Error(`No data source available for network ${this.network}`);
  }

  async getTransactions(params: GetTransactionsParams = {}): Promise<GetTransactionsResult> {
    const config = getNetworkDetails(this.network);
    const hasRpc = Boolean(config?.sorobanUrl);
    const hasHorizon = Boolean(config?.horizonUrl);

    if (hasRpc) {
      try {
        const rpcResult = await this.rpcSource.getTransactions(params);
        if (!rpcResult.retentionLimitReached || !hasHorizon) {
          return {
            ...rpcResult,
            fallbackUsed: false,
          };
        }
      } catch (rpcErr) {
        if (!hasHorizon) throw rpcErr;
      }
    }

    if (hasHorizon) {
      const horizonResult = await this.horizonSource.getTransactions(params);
      return {
        ...horizonResult,
        fallbackUsed: hasRpc,
      };
    }

    throw new Error(`No data source available for network ${this.network}`);
  }

  async getEvents(params: GetEventsParams = {}): Promise<GetEventsResult> {
    const config = getNetworkDetails(this.network);
    const hasRpc = Boolean(config?.sorobanUrl);
    const hasHorizon = Boolean(config?.horizonUrl);

    if (hasRpc) {
      try {
        const rpcResult = await this.rpcSource.getEvents(params);
        if (!rpcResult.retentionLimitReached || !hasHorizon) {
          return {
            ...rpcResult,
            fallbackUsed: false,
          };
        }
      } catch (rpcErr) {
        if (!hasHorizon) throw rpcErr;
      }
    }

    if (hasHorizon) {
      const horizonResult = await this.horizonSource.getEvents(params);
      return {
        ...horizonResult,
        fallbackUsed: hasRpc,
      };
    }

    throw new Error(`No data source available for network ${this.network}`);
  }

  async getAccountOffers(accountId: string, params: GetOffersParams = {}): Promise<GetOffersResult> {
    const config = getNetworkDetails(this.network);
    const hasHorizon = Boolean(config?.horizonUrl);

    if (hasHorizon) {
      return this.horizonSource.getAccountOffers(accountId, params);
    }

    return {
      offers: [],
      hasMore: false,
      source: 'horizon',
      supported: false,
      message: 'Account offers are unavailable on RPC-only networks (Horizon endpoint required)',
    };
  }
}
