import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // This tells Vite to forward any request that starts with /api
      // to your backend server running on port 8080.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
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
