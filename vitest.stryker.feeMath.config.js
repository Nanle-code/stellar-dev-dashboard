import base from './vitest.config.js';

/** Vitest config scoped for the fee-math Stryker mutation gate (#895). */
export default {
  ...base,
  test: {
    ...base.test,
    include: ['tests/unit/feeMath.mutation.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
};
