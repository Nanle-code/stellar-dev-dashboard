import { describe, it, expect } from 'vitest';
import { simulateTransaction, getSimulationFeeOptions } from '../../../src/lib/stellar';

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
    expect(result.warnings).toContain(
      'Memo text may exceed the 28-character limit accepted by the Stellar network.'
    );
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
