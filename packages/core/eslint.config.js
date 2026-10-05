export default [
  {
    files: ['src/**/*.ts', '__tests__/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        TextEncoder: 'readonly',
        BigInt: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-native', 'react-dom'],
              message: 'Core package must not import React or React Native',
            },
            {
              group: ['@react-native-*', '@react-navigation/*'],
              message: 'Core package must not import React Native packages',
            },
            {
              group: ['window', 'document', 'navigator', 'localStorage', 'sessionStorage'],
              message: 'Core package must not use browser globals directly',
            },
          ],
        },
      ],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.*'],
  },
];