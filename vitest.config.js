import { defineConfig } from 'vite';
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
    // Absolute path: Vite's relative-to-root URL resolution for setupFiles
    // drops the root's final path segment when it isn't slash-terminated,
    // which breaks whenever the checkout's parent directory happens to share
    // its own last path segment (e.g. a nested `foo/foo` clone).
    setupFiles: [path.resolve(__dirname, './tests/setup.js')],
    exclude: ['tests/e2e/**', '**/node_modules/**', 'docs-site/**'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/main.jsx', 'src/i18n/**', 'src/styles/**'],
    },
  },
});
