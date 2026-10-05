import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NETWORKS,
  type NetworkName,
  type NetworkConfig,
  getNetworkConfig,
  updateCustomNetworkConfig,
  getServer,
  getSorobanServer,
  StellarSdk,
} from '../src/networks.js';

describe('Networks', () => {
  describe('NETWORKS', () => {
    it('should have all required networks', () => {
      const requiredNetworks: NetworkName[] = ['mainnet', 'testnet', 'futurenet', 'local', 'custom'];
      for (const network of requiredNetworks) {
        expect(NETWORKS).toHaveProperty(network);
      }
    });

    it('should have correct mainnet config', () => {
      expect(NETWORKS.mainnet.name).toBe('Mainnet');
      expect(NETWORKS.mainnet.horizonUrl).toBe('https://horizon.stellar.org');
      expect(NETWORKS.mainnet.sorobanUrl).toBe('https://soroban-rpc.stellar.org');
      expect(NETWORKS.mainnet.passphrase).toBe(StellarSdk.Networks.PUBLIC);
    });

    it('should have correct testnet config with faucet', () => {
      expect(NETWORKS.testnet.name).toBe('Testnet');
      expect(NETWORKS.testnet.horizonUrl).toBe('https://horizon-testnet.stellar.org');
      expect(NETWORKS.testnet.faucetUrl).toBe('https://friendbot.stellar.org');
    });

    it('should have empty custom network by default', () => {
      expect(NETWORKS.custom.horizonUrl).toBe('');
      expect(NETWORKS.custom.sorobanUrl).toBe('');
      expect(NETWORKS.custom.passphrase).toBe('');
    });
  });

  describe('getNetworkConfig', () => {
    it('should return network config for valid network', () => {
      const config = getNetworkConfig('testnet');
      expect(config.name).toBe('Testnet');
    });

    it('should return custom network config', () => {
      const config = getNetworkConfig('custom');
      expect(config.name).toBe('Custom');
    });
  });

  describe('updateCustomNetworkConfig', () => {
    let originalCustom: NetworkConfig;

    beforeEach(() => {
      originalCustom = { ...NETWORKS.custom };
    });

    afterEach(() => {
      NETWORKS.custom = originalCustom;
    });

    it('should update custom network config', () => {
      updateCustomNetworkConfig({
        name: 'My Custom',
        horizonUrl: 'https://custom.example.com',
        passphrase: 'Custom Network Passphrase',
      });

      expect(NETWORKS.custom.name).toBe('My Custom');
      expect(NETWORKS.custom.horizonUrl).toBe('https://custom.example.com');
      expect(NETWORKS.custom.passphrase).toBe('Custom Network Passphrase');
    });

    it('should preserve existing config when partially updating', () => {
      NETWORKS.custom.name = 'Original';
      NETWORKS.custom.horizonUrl = 'https://original.example.com';

      updateCustomNetworkConfig({ passphrase: 'New Passphrase' });

      expect(NETWORKS.custom.name).toBe('Original');
      expect(NETWORKS.custom.horizonUrl).toBe('https://original.example.com');
      expect(NETWORKS.custom.passphrase).toBe('New Passphrase');
    });
  });

  describe('getServer', () => {
    it('should return Horizon Server instance for testnet', () => {
      const server = getServer('testnet');
      expect(server).toBeInstanceOf(StellarSdk.Horizon.Server);
    });

    it('should return Horizon Server instance for mainnet', () => {
      const server = getServer('mainnet');
      expect(server).toBeInstanceOf(StellarSdk.Horizon.Server);
    });

    it('should fallback to testnet for invalid network', () => {
      const server = getServer('invalid' as NetworkName);
      expect(server).toBeInstanceOf(StellarSdk.Horizon.Server);
    });
  });

  describe('getSorobanServer', () => {
    it('should return SorobanRpc Server instance for testnet', () => {
      const server = getSorobanServer('testnet');
      expect(server).toBeInstanceOf(StellarSdk.SorobanRpc.Server);
    });

    it('should throw for custom network without sorobanUrl', () => {
      const originalSorobanUrl = NETWORKS.custom.sorobanUrl;
      NETWORKS.custom.sorobanUrl = '';

      expect(() => getSorobanServer('custom')).toThrow('Custom Soroban RPC URL not configured');

      NETWORKS.custom.sorobanUrl = originalSorobanUrl;
    });
  });
});