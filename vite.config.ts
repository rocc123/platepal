import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4521,
    strictPort: true,
    proxy: {
      '/api/usda': {
        target: 'https://api.nal.usda.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/usda/, '/fdc/v1'),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4521,
    strictPort: true,
  },
})
