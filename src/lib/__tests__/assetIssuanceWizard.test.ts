import { describe, expect, it } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  buildAssetIssuanceOperations,
  buildAssetTomlSnippet,
  createAssetIssuanceDraft,
  EMPTY_ASSET_ISSUANCE_CONFIG,
  validateAssetIssuanceConfig,
} from '../assetIssuanceWizard';

const config = { ...EMPTY_ASSET_ISSUANCE_CONFIG, code: 'DEMO', name: 'Demo Credit', homeDomain: 'example.org', supply: '250.125', authRequired: true, authRevocable: true, clawbackEnabled: true };
const issuer = StellarSdk.Keypair.random().publicKey();
const distributor = StellarSdk.Keypair.random().publicKey();

describe('asset issuance wizard model', () => {
  it('builds the ordered policy, trustline, authorization, issue, and lock operations', () => {
    expect(buildAssetIssuanceOperations('configure', config, issuer, distributor)[0].type).toBe('setOptions');
    expect(buildAssetIssuanceOperations('trustline', config, issuer, distributor)[0].type).toBe('changeTrust');
    expect(buildAssetIssuanceOperations('authorize', config, issuer, distributor)[0].type).toBe('allowTrust');
    expect(buildAssetIssuanceOperations('issue', config, issuer, distributor)[0].type).toBe('payment');
    expect(buildAssetIssuanceOperations('lock', config, issuer, distributor)[0].type).toBe('setOptions');
  });

  it('validates normal asset parameters and catches seven-decimal overflow boundaries', () => {
    expect(validateAssetIssuanceConfig(config)).toEqual([]);
    expect(validateAssetIssuanceConfig({ ...config, code: 'ABCDEFGHIJKLM' })).toContain('Asset code must contain 1-12 letters or digits.');
    expect(validateAssetIssuanceConfig({ ...config, supply: '1.00000001' })).toContain('Supply must be positive and have no more than 7 decimal places.');
    expect(validateAssetIssuanceConfig({ ...config, supply: '922337203685.4775807' })).toEqual([]);
    expect(validateAssetIssuanceConfig({ ...config, supply: '922337203685.4775808' })).toContain("Supply must be positive and within Stellar's maximum asset amount.");
  });

  it('rejects clawback without revocability and escapes TOML strings', () => {
    expect(validateAssetIssuanceConfig({ ...config, authRevocable: false })).toContain('Clawback requires revocable authorization.');
    expect(buildAssetTomlSnippet({ ...config, name: 'Demo "Credit"' }, issuer)).toContain('name = "Demo \\"Credit\\""');
  });

  it('restores progress metadata without accepting secret-key fields', () => {
    const restored = createAssetIssuanceDraft({ config: { ...config, secret: 'SENSITIVE' }, issuerPublicKey: issuer, distributorPublicKey: distributor, issuerFunded: true, secret: 'SENSITIVE' });
    expect(restored?.issuerFunded).toBe(true);
    expect(restored).not.toHaveProperty('secret');
    expect(restored?.config).not.toHaveProperty('secret');
    expect(createAssetIssuanceDraft({ config })).toBeNull();
  });
});