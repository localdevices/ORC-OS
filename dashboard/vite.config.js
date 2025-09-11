import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        timeout: 500000,      // 500 seconds timeout for uploads
        proxyTimeout: 500000, // Timeout for backend responses
        rewrite: (path) => path.replace(/^\/api/, ''),

      },
    },

//    allowedHosts: ['framework', 'hades.local', 'hades', 'hades.home']
    allowedHosts: ['.local', '.home']
  }
})
