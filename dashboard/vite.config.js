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
        // target: 'http://orcos.local:5000',
        changeOrigin: true,
        secure: false,
        ws: true
      },
    },

    allowedHosts: ['.local', '.home']
  }
})
