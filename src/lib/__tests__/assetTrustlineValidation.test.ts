import { describe, expect, it } from 'vitest';
import { getAssetTrustlineStatus } from '../assetTrustlineValidation';

const VALID_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

describe('getAssetTrustlineStatus', () => {
  it('reports a valid issuer and authorized primary trustline flow', () => {
    const result = getAssetTrustlineStatus({
      issuer: VALID_ISSUER,
      flags: { auth_required: true },
      trustline: { is_authorized: true },
    });

    expect(result.issuer.state).toBe('valid');
    expect(result.authorization.state).toBe('authorized');
    expect(result.clawbackEnabled).toBe(false);
  });

  it('distinguishes the missing issuer boundary from malformed input', () => {
    const missing = getAssetTrustlineStatus({ issuer: '   ' });
    const invalid = getAssetTrustlineStatus({ issuer: `${VALID_ISSUER.slice(0, -1)}B` });

    expect(missing.issuer).toMatchObject({ state: 'missing', normalized: null });
    expect(invalid.issuer.state).toBe('invalid');
  });

  it('fails closed when public-key validation is unavailable', () => {
    const result = getAssetTrustlineStatus({
      issuer: VALID_ISSUER,
      validatePublicKey: () => {
        throw new Error('unsupported environment');
      },
    });

    expect(result.issuer.state).toBe('invalid');
  });

  it('distinguishes authorization-required, restricted, and clawback states', () => {
    const required = getAssetTrustlineStatus({
      issuer: VALID_ISSUER,
      flags: { auth_required: true, auth_clawback_enabled: true },
    });
    const restricted = getAssetTrustlineStatus({
      issuer: VALID_ISSUER,
      trustline: { is_authorized: false, is_authorized_to_maintain_liabilities: true },
    });

    expect(required.authorization.state).toBe('required');
    expect(required.clawbackEnabled).toBe(true);
    expect(restricted.authorization.state).toBe('maintain-liabilities');
  });
});
