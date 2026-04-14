import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In Docker Compose, set API_PROXY_TARGET=http://server:4000 on the Vite service
// so /api is forwarded to the API container (localhost inside the client container is wrong).
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
