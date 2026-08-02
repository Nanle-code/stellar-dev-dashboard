import { checkFeatureParity, getSharedLogicFeatures, getParityMatrix } from './parityMatrix';

describe('parityMatrix', () => {
  it('primary flow: returns true if feature is supported on the given platform', () => {
    expect(checkFeatureParity('authentication', 'mobile')).toBe(true);
    expect(checkFeatureParity('authentication', 'web')).toBe(true);
    expect(checkFeatureParity('biometrics', 'mobile')).toBe(true);
    expect(checkFeatureParity('biometrics', 'web')).toBe(false);
  });

  it('boundary case: handles case-insensitive and spaced feature names', () => {
    expect(checkFeatureParity('AuThEnTiCaTiOn', 'mobile')).toBe(true);
    expect(checkFeatureParity('Hardware Wallet', 'web')).toBe(true);
  });

  it('failure case: throws error when feature is not found in the matrix', () => {
    expect(() => checkFeatureParity('unknown_feature', 'mobile')).toThrow('not found in the parity matrix');
  });

  it('handles invalid input: throws error for empty or non-string feature names', () => {
    expect(() => checkFeatureParity('', 'mobile')).toThrow('Invalid input');
    expect(() => checkFeatureParity(null as any, 'mobile')).toThrow('Invalid input');
  });

  it('handles unsupported environment: throws error for invalid platforms', () => {
    expect(() => checkFeatureParity('authentication', 'desktop' as any)).toThrow('Unsupported environment');
  });

  it('identifies shared logic safely', () => {
    const shared = getSharedLogicFeatures();
    expect(shared).toContain('Authentication');
    expect(shared).toContain('Transaction Builder');
    expect(shared).not.toContain('Biometrics');
    expect(shared).not.toContain('Hardware Wallet');
  });

  it('exposes the parity matrix data', () => {
    const matrix = getParityMatrix();
    expect(matrix).toHaveProperty('authentication');
    expect(matrix.authentication.featureName).toBe('Authentication');
  });
});
