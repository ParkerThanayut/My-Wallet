import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // ปิด source map เพื่อแก้ปัญหา CSP eval และ Error กวนใจ
  },
})
