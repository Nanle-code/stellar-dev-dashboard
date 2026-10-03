import { getServer, type NetworkName } from './networks.js';

// ─── Asset Discovery & Analytics ─────────────────────────────────────────────

export interface AssetInfo {
  code: string;
  issuer: string;
  domain?: string;
  name?: string;
  description?: string;
  image?: string;
  conditions?: string;
  is_verified?: boolean;
  is_asset_anchored?: boolean;
  anchor_asset_type?: string;
  anchor_asset?: string;
  redemption_instructions?: string;
  collateral_addresses?: string[];
  collateral_address_messages?: string[];
  status?: string;
  display_decimals?: number;
  num_accounts?: number;
  amount?: string;
  flags?: {
    auth_required?: boolean;
    auth_revocable?: boolean;
    auth_immutable?: boolean;
    auth_clawback_enabled?: boolean;
  };
  paging_token?: string;
}

export interface AssetStats {
  asset: AssetInfo;
  num_accounts: number;
  num_claimable_balances: number;
  num_liquidity_pools: number;
  num_contracts: number;
  amount: string;
  accounts: {
    authorized: number;
    authorized_to_maintain_liabilities: number;
    unauthorized: number;
  };
  balances: {
    authorized: string;
    authorized_to_maintain_liabilities: string;
    unauthorized: string;
  };
  claimable_balances_amount: string;
  liquidity_pools_amount: string;
  contracts_amount: string;
}

export interface AssetMarketData {
  asset: AssetInfo;
  price_usd?: number;
  price_xlm?: number;
  volume_24h_usd?: number;
  volume_24h_xlm?: number;
  market_cap_usd?: number;
  change_24h?: number;
  high_24h?: number;
  low_24h?: number;
  last_updated?: string;
  trading_pairs?: TradingPair[];
}

export interface TradingPair {
  base_asset: AssetInfo;
  counter_asset: AssetInfo;
  price: string;
  volume_24h: string;
  change_24h: string;
  high_24h: string;
  low_24h: string;
  last_trade_at: string;
}

export interface IssuerInfo {
  account_id: string;
  domain?: string;
  name?: string;
  description?: string;
  website?: string;
  logo?: string;
  support_email?: string;
  support_url?: string;
  keybase?: string;
  twitter?: string;
  github?: string;
  telegram?: string;
  linkedin?: string;
  facebook?: string;
  medium?: string;
  reddit?: string;
  is_verified?: boolean;
  verification_level?: 'none' | 'domain' | 'manual' | 'full';
  assets_issued?: AssetInfo[];
  toml_url?: string;
  toml_last_updated?: string;
}

export interface AssetSearchFilters {
  query?: string;
  asset_type?: 'credit_alphanum4' | 'credit_alphanum12' | 'native';
  asset_issuer?: string;
  verified_only?: boolean;
  min_accounts?: number;
  max_accounts?: number;
  min_amount?: string;
  max_amount?: string;
  has_domain?: boolean;
  order?: 'asc' | 'desc';
  sort_by?: 'code' | 'num_accounts' | 'amount' | 'created_at';
  limit?: number;
  cursor?: string;
}

export interface TrustlineRecommendation {
  asset: AssetInfo;
  issuer_info: IssuerInfo;
  recommendation_score: number;
  reasons: string[];
  risk_factors: string[];
  similar_assets?: AssetInfo[];
  market_data?: AssetMarketData;
}

// Popular assets list (curated)
export const POPULAR_ASSETS: AssetInfo[] = [
  {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    domain: 'centre.io',
    name: 'USD Coin',
    description: 'USDC is a fully collateralized US dollar stablecoin',
    is_verified: true,
    is_asset_anchored: true,
    anchor_asset_type: 'fiat',
    anchor_asset: 'USD',
  },
  {
    code: 'AQUA',
    issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
    domain: 'aqua.network',
    name: 'Aqua Token',
    description: 'AQUA is the native token of the Aqua Network',
    is_verified: true,
  },
  {
    code: 'yXLM',
    issuer: 'GARDNV3Q7YGT4AKSDF25LT32YSCCW67UUQRWQGZ2FQOTQADAAY6RQXU',
    domain: 'ultrastellar.com',
    name: 'yXLM',
    description: 'Yield-bearing XLM token',
    is_verified: true,
  },
  {
    code: 'MOBI',
    issuer: 'GA6HCMBLTZS5VYYBCATRBRZ3BZJMAFUDKYYF6AH6MVCMGWMRDNSWJPIH',
    domain: 'mobius.network',
    name: 'Mobius Token',
    description: 'MOBI is the native token of the Mobius Network',
    is_verified: true,
  },
];

/**
 * Fetch all assets from Horizon
 */
export async function fetchAssets(
  network: NetworkName = 'testnet',
  filters: AssetSearchFilters = {}
): Promise<{ records: AssetInfo[]; next?: string; prev?: string }> {
  const server = getServer(network);

  let assetsCall = server.assets();

  if (filters.asset_issuer) {
    assetsCall = assetsCall.forIssuer(filters.asset_issuer);
  }

  if (filters.asset_type) {
    // Note: Horizon doesn't have direct asset type filtering, we'll filter client-side
  }

  if (filters.order) {
    assetsCall = assetsCall.order(filters.order);
  }

  if (filters.limit) {
    assetsCall = assetsCall.limit(filters.limit);
  }

  if (filters.cursor) {
    assetsCall = assetsCall.cursor(filters.cursor);
  }

  const response = await assetsCall.call();

  let assets = response.records.map(
    (asset: any): AssetInfo => ({
      code: asset.asset_code,
      issuer: asset.asset_issuer,
      num_accounts: parseInt(asset.num_accounts),
      amount: asset.amount,
      flags: {
        auth_required: asset.flags.auth_required,
        auth_revocable: asset.flags.auth_revocable,
        auth_immutable: asset.flags.auth_immutable,
        auth_clawback_enabled: asset.flags.auth_clawback_enabled,
      },
      paging_token: asset.paging_token,
    })
  );

  // Client-side filtering
  if (filters.query) {
    const query = filters.query.toLowerCase();
    assets = assets.filter(
      (asset) =>
        asset.code.toLowerCase().includes(query) ||
        asset.issuer.toLowerCase().includes(query) ||
        asset.domain?.toLowerCase().includes(query) ||
        asset.name?.toLowerCase().includes(query)
    );
  }

  if (filters.verified_only) {
    assets = assets.filter((asset) => asset.is_verified);
  }

  if (filters.min_accounts) {
    assets = assets.filter((asset) => (asset.num_accounts || 0) >= filters.min_accounts!);
  }

  if (filters.max_accounts) {
    assets = assets.filter((asset) => (asset.num_accounts || 0) <= filters.max_accounts!);
  }

  if (filters.has_domain) {
    assets = assets.filter((asset) => !!asset.domain);
  }

  return {
    records: assets,
    next: response.records[response.records.length - 1]?.paging_token,
    prev: response.records[0]?.paging_token,
  };
}

/**
 * Fetch detailed asset statistics
 */
export async function fetchAssetStats(
  assetCode: string,
  assetIssuer: string,
  network: NetworkName = 'testnet'
): Promise<AssetStats | null> {
  try {
    const server = getServer(network);
    const asset = await server.assets().forCode(assetCode).forIssuer(assetIssuer).call();

    if (asset.records.length === 0) return null;

    const assetData = asset.records[0];

    return {
      asset: {
        code: assetData.asset_code,
        issuer: assetData.asset_issuer,
        num_accounts: Number(assetData.num_accounts),
        amount: assetData.amount,
        flags: {
          auth_required: assetData.flags.auth_required,
          auth_revocable: assetData.flags.auth_revocable,
          auth_immutable: assetData.flags.auth_immutable,
          auth_clawback_enabled: assetData.flags.auth_clawback_enabled,
        },
      },
      num_accounts: Number(assetData.num_accounts),
      num_claimable_balances: Number(assetData.num_claimable_balances || 0),
      num_liquidity_pools: Number(assetData.num_liquidity_pools || 0),
      num_contracts: Number(assetData.num_contracts || 0),
      amount: assetData.amount,
      accounts: {
        authorized: Number(assetData.accounts?.authorized || 0),
        authorized_to_maintain_liabilities: Number(
          assetData.accounts?.authorized_to_maintain_liabilities || 0
        ),
        unauthorized: Number(assetData.accounts?.unauthorized || 0),
      },
      balances: {
        authorized: assetData.balances?.authorized || '0',
        authorized_to_maintain_liabilities:
          assetData.balances?.authorized_to_maintain_liabilities || '0',
        unauthorized: assetData.balances?.unauthorized || '0',
      },
      claimable_balances_amount: assetData.claimable_balances_amount || '0',
      liquidity_pools_amount: assetData.liquidity_pools_amount || '0',
      contracts_amount: assetData.contracts_amount || '0',
    };
  } catch (error) {
    console.error('Error fetching asset stats:', error);
    return null;
  }
}

/**
 * Fetch issuer information from stellar.toml
 */
export async function fetchIssuerInfo(
  issuerAccount: string,
  network: NetworkName = 'testnet'
): Promise<IssuerInfo> {
  try {
    const server = getServer(network);
    const account = await server.loadAccount(issuerAccount);

    let issuerInfo: IssuerInfo = {
      account_id: issuerAccount,
      verification_level: 'none',
    };

    // Check if account has a home domain
    if (account.home_domain) {
      issuerInfo.domain = account.home_domain;
      issuerInfo.toml_url = `https://${account.home_domain}/.well-known/stellar.toml`;

      try {
        // Fetch stellar.toml
        const tomlResponse = await fetch(issuerInfo.toml_url);
        if (tomlResponse.ok) {
          const tomlText = await tomlResponse.text();
          const tomlData = parseToml(tomlText);

          // Extract organization info
          if (tomlData.DOCUMENTATION) {
            issuerInfo.name = tomlData.DOCUMENTATION.ORG_NAME;
            issuerInfo.description = tomlData.DOCUMENTATION.ORG_DESCRIPTION;
            issuerInfo.website = tomlData.DOCUMENTATION.ORG_URL;
            issuerInfo.logo = tomlData.DOCUMENTATION.ORG_LOGO;
            issuerInfo.support_email = tomlData.DOCUMENTATION.ORG_SUPPORT_EMAIL;
            issuerInfo.support_url = tomlData.DOCUMENTATION.ORG_SUPPORT_URL;
            issuerInfo.keybase = tomlData.DOCUMENTATION.ORG_KEYBASE;
            issuerInfo.twitter = tomlData.DOCUMENTATION.ORG_TWITTER;
            issuerInfo.github = tomlData.DOCUMENTATION.ORG_GITHUB;
          }

          issuerInfo.verification_level = 'domain';
          issuerInfo.toml_last_updated = new Date().toISOString();
        }
      } catch (tomlError) {
        console.warn('Failed to fetch stellar.toml:', tomlError);
      }
    }

    return issuerInfo;
  } catch (error) {
    console.error('Error fetching issuer info:', error);
    return {
      account_id: issuerAccount,
      verification_level: 'none',
    };
  }
}

/**
 * Simple TOML parser for stellar.toml files
 */
function parseToml(tomlText: string): any {
  const result: any = {};
  let currentSection = result;
  let currentSectionName = '';

  const lines = tomlText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Section headers
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSectionName = trimmed.slice(1, -1);
      currentSection = result[currentSectionName] = {};
      continue;
    }

    // Key-value pairs
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.slice(0, equalIndex).trim();
      let value = trimmed.slice(equalIndex + 1).trim();

      // Remove quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      currentSection[key] = value;
    }
  }

  return result;
}

/**
 * Get trustline recommendations for an account
 */
export async function getTrustlineRecommendations(
  accountId: string,
  network: NetworkName = 'testnet',
  limit: number = 10
): Promise<TrustlineRecommendation[]> {
  try {
    const server = getServer(network);
    const account = await server.loadAccount(accountId);

    // Get current trustlines
    const currentAssets = new Set(
      account.balances
        .filter((balance) => balance.asset_type !== 'native')
        .map((balance) => {
          const assetBalance = balance as unknown as { asset_code: string; asset_issuer: string };
          return `${assetBalance.asset_code}:${assetBalance.asset_issuer}`;
        })
    );

    // Fetch popular assets
    const { records: popularAssets } = await fetchAssets(network, {
      limit: 50,
      order: 'desc',
    });

    const recommendations: TrustlineRecommendation[] = [];

    for (const asset of popularAssets) {
      const assetKey = `${asset.code}:${asset.issuer}`;

      // Skip if already trusted
      if (currentAssets.has(assetKey)) continue;

      // Get issuer info
      const issuerInfo = await fetchIssuerInfo(asset.issuer, network);

      // Calculate recommendation score
      let score = 0;
      const reasons: string[] = [];
      const riskFactors: string[] = [];

      // Scoring factors
      if (asset.num_accounts && asset.num_accounts > 1000) {
        score += 30;
        reasons.push(`Popular asset with ${asset.num_accounts.toLocaleString()} holders`);
      }

      if (issuerInfo.verification_level === 'domain') {
        score += 25;
        reasons.push('Verified issuer with domain');
      }

      if (asset.is_verified) {
        score += 20;
        reasons.push('Verified asset');
      }

      if (asset.flags?.auth_required) {
        score -= 10;
        riskFactors.push('Requires authorization from issuer');
      }

      if (asset.flags?.auth_revocable) {
        score -= 15;
        riskFactors.push('Issuer can revoke authorization');
      }

      if (asset.flags?.auth_clawback_enabled) {
        score -= 20;
        riskFactors.push('Issuer can clawback funds');
      }

      if (!issuerInfo.domain) {
        score -= 15;
        riskFactors.push('No domain verification');
      }

      // Only recommend assets with positive scores
      if (score > 0) {
        recommendations.push({
          asset,
          issuer_info: issuerInfo,
          recommendation_score: score,
          reasons,
          risk_factors: riskFactors,
        });
      }

      if (recommendations.length >= limit) break;
    }

    // Sort by recommendation score
    return recommendations.sort((a, b) => b.recommendation_score - a.recommendation_score);
  } catch (error) {
    console.error('Error getting trustline recommendations:', error);
    return [];
  }
}

/**
 * Search assets with advanced filtering
 */
export async function searchAssets(
  query: string,
  network: NetworkName = 'testnet',
  filters: AssetSearchFilters = {}
): Promise<AssetInfo[]> {
  const searchFilters: AssetSearchFilters = {
    ...filters,
    query: query.trim(),
    limit: filters.limit || 20,
  };

  const { records } = await fetchAssets(network, searchFilters);

  // Enhance with issuer info for top results
  const enhancedAssets = await Promise.all(
    records.slice(0, 10).map(async (asset) => {
      try {
        const issuerInfo = await fetchIssuerInfo(asset.issuer, network);
        return {
          ...asset,
          domain: issuerInfo.domain,
          name: issuerInfo.name,
          description: issuerInfo.description,
          is_verified: issuerInfo.verification_level !== 'none',
        };
      } catch {
        return asset;
      }
    })
  );

  return [...enhancedAssets, ...records.slice(10)];
}
