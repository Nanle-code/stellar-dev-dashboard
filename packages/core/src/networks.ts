import * as StellarSdk from '@stellar/stellar-sdk';

export type NetworkName = 'mainnet' | 'testnet' | 'futurenet' | 'local' | 'custom';

export interface NetworkConfig {
  name: string;
  horizonUrl: string;
  sorobanUrl?: string;
  passphrase: string;
  faucetUrl?: string;
  customHeaders?: Record<string, string>;
  headers?: Record<string, string>;
  capabilities?: NetworkCapabilities;
}

export interface NetworkCapabilities {
  ledgers: boolean;
  transactions: boolean;
  events: boolean;
  accountOffers: boolean;
  fullHistory: boolean;
  defaultReadSource: 'horizon' | 'rpc';
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: 'Mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanUrl: 'https://soroban-rpc.stellar.org',
    passphrase: StellarSdk.Networks.PUBLIC,
    capabilities: {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
  testnet: {
    name: 'Testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanUrl: 'https://soroban-testnet.stellar.org',
    passphrase: StellarSdk.Networks.TESTNET,
    faucetUrl: 'https://friendbot.stellar.org',
    capabilities: {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
  futurenet: {
    name: 'Futurenet',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    sorobanUrl: 'https://soroban-futurenet.stellar.org',
    passphrase: StellarSdk.Networks.FUTURENET,
    faucetUrl: 'https://friendbot-futurenet.stellar.org',
    capabilities: {
      ledges: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
  local: {
    name: 'Local',
    horizonUrl: 'http://localhost:8000',
    sorobanUrl: 'http://localhost:8000/soroban/rpc',
    passphrase: 'Standalone Network ; February 2017',
    capabilities: {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
  custom: {
    name: 'Custom',
    horizonUrl: '',
    sorobanUrl: '',
    passphrase: '',
    headers: {},
    capabilities: {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
};

export function getNetworkConfig(network: NetworkName): NetworkConfig {
  return NETWORKS[network];
}

export function updateCustomNetworkConfig(config: Partial<NetworkConfig>): void {
  const { headers, ...networkConfig } = config;
  Object.assign(NETWORKS.custom, networkConfig);
  if (headers) {
    NETWORKS.custom.headers = headers;
  }
}

export function getServer(network: NetworkName = 'testnet'): StellarSdk.Horizon.Server {
  const config = NETWORKS[network];
  const fallbackHorizonUrl = NETWORKS.testnet.horizonUrl;
  return new StellarSdk.Horizon.Server(config.horizonUrl || fallbackHorizonUrl);
}

export function getSorobanServer(network: NetworkName = 'testnet'): StellarSdk.SorobanRpc.Server {
  const config = NETWORKS[network];
  if (network === 'custom' && !config.sorobanUrl) {
    throw new Error('Custom Soroban RPC URL not configured');
  }
  const fallbackSorobanUrl = NETWORKS.testnet.sorobanUrl!;
  return new StellarSdk.SorobanRpc.Server(config.sorobanUrl || fallbackSorobanUrl);
}

export { StellarSdk };