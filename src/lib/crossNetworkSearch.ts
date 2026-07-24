import type { NetworkName } from './stellar';

export interface CrossNetworkSearchParams {
  query: string;
  networks: NetworkName[];
  filters?: {
    addresses?: string[];
    amounts?: { min?: number; max?: number };
    assets?: string[];
    dateRange?: { start?: Date; end?: Date };
  };
}

export interface NetworkSearchResult {
  network: NetworkName;
  results: any[];
  error?: string;
}

export async function searchAcrossNetworks(params: CrossNetworkSearchParams): Promise<NetworkSearchResult[]> {
  const { query, networks, filters } = params;
  
  const searchPromises = networks.map(async (network) => {
    try {
      const results = await searchInNetwork(network, query, filters);
      return { network, results };
    } catch (error) {
      return { 
        network, 
        results: [], 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  return Promise.all(searchPromises);
}

async function searchInNetwork(
  network: NetworkName, 
  query: string, 
  filters?: CrossNetworkSearchParams['filters']
): Promise<any[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return [
    {
      network,
      type: 'transaction',
      hash: `${query}_${network}_mock`,
      timestamp: Date.now(),
      source: 'GABC...XYZ',
    },
  ];
}

export function mergeNetworkResults(results: NetworkSearchResult[]): any[] {
  const merged: any[] = [];
  
  results.forEach(({ network, results: networkResults }) => {
    networkResults.forEach(result => {
      merged.push({ ...result, network });
    });
  });

  merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  
  return merged;
}

export function getNetworkStats(results: NetworkSearchResult[]): Record<NetworkName, number> {
  const stats: Record<string, number> = {};
  
  results.forEach(({ network, results: networkResults }) => {
    stats[network] = networkResults.length;
  });
  
  return stats as Record<NetworkName, number>;
}
