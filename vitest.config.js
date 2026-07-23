import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' },
  resolve: {
    // .ts before .js to match Vite's resolve order
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      buffer: 'buffer',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/main.jsx', 'src/i18n/**', 'src/styles/**'],
    },
  },
});
