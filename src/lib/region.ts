// src/lib/region.ts
// Regional Stellar network configurations and utilities
// This module isolates region-specific network selection and local fiat integration.

export type Region = 'global' | 'europe' | 'north_america' | 'asia' | 'custom';

// Map regions to existing network names or custom endpoints.
// For demonstration we map to pre‑existing networks; in a real deployment these would be
// configured via environment variables or a remote config service.
export const REGION_NETWORK_MAP: Record<Region, { network: string; horizonOverride?: string; sorobanOverride?: string }> = {
  global: { network: 'public' },
  europe: { network: 'testnet' }, // Example: use testnet for EU demo
  north_america: { network: 'testnet' },
  asia: { network: 'testnet' },
  custom: { network: 'custom' },
};

/**
 * Resolve the Stellar network configuration for a given region.
 * Returns a NetworkName that can be used with the existing getServer / getSorobanServer functions.
 */
export function resolveRegionNetwork(region: Region): string {
  const mapping = REGION_NETWORK_MAP[region] ?? REGION_NETWORK_MAP['global'];
  return mapping.network;
}

/**
 * Fetch local fiat exchange rates for XLM using CoinGecko.
 * Supports multiple fiat currencies (e.g. USD, EUR, JPY).
 * Returns a map of fiat -> rate.
 */
export async function fetchLocalFiatRates(
  fiatCurrencies: string[],
): Promise<Record<string, number>> {
  const ids = 'stellar';
  const vsCurrencies = fiatCurrencies.map((c) => c.toLowerCase()).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch fiat rates: ${response.status}`);
  }
  const data = await response.json();
  const result: Record<string, number> = {};
  fiatCurrencies.forEach((c) => {
    const rate = data?.stellar?.[c.toLowerCase()];
    if (typeof rate === 'number') {
      result[c.toUpperCase()] = rate;
    }
  });
  return result;
}
