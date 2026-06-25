import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle analysis: run `ANALYZE=1 npm run build` to generate dist/stats.html
    process.env.ANALYZE &&
      visualizer({
        open: false,
        filename: 'dist/stats.html',
        title: 'Stellar Dev Dashboard — Bundle Analysis',
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // 'treemap' | 'sunburst' | 'network'
      }),
    // Security headers plugin (#106): injects HTTP security headers in dev server
    {
      name: 'copy-sw',
      generateBundle() {
        // sw.js lives in /public and is emitted by Vite's publicDir handling.
      },
    },
  ],

  build: {
    // Target modern browsers for smaller output (ES2020 gives async/await, optional chaining)
    target: 'es2020',

    // Produce a sourcemap so Lighthouse and DevTools can audit the SW
    sourcemap: true,

    // Split CSS per chunk so each lazy-loaded route only loads its own styles
    cssCodeSplit: true,

    // Use esbuild for fast, effective minification
    minify: 'esbuild',

    // Inline assets smaller than 4 KB as base64 to save round trips
    assetsInlineLimit: 4096,

    // esbuild minify options: drop console/debugger in production
    esbuildOptions: {
      drop: ['debugger'],
      legalComments: 'none',
    },

    rollupOptions: {
      output: {
        // Deterministic chunk names for subresource integrity (#106)
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Manual chunks keep large libraries and feature areas cacheable while
        // route-level dynamic imports keep the app shell small.
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            if (id.includes('/src/components/charts/')) return 'charts'
            if (id.includes('/src/components/assets/')) return 'assets'
            if (id.includes('/src/components/multisig/')) return 'multisig'
            if (id.includes('/src/components/deployment/')) return 'deployment'
            return undefined
          }

          if (id.includes('@stellar/stellar-sdk')) return 'stellar-sdk'
          if (id.includes('recharts')) return 'charts-vendor'
          if (id.includes('lucide-react')) return 'icons-vendor'
          if (id.includes('i18next')) return 'i18n'
          if (id.includes('react-router-dom') || id.includes('react-router')) return 'react-vendor'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor'
          if (id.includes('date-fns')) return 'date-vendor'
          if (id.includes('zustand')) return 'react-vendor'

          return 'vendor'
        },
      },
    },
  },

  // Allow the dev server to serve sw.js at the root scope
  server: {
    headers: {
      'Service-Worker-Allowed': '/',
    },
  },

  // Allow .js imports to resolve to .ts files (TypeScript migration compatibility)
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
  },

  // Optimise deps that are CommonJS
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
})
