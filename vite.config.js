import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Honor a PORT env var (used by the preview harness) when provided.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
