import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // Exit if port 5173 is already in use
    proxy: {
      // Proxy to DigitalOcean production backend for local dev
      '/api': {
        target: process.env.VITE_API_URL || 'https://coral-app-rgki8.ondigitalocean.app',
        changeOrigin: true,
        secure: true,
        // Don't rewrite the path - keep /api prefix for backend routing
        // rewrite: (path) => path.replace(/^\/api/, '') 
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure proper SPA routing in build
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  // Ensure _redirects file is copied for SPA routing
  publicDir: 'public'
})
