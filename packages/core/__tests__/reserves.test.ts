import { describe, it, expect } from 'vitest';
import { calculateAccountReserves } from '../src/reserves.js';
import type { AccountData, NetworkStats } from '../src/types/index.js';

describe('Reserves', () => {
  const mockNetworkStats: NetworkStats = {
    latestLedger: {
      sequence: 12345,
      closed_at: '2024-01-01T00:00:00Z',
      transaction_count: 100,
      operation_count: 500,
      base_reserve: 10000000, // 1 XLM in stroops
    },
    feeStats: {
      fee_charged: { max: '100', min: '100', p10: '100', p20: '100', p30: '100', p50: '100', p80: '100', p95: '100', p99: '100' },
      max_fee: { max: '100', min: '100', p10: '100', p20: '100', p30: '100', p50: '100', p80: '100', p95: '100', p99: '100' },
      ledger_capacity_usage: '0.1',
    },
  };

  const mockAccountData: AccountData = {
    id: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    account_id: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    sequence: '12345',
    subentry_count: 5,
    balances: [
      { asset_type: 'native', balance: '100.0000000' },
      { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'G...', balance: '1000.0000000' },
      { asset_type: 'credit_alphanum4', asset_code: 'EURC', asset_issuer: 'G...', balance: '500.0000000' },
    ],
    signers: [
      { key: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', type: 'ed25519_public_key', weight: 1 },
      { key: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF', type: 'ed25519_public_key', weight: 1 },
    ],
    thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 1 },
    last_modified_ledger: 12345,
  };

  describe('calculateAccountReserves', () => {
    it('should calculate reserves correctly', () => {
      const result = calculateAccountReserves(mockAccountData, mockNetworkStats, 2);

      expect(result.baseReserve).toBe(1);
      expect(result.signerReserve).toBe(0.5); // 1 extra signer * 0.5
      expect(result.assetReserve).toBe(1); // 2 assets * 0.5
      expect(result.offerReserve).toBe(1); // 2 offers * 0.5
      expect(result.subentryReserve).toBe(2.5); // 5 subentries * 0.5
      expect(result.totalReserves).toBe(6); // 1 + 0.5 + 1 + 1 + 2.5
      expect(result.totalBalance).toBe(100);
      expect(result.availableBalance).toBe(94); // 100 - 6
    });

    it('should handle zero offer count', () => {
      const result = calculateAccountReserves(mockAccountData, mockNetworkStats, 0);
      expect(result.offerReserve).toBe(0);
    });

    it('should use default base reserve when networkStats is null', () => {
      const result = calculateAccountReserves(mockAccountData, null, 0);
      expect(result.baseReserve).toBe(1);
    });

    it('should handle account with no non-native assets', () => {
      const accountData: AccountData = {
        ...mockAccountData,
        balances: [{ asset_type: 'native', balance: '50.0000000' }],
      };
      const result = calculateAccountReserves(accountData, mockNetworkStats, 0);
      expect(result.assetReserve).toBe(0);
    });

    it('should handle account with no extra signers', () => {
      const accountData: AccountData = {
        ...mockAccountData,
        signers: [{ key: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', type: 'ed25519_public_key', weight: 1 }],
      };
      const result = calculateAccountReserves(accountData, mockNetworkStats, 0);
      expect(result.signerReserve).toBe(0);
    });

    it('should not go below zero for available balance', () => {
      const accountData: AccountData = {
        ...mockAccountData,
        balances: [{ asset_type: 'native', balance: '1.0000000' }],
      };
      const result = calculateAccountReserves(accountData, mockNetworkStats, 10);
      expect(result.availableBalance).toBe(0);
    });

    it('should handle missing balances gracefully', () => {
      const accountData: AccountData = {
        ...mockAccountData,
        balances: undefined as any,
      };
      const result = calculateAccountReserves(accountData, mockNetworkStats, 0);
      expect(result.assetReserve).toBe(0);
      expect(result.totalBalance).toBe(0);
    });

    it('should handle missing signers gracefully', () => {
      const accountData: AccountData = {
        ...mockAccountData,
        signers: undefined as any,
      };
      const result = calculateAccountReserves(accountData, mockNetworkStats, 0);
      expect(result.signerReserve).toBe(0);
    });
  });
});