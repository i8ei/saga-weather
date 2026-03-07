import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'astronomy': ['astronomy-engine'],
        },
      },
    },
  },
  publicDir: 'public',
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
