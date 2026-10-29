import { defineConfig } from 'vite'
import { precompileTemplates } from './scripts/template-plugin.mjs'

export default defineConfig({
  plugins: [precompileTemplates()],
  // 仅转发真实 API；演示数据必须通过 ?demo=1 显式开启。
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8091', changeOrigin: false },
      '/media': { target: 'http://127.0.0.1:8091', changeOrigin: false }
    }
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
