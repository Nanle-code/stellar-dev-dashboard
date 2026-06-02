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
      // During build, Vite processes public/ automatically — sw.js placed in
      // public/ is already handled. This plugin just confirms it's included.
      generateBundle() {
        // sw.js lives in /public and is emitted by Vite's publicDir handling.
        // Nothing extra needed; this hook serves as documentation.
      },
    },
  ],

  build: {
    // Produce a sourcemap so Lighthouse and DevTools can audit the SW
    sourcemap: true,

    rollupOptions: {
      output: {
        // Deterministic chunk names for subresource integrity (#106)
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Manual chunks — keep vendor code in stable, cacheable files.
        // Chunk strategy:
        //   stellar-sdk  — Stellar SDK + XDR (largest dep, changes rarely)
        //   react-vendor — React core + router (stable, long cache TTL)
        //   ui-vendor    — Recharts + Lucide icons (changes with design work)
        //   i18n         — i18next runtime (only needed after first render)
        // Everything else lands in the default index chunk.
        manualChunks: {
          'stellar-sdk': ['@stellar/stellar-sdk'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'recharts'],
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
  },

  // Allow the dev server to serve sw.js at the root scope
  server: {
    headers: {
      // Required for SharedArrayBuffer (not needed here) and to allow the SW
      // to intercept all requests under origin.
      'Service-Worker-Allowed': '/',
    },
  },

  // Optimise deps that are CommonJS
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});