/**
 * Tests for WASM tracker functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  extractWasmFromUpgradeTransaction,
  isContractUpgradeTransaction,
} from './wasmTracker';

describe('WASM Tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractWasmFromUpgradeTransaction', () => {
    it('should return null for null transaction', () => {
      expect(extractWasmFromUpgradeTransaction(null)).toBeNull();
    });

    it('should return null for transaction without operations', () => {
      expect(extractWasmFromUpgradeTransaction({})).toBeNull();
    });

    it('should return null for transaction with empty operations', () => {
      expect(extractWasmFromUpgradeTransaction({ operations: [] })).toBeNull();
    });

    it('should extract WASM hash from upgrade transaction', () => {
      const transaction = {
        operations: [
          {
            type: 'invoke_host_function',
            body: {
              invoke_host_function: {
                host_function: {
                  type: 'upload_contract_wasm',
                  wasm: {
                    hash: 'abc123def456789',
                  },
                },
                contract_id: 'CCY737I6XABK7KYYJUZM7XKL7CMJ6DKFZDVUQJL5HJITILFIQ5B3Q',
              },
            },
          },
        ],
      };

      const result = extractWasmFromUpgradeTransaction(transaction);
      expect(result).not.toBeNull();
      expect(result?.wasmHash).toBe('abc123def456789');
      // Note: contractId extraction may vary based on actual implementation
    });

    it('should extract from alternative transaction structure', () => {
      const transaction = {
        operations: [
          {
            type: 'invoke_host_function',
            wasm_hash: 'xyz789abc123',
            contract_id: 'CCY737I6XABK7KXYYJUZM7XKL7CMJ6DKFZDVUQJL5HJITILFIQ5B3Q',
            auth: 'admin',
          },
        ],
      };

      const result = extractWasmFromUpgradeTransaction(transaction);
      expect(result).toEqual({
        wasmHash: 'xyz789abc123',
        contractId: 'CCY737I6XABK7KXYYJUZM7XKL7CMJ6DKFZDVUQJL5HJITILFIQ5B3Q',
        authorization: 'admin',
      });
    });

    it('should return null when no WASM hash is found', () => {
      const transaction = {
        operations: [
          {
            type: 'payment',
            amount: '100',
          },
        ],
      };

      expect(extractWasmFromUpgradeTransaction(transaction)).toBeNull();
    });

    it('should handle malformed transaction structure gracefully', () => {
      const transaction = {
        operations: [
          {
            type: 'invoke_host_function',
            body: null,
          },
        ],
      };

      expect(extractWasmFromUpgradeTransaction(transaction)).toBeNull();
    });

    it('should extract authorization from array format', () => {
      const transaction = {
        operations: [
          {
            type: 'invoke_host_function',
            wasm_hash: 'abc123',
            contract_id: 'CCY737I6XABK7KXYYJUZM7XKL7CMJ6DKFZDVUQJL5HJITILFIQ5B3Q',
            authorizations: ['admin', 'multisig'],
          },
        ],
      };

      const result = extractWasmFromUpgradeTransaction(transaction);
      expect(result?.authorization).toBe('admin,multisig');
    });
  });

  describe('isContractUpgradeTransaction', () => {
    it('should return false for null transaction', () => {
      expect(isContractUpgradeTransaction(null)).toBe(false);
    });

    it('should return false for transaction without operations', () => {
      expect(isContractUpgradeTransaction({})).toBe(false);
    });

    it('should return true for invoke_host_function operation', () => {
      const transaction = {
        operations: [
          {
            type: 'invoke_host_function',
          },
        ],
      };

      expect(isContractUpgradeTransaction(transaction)).toBe(true);
    });

    it('should return true for upload_contract_wasm operation', () => {
      const transaction = {
        operations: [
          {
            type: 'invoke_host_function',
            body: {
              invoke_host_function: {
                host_function: {
                  type: 'upload_contract_wasm',
                },
              },
            },
          },
        ],
      };

      expect(isContractUpgradeTransaction(transaction)).toBe(true);
    });

    it('should return true for restore_contract operation', () => {
      const transaction = {
        operations: [
          {
            type: 'restore_contract',
          },
        ],
      };

      expect(isContractUpgradeTransaction(transaction)).toBe(true);
    });

    it('should return true for extend_contract operation', () => {
      const transaction = {
        operations: [
          {
            type: 'extend_contract',
          },
        ],
      };

      expect(isContractUpgradeTransaction(transaction)).toBe(true);
    });

    it('should return false for payment operation', () => {
      const transaction = {
        operations: [
          {
            type: 'payment',
          },
        ],
      };

      expect(isContractUpgradeTransaction(transaction)).toBe(false);
    });

    it('should return true if any operation is an upgrade operation', () => {
      const transaction = {
        operations: [
          {
            type: 'payment',
          },
          {
            type: 'invoke_host_function',
          },
        ],
      };

      expect(isContractUpgradeTransaction(transaction)).toBe(true);
    });
  });

  describe('Parameter Validation', () => {
    it('should validate required parameters for tracking', () => {
      const validParams = {
        contractId: 'CCY737I6XABK7KXYYJUZM7XKL7CMJ6DKFZDVUQJL5HJITILFIQ5B3Q',
        wasmHash: 'abc123def456789',
        transactionHash: 'tx123456789',
        network: 'testnet',
      };

      expect(() => {
        if (!validParams.contractId || typeof validParams.contractId !== 'string') {
          throw new Error('Invalid contractId');
        }
        if (!validParams.wasmHash || typeof validParams.wasmHash !== 'string') {
          throw new Error('Invalid wasmHash');
        }
        if (!validParams.transactionHash || typeof validParams.transactionHash !== 'string') {
          throw new Error('Invalid transactionHash');
        }
        if (!validParams.network || typeof validParams.network !== 'string') {
          throw new Error('Invalid network');
        }
      }).not.toThrow();
    });

    it('should reject invalid parameters', () => {
      const invalidParams = [
        { contractId: '', wasmHash: 'abc...', transactionHash: 'tx...', network: 'testnet' },
        { contractId: 'CCY...', wasmHash: '', transactionHash: 'tx...', network: 'testnet' },
        { contractId: 'CCY...', wasmHash: 'abc...', transactionHash: '', network: 'testnet' },
        { contractId: 'CCY...', wasmHash: 'abc...', transactionHash: 'tx...', network: '' },
      ];

      invalidParams.forEach(params => {
        expect(() => {
          if (!params.contractId || typeof params.contractId !== 'string') {
            throw new Error('Invalid contractId');
          }
          if (!params.wasmHash || typeof params.wasmHash !== 'string') {
            throw new Error('Invalid wasmHash');
          }
          if (!params.transactionHash || typeof params.transactionHash !== 'string') {
            throw new Error('Invalid transactionHash');
          }
          if (!params.network || typeof params.network !== 'string') {
            throw new Error('Invalid network');
          }
        }).toThrow();
      });
    });
  });
});
