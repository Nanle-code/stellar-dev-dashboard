import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    // Bundle analysis plugin (optional, install rollup-plugin-visualizer to enable)
    // process.env.ANALYZE && visualizer({
    //   open: false,
    //   filename: 'dist/stats.html',
    //   title: 'Bundle Analysis'
    // }),
    // Security headers plugin (#106): injects HTTP security headers in dev server
    {
      name: 'security-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader(
            'Content-Security-Policy',
            [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.stellar.org wss:",
              "font-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          )
          res.setHeader('X-Content-Type-Options', 'nosniff')
          res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
          res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
          next()
        })
      },
    },
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  build: {
    // Prevent source maps in production to avoid leaking internals (#106)
    sourcemap: false,
    // Use default minifier (esbuild)
    // Code splitting for better caching
    rollupOptions: {
      output: {
        // Deterministic chunk names for subresource integrity (#106)
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Manual chunks for common libraries
        manualChunks: {
          'stellar-sdk': ['@stellar/stellar-sdk'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', 'recharts'],
        },
      },
    },
  },
})
