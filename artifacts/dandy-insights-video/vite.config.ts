import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, '../lp-studio/src/assets')
    }
  },
  base: '/dandy-insights-video/',
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '19876'),
    strictPort: true,
    allowedHosts: true,
  }
})
