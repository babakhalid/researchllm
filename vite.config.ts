import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Proxy API requests to the Python backend
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Handle streaming responses properly
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Ensure streaming responses work correctly
            if (proxyRes.headers['content-type']?.includes('application/x-ndjson')) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['connection'] = 'keep-alive';
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
