import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNativeToScVal = vi.fn((value, opts) => ({ value, opts, type: 'scval' }));
const mockAddress = {
  fromString: vi.fn(() => ({
    toScVal: vi.fn(() => ({ type: 'address', value: 'scval' })),
  })),
};
const mockStrKey = {
  isValidEd25519SecretSeed: vi.fn(() => true),
};
const mockContract = vi.fn(() => ({
  call: vi.fn(() => ({ type: 'operation' })),
}));
const mockTransactionBuilder = vi.fn(() => ({
  addOperation: vi.fn(() => ({
    setTimeout: vi.fn(() => ({
      build: vi.fn(() => ({ type: 'transaction' })),
    })),
  })),
}));
const mockKeypair = {
  fromSecret: vi.fn(() => ({ type: 'keypair' })),
};

vi.mock('@stellar/stellar-sdk', () => ({
  nativeToScVal: (...args) => mockNativeToScVal(...args),
  Address: mockAddress,
  StrKey: mockStrKey,
  Contract: mockContract,
  TransactionBuilder: mockTransactionBuilder,
  Keypair: mockKeypair,
  BASE_FEE: '100',
  xdr: {
    LedgerKey: {
      contractData: vi.fn(() => ({
        toXdr: vi.fn(() => 'xdr'),
      })),
    },
  },
}));

vi.mock('../../lib/stellar', () => ({
  getSorobanServer: vi.fn(() => ({
    prepareTransaction: vi.fn(() => Promise.resolve({ type: 'prepared-tx', sign: vi.fn() })),
    sendTransaction: vi.fn(() => Promise.resolve({ hash: 'abc', status: 'SUCCESS' })),
  })),
  getServer: vi.fn(() => ({
    loadAccount: vi.fn(() => Promise.resolve({ sequence: '1' })),
  })),
  NETWORKS: {
    testnet: { passphrase: 'test', sorobanUrl: 'https://soroban.testnet.stellar.org' },
  },
  isValidContractId: vi.fn(() => true),
  isValidPublicKey: vi.fn(() => true),
}));

import { invokeContractFunction } from '../contractInvoker';

describe('invokeContractFunction - extended type mapping', () => {
  const baseParams = {
    contractId: 'C123456789012345678901234567890123456789012345678901234567890',
    functionName: 'test',
    sourceAccount: 'G123456789012345678901234567890123456789012345678901234567890',
    secretKey: 'S123456789012345678901234567890123456789012345678901234567890',
    network: 'testnet',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps u32 type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'u32', value: '42' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(42, { type: 'u32' });
  });

  it('maps i32 type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'i32', value: '-42' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(-42, { type: 'i32' });
  });

  it('maps u64 type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'u64', value: '1000000' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(BigInt('1000000'), { type: 'u64' });
  });

  it('maps i64 type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'i64', value: '-1000000' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(BigInt('-1000000'), { type: 'i64' });
  });

  it('maps u128 type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'u128', value: '999999999999' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(BigInt('999999999999'), { type: 'u128' });
  });

  it('maps i128 type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'i128', value: '-999999999999' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(BigInt('-999999999999'), { type: 'i128' });
  });

  it('maps u256 type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'u256', value: '123456789' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(BigInt('123456789'), { type: 'u256' });
  });

  it('maps i256 type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'i256', value: '-123456789' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(BigInt('-123456789'), { type: 'i256' });
  });

  it('maps symbol type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'symbol', value: 'transfer' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith('transfer', { type: 'symbol' });
  });

  it('maps timepoint type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'timepoint', value: '1700000000' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(BigInt('1700000000'), { type: 'timepoint' });
  });

  it('maps duration type correctly', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'duration', value: '3600' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(BigInt('3600'), { type: 'duration' });
  });

  it('maps vec type with structured values', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'vec', value: [1, 2, 3] }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(
      [1, 2, 3].map(expect.anything),
      { type: 'vec' },
    );
  });

  it('maps option type with null value', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'option', value: null }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(null, { type: 'void' });
  });

  it('maps option type with value', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'option', value: 'some-value' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith('some-value');
  });

  it('maps result type with ok variant', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'result', value: { ok: 'success' } }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(
      { tag: 'ok', val: expect.anything() },
      { type: 'result' },
    );
  });

  it('maps result type with err variant', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'result', value: { err: 'error-value' } }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(
      { tag: 'error', val: expect.anything() },
      { type: 'result' },
    );
  });

  it('maps map type with object value', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'map', value: { key1: 'value1' } }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(
      expect.any(Array),
      { type: 'map' },
    );
  });

  it('maps tuple type with array value', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'tuple', value: [1, 'two', true] }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith([1, 'two', true], { type: 'tuple' });
  });

  it('maps bytes type with hex string', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'bytes', value: '0xdeadbeef' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(expect.any(Uint8Array), { type: 'bytes' });
  });

  it('maps boolean from string "true"', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'bool', value: 'true' }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(true, { type: 'bool' });
  });

  it('maps boolean from actual boolean value', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [{ type: 'bool', value: false }],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(false, { type: 'bool' });
  });

  it('handles multiple args of different types', async () => {
    await invokeContractFunction({
      ...baseParams,
      args: [
        { type: 'u32', value: '10' },
        { type: 'string', value: 'hello' },
        { type: 'address', value: 'G123456789012345678901234567890123456789012345678901234567890' },
        { type: 'bool', value: 'true' },
      ],
    });

    expect(mockNativeToScVal).toHaveBeenCalledWith(10, { type: 'u32' });
    expect(mockNativeToScVal).toHaveBeenCalledWith('hello', { type: 'string' });
    expect(mockNativeToScVal).toHaveBeenCalledWith(true, { type: 'bool' });
  });
});
