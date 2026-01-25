import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const isDevelopment = mode === 'development';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/pages': path.resolve(__dirname, './src/pages'),
        '@/hooks': path.resolve(__dirname, './src/hooks'),
        '@/store': path.resolve(__dirname, './src/store'),
        '@/services': path.resolve(__dirname, './src/services'),
        '@/utils': path.resolve(__dirname, './src/utils'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/assets': path.resolve(__dirname, './src/assets'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // 將React相關庫分離
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // 將Ant Design分離
            'antd-vendor': ['antd', '@ant-design/icons'],
            // 將工具庫分離
            'utils-vendor': ['axios', 'dayjs', 'react-markdown'],
            // 將狀態管理庫分離
            'state-vendor': ['zustand', '@tanstack/react-query'],
          },
        },
      },
      chunkSizeWarningLimit: 1000, // 提高警告閾值到1MB
      sourcemap: isDevelopment, // 開發環境生成sourcemap，生產環境不生成
      minify: isProduction ? 'terser' : false, // 生產環境使用terser壓縮
      terserOptions: isProduction ? {
        compress: {
          drop_console: true, // 生產環境移除console
          drop_debugger: true, // 生產環境移除debugger
        },
      } : undefined,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'antd', 'axios', 'zustand'],
    },
    define: {
      // 確保環境變量在構建時被正確替換
      __DEV__: JSON.stringify(isDevelopment),
      __PROD__: JSON.stringify(isProduction),
    },
  };
});
