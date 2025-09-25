import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@services': resolve(__dirname, './src/services'),
      '@scene': resolve(__dirname, './src/scene'),
      '@objects': resolve(__dirname, './src/objects'),
      '@animation': resolve(__dirname, './src/animation'),
      '@interaction': resolve(__dirname, './src/interaction'),
      '@state': resolve(__dirname, './src/state'),
      '@layout': resolve(__dirname, './src/layout'),
      '@controls': resolve(__dirname, './src/controls'),
    },
  },
})