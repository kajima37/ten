import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  base: '/',
  build: { outDir: 'dist/client' },
  plugins: [tailwindcss(), viteReact()],
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
      '/auth': 'http://localhost:8788',
    },
  },
})

export default config
