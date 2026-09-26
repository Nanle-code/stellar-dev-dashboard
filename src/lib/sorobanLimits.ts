import { getSorobanServer } from './stellar';
import type { NetworkName } from './stellar';

export interface SorobanLimits {
  cpuInstructions: number;
  memoryBytes: number;
  readEntries: number;
  writeEntries: number;
  readBytes: number;
  writeBytes: number;
  eventsSize: number;
  txSize: number;
}

export const DEFAULT_SOROBAN_LIMITS: SorobanLimits = {
  cpuInstructions: 100_000_000,
  memoryBytes: 40_000_000,
  readEntries: 40,
  writeEntries: 25,
  readBytes: 100_000,
  writeBytes: 65_000,
  eventsSize: 10_000,
  txSize: 100_000,
};

export async function fetchNetworkLimits(network: NetworkName = 'testnet'): Promise<SorobanLimits> {
  const server = getSorobanServer(network);
  try {
    // Attempt to pull real config settings if needed, but for now we return realistic defaults
    // Since Soroban RPC doesn't have a single "getLimits" endpoint, we would normally use 
    // getLedgerEntries on the known config keys.
    // However, some mock networks or testnets return these directly if a custom wrapper is used.
    
    // For testnet and mainnet, these limits are relatively stable.
    if (network === 'mainnet') {
      return {
        ...DEFAULT_SOROBAN_LIMITS,
        cpuInstructions: 100_000_000, 
      };
    }

    return DEFAULT_SOROBAN_LIMITS;
  } catch (error) {
    console.warn("Failed to fetch network limits", error);
    return DEFAULT_SOROBAN_LIMITS;
  }
}
