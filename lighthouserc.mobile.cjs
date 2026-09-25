/**
 * Lighthouse CI Mobile Configuration
 *
 * Enforces mobile performance budgets (LCP, CLS, TBT) on key routes.
 *
 * @type {import('@lhci/cli').LHCI.ServerCommand.Options}
 */

'use strict';

const {
  generateAssertMatrix,
  DEFAULT_CHROME_FLAGS,
  getDeviceBudgets,
} = require('./scripts/lighthouse-budgets.cjs');

const deviceProfile = getDeviceBudgets('mobile');

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      isSinglePageApplication: true,
      numberOfRuns: 3,
      additive: true,
      url: [
        'http://localhost/',
        'http://localhost/connect',
        'http://localhost/overview',
        'http://localhost/analytics',
        'http://localhost/transactions',
        'http://localhost/network',
      ],
      settings: {
        formFactor: deviceProfile.formFactor,
        screenEmulation: deviceProfile.screenEmulation,
        throttling: deviceProfile.throttling,
        chromeFlags: DEFAULT_CHROME_FLAGS.join(' '),
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        skipAudits: ['uses-http2'],
      },
    },
    assert: {
      includePassedAssertions: true,
      assertMatrix: generateAssertMatrix('mobile'),
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
