import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateHorizonEndpoint, validateSorobanEndpoint } from '../endpointValidation';

describe('endpointValidation', () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateHorizonEndpoint', () => {
    it('returns valid for a correct Horizon endpoint (primary flow)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          horizon_version: '2.31.0',
          core_version: '19.8.0',
          network_passphrase: 'Test SDF Network ; September 2015'
        }),
      });

      const result = await validateHorizonEndpoint('https://horizon-testnet.stellar.org');
      
      expect(result.isValid).toBe(true);
      expect(result.protocolCompatible).toBe(true);
      expect(result.details?.horizonVersion).toBe('2.31.0');
      expect(result.error).toBeUndefined();
    });

    it('handles empty URL boundary case', async () => {
      const result = await validateHorizonEndpoint('   ');
      
      expect(result.isValid).toBe(false);
      expect(result.protocolCompatible).toBe(false);
      expect(result.error).toBe('URL is required');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns error when endpoint is not Horizon (failure case)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ some_other_data: true }), // Missing horizon_version
      });

      const result = await validateHorizonEndpoint('https://example.com');
      
      expect(result.isValid).toBe(false);
      expect(result.protocolCompatible).toBe(false);
      expect(result.error).toBe('Not a compatible Horizon endpoint');
    });

    it('returns error on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network Error'));

      const result = await validateHorizonEndpoint('https://invalid.local');
      
      expect(result.isValid).toBe(false);
      expect(result.protocolCompatible).toBe(false);
      expect(result.error).toBe('Network Error');
    });
  });

  describe('validateSorobanEndpoint', () => {
    it('returns valid for a correct Soroban RPC endpoint (primary flow)', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { status: 'healthy', version: '20.0.0' }
        }),
      });

      const result = await validateSorobanEndpoint('https://soroban-testnet.stellar.org');
      
      expect(result.isValid).toBe(true);
      expect(result.protocolCompatible).toBe(true);
      expect(result.details?.status).toBe('healthy');
    });

    it('returns error when Soroban RPC is unhealthy or not compatible', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { status: 'degraded' }
        }),
      });

      const result = await validateSorobanEndpoint('https://soroban-testnet.stellar.org');
      
      expect(result.isValid).toBe(false);
      expect(result.protocolCompatible).toBe(false);
      expect(result.error).toContain('Not a compatible Soroban RPC endpoint or unhealthy');
    });
  });
});
