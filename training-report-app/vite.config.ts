import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 允許局域網訪問
    port: 5173 // 預設 Vite 端口，可選配置
    }
})
