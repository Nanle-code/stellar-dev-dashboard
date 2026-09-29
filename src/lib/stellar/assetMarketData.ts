import type { NetworkName } from './networks.js';
import { fetchAssetStats, type AssetMarketData } from './assets.js';

/** Get mock market data for supported popular assets. */
export async function fetchAssetMarketData(
  assetCode: string,
  assetIssuer: string,
  network: NetworkName = 'testnet'
): Promise<AssetMarketData | null> {
  try {
    const mockMarketData: Record<string, Partial<AssetMarketData>> = {
      'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN': {
        price_usd: 1.0,
        price_xlm: 8.33,
        volume_24h_usd: 1500000,
        market_cap_usd: 45000000000,
        change_24h: 0.01,
        high_24h: 1.001,
        low_24h: 0.999,
      },
      'AQUA:GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA': {
        price_usd: 0.0045,
        price_xlm: 0.0375,
        volume_24h_usd: 125000,
        change_24h: -2.5,
        high_24h: 0.0048,
        low_24h: 0.0043,
      },
    };

    const marketData = mockMarketData[`${assetCode}:${assetIssuer}`];
    if (!marketData) return null;

    const assetStats = await fetchAssetStats(assetCode, assetIssuer, network);
    return {
      asset: assetStats?.asset || { code: assetCode, issuer: assetIssuer },
      last_updated: new Date().toISOString(),
      ...marketData,
    } as AssetMarketData;
  } catch (error) {
    console.error('Error fetching asset market data:', error);
    return null;
  }
}