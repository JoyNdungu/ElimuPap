import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [
        '..',
        'C:/Users/hp/.gemini/antigravity-ide/brain/637aa257-4162-4df1-8726-fb7e0cd6aa65'
      ]
    }
  },
})
