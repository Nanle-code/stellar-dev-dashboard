import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import { 
  parseContractWasm, 
  invokeContractFunction, 
  normalizeContractValue 
} from '../contractInvoker';
import { getSorobanServer, getServer, isValidContractId, isValidPublicKey } from '../stellar';

vi.mock('../stellar', () => ({
  getSorobanServer: vi.fn(),
  getServer: vi.fn(),
  NETWORKS: {
    testnet: { passphrase: 'Test SDF Network ; September 2015' }
  },
  isValidContractId: vi.fn(),
  isValidPublicKey: vi.fn(),
}));

describe('Contract Invoker Flows', () => {
  const validBytes = new Uint8Array(32);
  const MOCK_CONTRACT_ID = StellarSdk.StrKey.encodeContract(
    typeof Buffer !== 'undefined' ? Buffer.from(validBytes) : validBytes
  );
  
  const MOCK_KEYPAIR = StellarSdk.Keypair.random();
  const MOCK_PUBKEY = MOCK_KEYPAIR.publicKey();
  const MOCK_SECRET = MOCK_KEYPAIR.secret();

  let mockSorobanServer;
  let mockHorizonServer;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSorobanServer = {
      getLedgerEntries: vi.fn(),
      prepareTransaction: vi.fn(),
      sendTransaction: vi.fn(),
    };

    mockHorizonServer = {
      loadAccount: vi.fn().mockResolvedValue(
        new StellarSdk.Account(MOCK_PUBKEY, '1234567890')
      ),
    };

    getSorobanServer.mockReturnValue(mockSorobanServer);
    getServer.mockReturnValue(mockHorizonServer);
    isValidContractId.mockImplementation((id) => id === MOCK_CONTRACT_ID);
    isValidPublicKey.mockImplementation((id) => id === MOCK_PUBKEY);
  });

  describe('parseContractWasm (ABI/Ledger Parsing)', () => {
    it('successfully fetches and parses contract ledger entries', async () => {
      mockSorobanServer.getLedgerEntries.mockResolvedValue({
        entries: [{ xdr: 'mock-encoded-xdr-data' }]
      });

      const result = await parseContractWasm(MOCK_CONTRACT_ID);

      expect(result.found).toBe(true);
      expect(result.contractId).toBe(MOCK_CONTRACT_ID);
      expect(result.ledgerEntry).toBe('mock-encoded-xdr-data');
      expect(mockSorobanServer.getLedgerEntries).toHaveBeenCalledTimes(1);
    });

    it('throws an error if contract is not found on the ledger', async () => {
      mockSorobanServer.getLedgerEntries.mockResolvedValue({ entries: [] });

      await expect(parseContractWasm(MOCK_CONTRACT_ID)).rejects.toThrow('Contract not found');
    });
  });

  describe('invokeContractFunction (Validation & Invocation)', () => {
    it('throws error for invalid contract ID', async () => {
      isValidContractId.mockReturnValueOnce(false);
      await expect(invokeContractFunction({
        contractId: 'INVALID_ID',
        functionName: 'increment',
        sourceAccount: MOCK_PUBKEY,
        secretKey: MOCK_SECRET
      })).rejects.toThrow('Invalid contract ID');
    });

    it('throws error for missing or empty function name', async () => {
      await expect(invokeContractFunction({
        contractId: MOCK_CONTRACT_ID,
        functionName: '   ',
        sourceAccount: MOCK_PUBKEY,
        secretKey: MOCK_SECRET
      })).rejects.toThrow('Function name is required');
    });

    it('throws error for unsupported argument types', async () => {
      await expect(invokeContractFunction({
        contractId: MOCK_CONTRACT_ID,
        functionName: 'init',
        args: [{ type: 'float', value: '1.5' }],
        sourceAccount: MOCK_PUBKEY,
        secretKey: MOCK_SECRET
      })).rejects.toThrow('Unsupported argument type: float');
    });

    it('successfully maps all supported parameter types and simulates/sends transaction', async () => {
      mockSorobanServer.prepareTransaction.mockResolvedValue({
        sign: vi.fn(),
      });
      mockSorobanServer.sendTransaction.mockResolvedValue({
        hash: 'mock-tx-hash',
        status: 'PENDING',
        latestLedger: 12345
      });

      const args = [
        { type: 'string', value: 'hello soroban' },
        { type: 'int', value: '42' },
        { type: 'address', value: MOCK_PUBKEY },
        { type: 'bool', value: 'true' }
      ];

      const result = await invokeContractFunction({
        contractId: MOCK_CONTRACT_ID,
        functionName: 'complex_call',
        args,
        sourceAccount: MOCK_PUBKEY,
        secretKey: MOCK_SECRET
      });

      expect(mockSorobanServer.prepareTransaction).toHaveBeenCalled();
      expect(mockSorobanServer.sendTransaction).toHaveBeenCalled();
      
      expect(result).toEqual({
        hash: 'mock-tx-hash',
        status: 'PENDING',
        latestLedger: 12345
      });
    });

    it('handles Soroban RPC simulation/preparation failures seamlessly', async () => {
      mockSorobanServer.prepareTransaction.mockRejectedValue(new Error('Simulation failed: Out of gas'));

      await expect(invokeContractFunction({
        contractId: MOCK_CONTRACT_ID,
        functionName: 'expensive_call',
        sourceAccount: MOCK_PUBKEY,
        secretKey: MOCK_SECRET
      })).rejects.toThrow('Simulation failed: Out of gas');
    });
  });

  describe('normalizeContractValue (Result Parsing)', () => {
    it('normalizes BigInt to string', () => {
      expect(normalizeContractValue(BigInt(9007199254740991))).toBe('9007199254740991');
    });

    it('normalizes Uint8Array to standard Array', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      expect(normalizeContractValue(bytes)).toEqual([1, 2, 3]);
    });

    it('normalizes Stellar Address class to string', () => {
      const mockAddress = {
        constructor: { name: 'Address' },
        toString: () => MOCK_PUBKEY
      };
      expect(normalizeContractValue(mockAddress)).toBe(MOCK_PUBKEY);
    });

    it('recursively normalizes deeply nested arrays and objects', () => {
      const complexData = {
        nestedArray: [BigInt(1), new Uint8Array([255])],
        metadata: {
          isActive: true,
          owner: { constructor: { name: 'Address' }, toString: () => MOCK_PUBKEY }
        }
      };

      const normalized = normalizeContractValue(complexData);
      expect(normalized).toEqual({
        nestedArray: ['1', [255]],
        metadata: {
          isActive: true,
          owner: MOCK_PUBKEY
        }
      });
    });
  });
});