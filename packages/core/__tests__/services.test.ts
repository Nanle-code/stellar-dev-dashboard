import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchAccount,
  fetchTransactions,
  fetchNetworkStats,
  fundTestnetAccount,
  fetchXLMPrice,
  clearCache,
} from '../src/services.js';
import * as StellarSdk from '@stellar/stellar-sdk';
import type { AccountData, NetworkStats, TransactionRecord } from '../src/types/index.js';

// Mock StellarSdk
vi.mock('@stellar/stellar-sdk', () => {
  return {
    Horizon: {
      Server: vi.fn().mockImplementation(() => ({
        loadAccount: vi.fn(),
        transactions: vi.fn().mockReturnThis(),
        forAccount: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        cursor: vi.fn().mockReturnThis(),
        call: vi.fn(),
        operations: vi.fn().mockReturnThis(),
        ledgers: vi.fn().mockReturnThis(),
        feeStats: vi.fn(),
      })),
    },
    SorobanRpc: {
      Server: vi.fn(),
    },
    Networks: {
      PUBLIC: 'Public Global Stellar Network ; September 2015',
      TESTNET: 'Test SDF Network ; September 2015',
      FUTURENET: 'Test SDF Future Network ; October 2022',
    },
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Services', () => {
  const mockAccountData: AccountData = {
    id: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    account_id: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    sequence: '12345',
    subentry_count: 5,
    balances: [
      { asset_type: 'native', balance: '100.0000000' },
      { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'G...', balance: '1000.0000000' },
    ],
    signers: [
      { key: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', type: 'ed25519_public_key', weight: 1 },
    ],
    thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 1 },
    last_modified_ledger: 12345,
  };

  const mockNetworkStats: NetworkStats = {
    latestLedger: {
      sequence: 12345,
      closed_at: '2024-01-01T00:00:00Z',
      transaction_count: 100,
      operation_count: 500,
      base_reserve: 10000000,
    },
    feeStats: {
      fee_charged: { max: '100', min: '100', p10: '100', p20: '100', p30: '100', p50: '100', p80: '100', p95: '100', p99: '100' },
      max_fee: { max: '100', min: '100', p10: '100', p20: '100', p30: '100', p50: '100', p80: '100', p95: '100', p99: '100' },
      ledger_capacity_usage: '0.1',
    },
  };

  const mockTransactions: TransactionRecord[] = [
    {
      id: 'tx1',
      hash: 'hash1',
      source_account: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      created_at: '2024-01-01T00:00:00Z',
      fee_charged: 100,
      fee: 100,
      memo: 'test',
      memo_type: 'text',
      operation_count: 1,
      successful: true,
      paging_token: 'token1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchAccount', () => {
    it('should fetch and return account data', async () => {
      const mockServer = new StellarSdk.Horizon.Server('');
      (mockServer.loadAccount as any).mockResolvedValue({
        id: mockAccountData.id,
        account_id: mockAccountData.account_id,
        sequence: mockAccountData.sequence,
        subentry_count: mockAccountData.subentry_count,
        balances: mockAccountData.balances,
        signers: mockAccountData.signers,
        thresholds: mockAccountData.thresholds,
        last_modified_ledger: mockAccountData.last_modified_ledger,
      });

      const result = await fetchAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'testnet');

      expect(result).toEqual(mockAccountData);
      expect(mockServer.loadAccount).toHaveBeenCalledWith('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
    });

    it('should cache and return cached result on second call', async () => {
      const mockServer = new StellarSdk.Horizon.Server('');
      (mockServer.loadAccount as any).mockResolvedValue({
        id: mockAccountData.id,
        account_id: mockAccountData.account_id,
        sequence: mockAccountData.sequence,
        subentry_count: mockAccountData.subentry_count,
        balances: mockAccountData.balances,
        signers: mockAccountData.signers,
        thresholds: mockAccountData.thresholds,
        last_modified_ledger: mockAccountData.last_modified_ledger,
      });

      await fetchAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'testnet');
      const result = await fetchAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'testnet');

      expect(result).toEqual(mockAccountData);
      expect(mockServer.loadAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchTransactions', () => {
    it('should fetch and return transactions', async () => {
      const mockServer = new StellarSdk.Horizon.Server('');
      const mockCall = vi.fn().mockResolvedValue({
        records: [
          {
            id: 'tx1',
            hash: 'hash1',
            source_account: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            created_at: '2024-01-01T00:00:00Z',
            fee_charged: 100,
            fee: 100,
            memo: 'test',
            memo_type: 'text',
            operation_count: 1,
            successful: true,
            paging_token: 'token1',
          },
        ],
      });
      (mockServer.transactions().forAccount().order().limit().call as any) = mockCall;

      const result = await fetchTransactions('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'testnet', 20);

      expect(result.records).toHaveLength(1);
      expect(result.records[0].id).toBe('tx1');
      expect(result.hasMore).toBe(false);
    });
  });

  describe('fetchNetworkStats', () => {
    it('should fetch and return network stats', async () => {
      const mockServer = new StellarSdk.Horizon.Server('');
      (mockServer.ledgers().order().limit().call as any).mockResolvedValue({
        records: [{ sequence: 12345, closed_at: '2024-01-01T00:00:00Z', transaction_count: 100, operation_count: 500, base_reserve: 10000000 }],
      });
      (mockServer.feeStats as any).mockResolvedValue(mockNetworkStats.feeStats);

      const result = await fetchNetworkStats('testnet');

      expect(result.latestLedger.sequence).toBe(12345);
      expect(result.feeStats).toEqual(mockNetworkStats.feeStats);
    });
  });

  describe('fundTestnetAccount', () => {
    it('should call friendbot and return result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await fundTestnetAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith('https://friendbot.stellar.org?addr=GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
    });

    it('should throw on failed request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(fundTestnetAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'))
        .rejects.toThrow('Faucet request failed');
    });
  });

  describe('fetchXLMPrice', () => {
    it('should fetch and return XLM price', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stellar: { usd: 0.12 } }),
      });

      const result = await fetchXLMPrice();

      expect(result).toEqual({ usd: 0.12 });
    });

    it('should throw on failed request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(fetchXLMPrice()).rejects.toThrow('Price fetch failed');
    });
  });

  describe('clearCache', () => {
    it('should clear all cache when no pattern', async () => {
      const mockServer = new StellarSdk.Horizon.Server('');
      (mockServer.loadAccount as any).mockResolvedValue({
        id: mockAccountData.id,
        account_id: mockAccountData.account_id,
        sequence: mockAccountData.sequence,
        subentry_count: mockAccountData.subentry_count,
        balances: mockAccountData.balances,
        signers: mockAccountData.signers,
        thresholds: mockAccountData.thresholds,
        last_modified_ledger: mockAccountData.last_modified_ledger,
      });

      await fetchAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'testnet');
      clearCache();

      // Should fetch again after clear
      await fetchAccount('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', 'testnet');
      expect(mockServer.loadAccount).toHaveBeenCalledTimes(2);
    });
  });
});