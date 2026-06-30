/**
 * Stellar lib tests (#99)
 *
 * Pure-function unit tests for the typed Stellar service helpers.
 * Network-fetching functions are exercised in integration tests; here we
 * cover the deterministic utilities (formatters, label lookup, network
 * config lookup).
 */

import { beforeEach, describe, it, expect } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';

import {
  NETWORKS,
  OPERATION_LABELS,
  formatXLM,
  getCustomNetworkAuthHeaders,
  getNetworkDetails,
  getOperationLabel,
  shortAddress,
  updateCustomNetworkConfig,
} from '../stellar';

beforeEach(() => {
  window.sessionStorage.clear();
  updateCustomNetworkConfig({
    horizonUrl: '',
    sorobanUrl: '',
    passphrase: '',
    headers: {},
  });
});

describe('NETWORKS', () => {
  it('exposes mainnet, testnet, futurenet, local, and custom configs', () => {
    expect(Object.keys(NETWORKS).sort()).toEqual(
      ['custom', 'futurenet', 'local', 'mainnet', 'testnet'].sort(),
    );
  });

  it('uses the correct passphrases from the SDK', () => {
    expect(NETWORKS.mainnet.passphrase).toBe(StellarSdk.Networks.PUBLIC);
    expect(NETWORKS.testnet.passphrase).toBe(StellarSdk.Networks.TESTNET);
    expect(NETWORKS.futurenet.passphrase).toBe(StellarSdk.Networks.FUTURENET);
  });

  it('only exposes the friendbot URL for testnet & futurenet', () => {
    expect(NETWORKS.testnet.faucetUrl).toBeDefined();
    expect(NETWORKS.futurenet.faucetUrl).toBeDefined();
    expect(NETWORKS.mainnet.faucetUrl).toBeUndefined();
  });
});

describe('getNetworkDetails', () => {
  it('returns the matching network config', () => {
    const details = getNetworkDetails('testnet');
    expect(details.name).toBe('Testnet');
    expect(details.horizonUrl).toContain('horizon-testnet');
  });
});

describe('updateCustomNetworkConfig', () => {
  it('mutates the custom network entry without affecting others', () => {
    const before = { ...NETWORKS.testnet };
    updateCustomNetworkConfig({ horizonUrl: 'http://example.invalid/horizon' });
    expect(NETWORKS.custom.horizonUrl).toBe('http://example.invalid/horizon');
    expect(NETWORKS.testnet).toEqual(before);
  });

  it('stores custom auth headers in session storage only', () => {
    updateCustomNetworkConfig({
      headers: { Authorization: 'Bearer secret-horizon-token' },
    });

    expect(getCustomNetworkAuthHeaders()).toEqual({
      Authorization: 'Bearer secret-horizon-token',
    });
    expect(window.sessionStorage.getItem('stellar-custom-network-headers')).toContain('secret-horizon-token');
    expect(window.localStorage.getItem('stellar-custom-network-headers')).toBeNull();
  });

  it('removes blank custom auth headers', () => {
    updateCustomNetworkConfig({ headers: { Authorization: 'Bearer secret-horizon-token' } });
    updateCustomNetworkConfig({ headers: { Authorization: '' } });

    expect(getCustomNetworkAuthHeaders()).toEqual({});
    expect(window.sessionStorage.getItem('stellar-custom-network-headers')).toBeNull();
  });
});

describe('shortAddress', () => {
  it('returns an empty string for null/undefined', () => {
    expect(shortAddress(null)).toBe('');
    expect(shortAddress(undefined)).toBe('');
    expect(shortAddress('')).toBe('');
  });

  it('truncates with default chars=6 using an ellipsis separator', () => {
    const addr = 'GABCDEF1234567890XYZ987654321';
    const result = shortAddress(addr);
    expect(result.startsWith(addr.slice(0, 6))).toBe(true);
    expect(result.endsWith(addr.slice(-6))).toBe(true);
    expect(result.includes('…')).toBe(true);
  });

  it('respects the chars override', () => {
    const addr = 'GABCDEF1234567890XYZ987654321';
    expect(shortAddress(addr, 4)).toBe(`${addr.slice(0, 4)}…${addr.slice(-4)}`);
  });
});

describe('formatXLM', () => {
  it('renders integer-like inputs with two minimum decimals', () => {
    expect(formatXLM(1)).toBe('1.00');
    expect(formatXLM('42')).toBe('42.00');
  });

  it('preserves up to 7 fractional digits', () => {
    expect(formatXLM('0.1234567')).toBe('0.1234567');
  });

  it('inserts thousands separators for large amounts', () => {
    expect(formatXLM(1234567.89)).toBe('1,234,567.89');
  });
});

describe('OPERATION_LABELS / getOperationLabel', () => {
  it('returns the canonical label for known operation types', () => {
    expect(getOperationLabel('payment')).toBe(OPERATION_LABELS.payment);
    expect(getOperationLabel('create_account')).toBe(OPERATION_LABELS.create_account);
  });

  it('falls back to a title-cased label for unknown operation types', () => {
    const label = getOperationLabel('quantum_swap');
    // titleCaseLabel splits on _ and capitalises words
    expect(label.toLowerCase()).toContain('quantum');
    expect(label.toLowerCase()).toContain('swap');
  });
});
