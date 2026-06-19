import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Web 模式 Vite 配置
 * 用于独立 Web 版构建，不依赖 Electron
 */
export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
  },
  server: {
    port: 5180,
    // 开发时将 /api 和 /ws 请求代理到后端服务器
    proxy: {
      '/api': {
        target: 'http://localhost:3847',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3847',
        ws: true,
      },
    },
  },
});
