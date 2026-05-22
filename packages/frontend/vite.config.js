import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/chat': process.env.VITE_BACKEND_URL || 'http://127.0.0.1:4000',
      '/health': process.env.VITE_BACKEND_URL || 'http://127.0.0.1:4000',
      '/models': process.env.VITE_BACKEND_URL || 'http://127.0.0.1:4000',
      '/api': process.env.VITE_BACKEND_URL || 'http://127.0.0.1:4000',
    },
  }
})
