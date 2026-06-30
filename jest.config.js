/**
 * Jest configuration (#99)
 *
 * The primary test runner for this project is Vitest (see vitest.config.js).
 * Vitest is API-compatible with Jest, so the existing tests run unchanged
 * under either runner. This config exists so a consumer who prefers the
 * Jest CLI can run `npx jest` without further setup, and so editors that
 * auto-detect Jest can wire up their integrations.
 */

/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEach: ['<rootDir>/tests/setup.js'],

  // Match colocated tests under src/ and the legacy tests/ directory
  testMatch: [
    '<rootDir>/src/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/tests/unit/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/tests/integration/**/*.test.{js,jsx,ts,tsx}',
  ],

  // Don't try to run Playwright specs through Jest
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/', '/dist/'],

  moduleNameMapper: {
    // CSS modules and asset imports
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
    '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
  },

  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
    }],
  },

  // Allow ESM-only deps to be transformed instead of erroring on `import`
  transformIgnorePatterns: [
    '/node_modules/(?!(@stellar|stellar-base|recharts|d3-.*|lucide-react)/)',
  ],

  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/main.jsx',
    '!src/i18n/**',
    '!src/styles/**',
    '!src/**/*.test.{js,jsx,ts,tsx}',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',

  clearMocks: true,
  restoreMocks: true,
};
