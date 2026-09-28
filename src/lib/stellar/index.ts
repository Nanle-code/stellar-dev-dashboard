import { NetworkName, getNetworkDetails } from '../stellar';
import { StellarReadSource } from './types';
import { HorizonReadSource } from './horizonReadSource';
import { RpcReadSource } from './rpcReadSource';
import { RpcFirstReadSource } from './rpcFirstReadSource';
import { isOnline } from '../offlineReadOnly';

export * from './types';
export * from './horizonReadSource';
export * from './rpcReadSource';
export * from './rpcFirstReadSource';

export type ReadSourceMode = 'rpc-first' | 'rpc-only' | 'horizon-only';

/**
 * Factory function to instantiate a Stellar read source for a given network profile.
 */
export function getStellarReadSource(
  network: NetworkName = 'testnet',
  mode: ReadSourceMode = 'rpc-first'
): StellarReadSource {
  switch (mode) {
    case 'rpc-only':
      return new RpcReadSource(network);
    case 'horizon-only':
      return new HorizonReadSource(network);
    case 'rpc-first':
    default:
      return new RpcFirstReadSource(network);
  }
}

/**
 * Helper to evaluate data source capabilities and connectivity for a network profile.
 */
export function evaluateReadSourceCapabilities(network: NetworkName = 'testnet') {
  const config = getNetworkDetails(network);
  const online = isOnline();
  const hasHorizon = Boolean(config?.horizonUrl);
  const hasRpc = Boolean(config?.sorobanUrl);

  const capabilities = {
    ledgers: online && (hasHorizon || hasRpc),
    transactions: online && (hasHorizon || hasRpc),
    events: online && (hasHorizon || hasRpc),
    accountOffers: online && hasHorizon,
    fullHistory: online && hasHorizon,
    defaultReadSource: hasRpc ? ('rpc' as const) : ('horizon' as const),
    retentionLimitLedgers: hasRpc ? 100_000 : undefined,
    isRpcOnly: hasRpc && !hasHorizon,
    isHorizonOnly: hasHorizon && !hasRpc,
  };

  return {
    network,
    online,
    hasHorizon,
    hasRpc,
    capabilities,
  };
}
