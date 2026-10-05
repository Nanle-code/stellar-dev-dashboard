import { describe, expect, it, vi } from 'vitest';
import { buildClaimPredicate, isValidPublicKey, resolveAddress } from '../index.js';

vi.mock('../../errorHandling/CircuitBreaker', () => ({
  getCircuitBreaker: vi.fn(),
}));

const VALID_ACCOUNT = 'GATRGEIRAHUC2KD62STK4MCA2OXLIE5SSY67OCMREH5ZBI573EKGBRNI';

describe('Stellar domain modules', () => {
  it('resolves a valid public account through the public barrel', async () => {
    expect(isValidPublicKey(VALID_ACCOUNT)).toBe(true);
    await expect(resolveAddress(VALID_ACCOUNT)).resolves.toMatchObject({
      accountId: VALID_ACCOUNT,
      inputType: 'ed25519',
    });
  });

  it('rejects an unsupported or incomplete address at the format boundary', () => {
    expect(isValidPublicKey('M')).toBe(false);
    expect(isValidPublicKey('name*')).toBe(false);
  });

  it('rejects invalid relative claim predicates', () => {
    expect(() => buildClaimPredicate({ type: 'relative', seconds: 0 })).toThrow(TypeError);
  });
});