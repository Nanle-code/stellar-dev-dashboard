import * as StellarSdk from '@stellar/stellar-sdk';

export interface AssetIssuanceConfig {
  code: string;
  name: string;
  homeDomain: string;
  supply: string;
  authRequired: boolean;
  authRevocable: boolean;
  clawbackEnabled: boolean;
}

export type AssetIssuanceStage = 'configure' | 'trustline' | 'authorize' | 'issue' | 'lock';

export interface AssetIssuanceDraft {
  config: AssetIssuanceConfig;
  issuerPublicKey: string;
  distributorPublicKey: string;
  issuerFunded: boolean;
  distributorFunded: boolean;
  completed: Partial<Record<AssetIssuanceStage, boolean>>;
  transactionHashes: Partial<Record<AssetIssuanceStage, string>>;
}

export const EMPTY_ASSET_ISSUANCE_CONFIG: AssetIssuanceConfig = {
  code: '',
  name: '',
  homeDomain: '',
  supply: '1000',
  authRequired: false,
  authRevocable: false,
  clawbackEnabled: false,
};

const MAX_HOME_DOMAIN_LENGTH = 253;
const MAX_ASSET_AMOUNT_STROOPS = 9223372036854775807n;

export function validateAssetIssuanceConfig(config: AssetIssuanceConfig): string[] {
  const errors: string[] = [];
  const code = config.code.trim();
  const domain = config.homeDomain.trim();
  const supply = config.supply.trim();

  if (!/^[A-Za-z0-9]{1,12}$/.test(code)) errors.push('Asset code must contain 1-12 letters or digits.');
  if (!config.name.trim()) errors.push('Asset name is required for the currency listing.');
  if (!domain || domain.length > MAX_HOME_DOMAIN_LENGTH || !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/.test(domain)) {
    errors.push('Enter a valid home domain without a URL scheme or path.');
  }
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(supply)) {
    errors.push('Supply must be positive and have no more than 7 decimal places.');
  } else {
    const [whole, fraction = ''] = supply.split('.');
    const amountStroops = BigInt(`${whole}${fraction.padEnd(7, '0')}`);
    if (amountStroops <= 0n || amountStroops > MAX_ASSET_AMOUNT_STROOPS) {
      errors.push("Supply must be positive and within Stellar's maximum asset amount.");
    }
  }
  if (config.clawbackEnabled && !config.authRevocable) {
    errors.push('Clawback requires revocable authorization.');
  }
  return errors;
}

export function buildAssetTomlSnippet(config: AssetIssuanceConfig, issuer: string): string {
  const fields = [
    '[[CURRENCIES]]',
    `code = "${config.code.trim()}"`,
    `issuer = "${issuer}"`,
    `name = ${JSON.stringify(config.name.trim())}`,
  ];
  return fields.join('\n');
}

export function buildAssetIssuanceOperations(
  stage: AssetIssuanceStage,
  config: AssetIssuanceConfig,
  issuer: string,
  distributor: string
): StellarSdk.xdr.Operation[] {
  const asset = new StellarSdk.Asset(config.code.trim().toUpperCase(), issuer);
  switch (stage) {
    case 'configure': {
      const setFlags = (config.authRequired ? 1 : 0)
        | (config.authRevocable ? 2 : 0)
        | (config.clawbackEnabled ? 8 : 0);
      return [StellarSdk.Operation.setOptions({ homeDomain: config.homeDomain.trim(), setFlags })];
    }
    case 'trustline':
      return [StellarSdk.Operation.changeTrust({ asset, limit: config.supply.trim() })];
    case 'authorize':
      return [StellarSdk.Operation.allowTrust({ trustor: distributor, assetCode: config.code.trim().toUpperCase(), authorize: true })];
    case 'issue':
      return [StellarSdk.Operation.payment({ destination: distributor, asset, amount: config.supply.trim() })];
    case 'lock':
      return [StellarSdk.Operation.setOptions({ masterWeight: 0 })];
  }
}

export function createAssetIssuanceDraft(value: unknown): AssetIssuanceDraft | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AssetIssuanceDraft>;
  if (!candidate.config || typeof candidate.config !== 'object') return null;
  if (typeof candidate.issuerPublicKey !== 'string' || typeof candidate.distributorPublicKey !== 'string') return null;
  const config = candidate.config as Partial<AssetIssuanceConfig>;
  return {
    config: {
      code: typeof config.code === 'string' ? config.code : EMPTY_ASSET_ISSUANCE_CONFIG.code,
      name: typeof config.name === 'string' ? config.name : EMPTY_ASSET_ISSUANCE_CONFIG.name,
      homeDomain: typeof config.homeDomain === 'string' ? config.homeDomain : EMPTY_ASSET_ISSUANCE_CONFIG.homeDomain,
      supply: typeof config.supply === 'string' ? config.supply : EMPTY_ASSET_ISSUANCE_CONFIG.supply,
      authRequired: Boolean(config.authRequired),
      authRevocable: Boolean(config.authRevocable),
      clawbackEnabled: Boolean(config.clawbackEnabled),
    },
    issuerPublicKey: candidate.issuerPublicKey,
    distributorPublicKey: candidate.distributorPublicKey,
    issuerFunded: Boolean(candidate.issuerFunded),
    distributorFunded: Boolean(candidate.distributorFunded),
    completed: candidate.completed ?? {},
    transactionHashes: candidate.transactionHashes ?? {},
  };
}