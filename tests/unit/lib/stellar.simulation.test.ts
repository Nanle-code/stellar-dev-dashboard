import { describe, it, expect, vi, beforeEach } from 'vitest';

const { loadAccountMock } = vi.hoisted(() => ({ loadAccountMock: vi.fn() }));

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  class MockHorizonServer {
    loadAccount = loadAccountMock;
  }
  return {
    ...actual,
    Horizon: { ...actual.Horizon, Server: MockHorizonServer },
  };
});

import { simulateTransaction, getSimulationFeeOptions } from '../../../src/lib/stellar';

beforeEach(() => {
  loadAccountMock.mockReset();
});

describe('stellar simulation diagnostics', () => {
  it('returns validation errors for invalid transaction parameters', async () => {
    const result = await simulateTransaction({
      sourceAccount: 'invalid-key',
      operations: [
        {
          type: 'payment',
          destination: 'not-a-public-key',
          amount: '0',
        },
      ],
      memo: 'This memo is longer than twenty-eight characters to trigger a warning.',
      baseFee: 0,
      timeBounds: { minTime: 'abc', maxTime: '1000' },
      network: 'testnet',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain(
      'Source account is required and must be a valid Stellar public key.'
    );
    expect(result.errors).toContain('Operation 1: Invalid destination address.');
    expect(result.errors).toContain('Operation 1: Amount must be greater than zero.');
    expect(result.errors).toContain('Base fee must be a positive number.');
    expect(result.errors).toContain('Time bounds must be valid Unix timestamps.');
    expect(result.errors).toContain('Memo text must be 28 bytes or fewer.');
  });

  it('warns when a payment destination requires a memo (SEP-29) and none is set', async () => {
    loadAccountMock.mockResolvedValue({
      data_attr: { 'config.memo_required': Buffer.from('1').toString('base64') },
    });

    const result = await simulateTransaction({
      sourceAccount: 'GATRGEIRAHUC2KD62STK4MCA2OXLIE5SSY67OCMREH5ZBI573EKGBRNI',
      operations: [
        {
          type: 'payment',
          destination: 'GAQCITSVIIDTUWUNT2635UL77CIG27RAQKPHKFYLLFM6TOTCI7GIXOEP',
          amount: '10',
        },
      ],
      memo: '',
      baseFee: 100,
      timeBounds: {},
      network: 'testnet',
    });

    expect(result.warnings?.some((w) => w.includes('requires a memo'))).toBe(true);
  });

  it('does not warn when a memo is already set, even for a memo-required destination', async () => {
    loadAccountMock.mockResolvedValue({
      data_attr: { 'config.memo_required': Buffer.from('1').toString('base64') },
    });

    const result = await simulateTransaction({
      sourceAccount: 'GATRGEIRAHUC2KD62STK4MCA2OXLIE5SSY67OCMREH5ZBI573EKGBRNI',
      operations: [
        {
          type: 'payment',
          destination: 'GAQCITSVIIDTUWUNT2635UL77CIG27RAQKPHKFYLLFM6TOTCI7GIXOEP',
          amount: '10',
        },
      ],
      memo: '12345',
      baseFee: 100,
      timeBounds: {},
      network: 'testnet',
    });

    expect(result.warnings?.some((w) => w.includes('requires a memo'))).toBeFalsy();
  });

  it('generates priority fee options based on operation count', () => {
    const feeOptions = getSimulationFeeOptions(100, 2);

    expect(feeOptions).toHaveLength(3);
    expect(feeOptions[0]).toMatchObject({
      label: 'Slow / Cost Saver',
      expectedInclusion: 'slow',
    });
    expect(feeOptions[2]).toMatchObject({
      label: 'Priority',
      expectedInclusion: 'priority',
    });
    expect(feeOptions[2].fee).toBeGreaterThanOrEqual(feeOptions[1].fee);
  });
});
