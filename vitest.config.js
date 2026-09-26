import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'resolve-ts-for-js',
      resolveId(source, importer) {
        if (source.endsWith('.js') && importer) {
          const resolvedPath = path.resolve(path.dirname(importer), source);
          const tsPath = resolvedPath.slice(0, -3) + '.ts';
          if (fs.existsSync(tsPath)) {
            return tsPath;
          }
        }
        return null;
      },
    },
  ],
  define: { global: 'globalThis' },
  resolve: {
    // .ts before .js to match Vite's resolve order
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.cjs', '.json'],
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
    exclude: ['.kilo/**', 'tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/main.jsx', 'src/i18n/**', 'src/styles/**'],
    },
  },
});
