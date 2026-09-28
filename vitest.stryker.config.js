import base from './vitest.config.js';

/** Vitest config scoped for Stryker mutation testing. */
export default {
  ...base,
  test: {
    ...base.test,
    include: ['tests/unit/security.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
};
