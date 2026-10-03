import { describe, expect, it } from 'vitest';
import { validateStrictAllowlist } from '../../scripts/check-strict-tsconfig.mjs';

const BASELINE = ['src/lib/stellar', 'src/design-system', 'src/types'];

describe('strict TypeScript allowlist ratchet', () => {
  it('accepts the baseline allowlist for the strict config', () => {
    expect(() => validateStrictAllowlist(BASELINE, BASELINE)).not.toThrow();
  });

  it('allows adding a new directory to the strict allowlist', () => {
    expect(() => validateStrictAllowlist([...BASELINE, 'src/lib/feature-flags'], BASELINE)).not.toThrow();
  });

  it('rejects removing an existing approved directory from the strict allowlist', () => {
    expect(() => validateStrictAllowlist(['src/design-system', 'src/types'], BASELINE)).toThrow(
      /strict allowlist/i
    );
  });
});
