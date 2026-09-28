import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

/**
 * Vitest config for the Node-only `api` workspace package.
 *
 * API sources are a mix of `.js` and `.ts` (e.g. `server.js` imports
 * `middleware/rateLimiter.ts` via a `.js` specifier), so we reuse the same
 * `resolve-ts-for-js` shim as the root web package. Tests run in a plain Node
 * environment and are scoped to this package only.
 */
export default defineConfig({
  plugins: [
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
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{js,ts}'],
    exclude: ['node_modules/**'],
  },
});
