import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const isDevelopment = mode === 'development';
  const manualChunks = (id: string): string | undefined => {
    if (!id.includes('node_modules')) return undefined;
    if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/')) {
      return 'react-vendor';
    }
    if (id.includes('/zustand/') || id.includes('/@tanstack/react-query/')) {
      return 'state-vendor';
    }
    if (id.includes('/axios/') || id.includes('/dayjs/') || id.includes('/react-markdown/')) {
      return 'utils-vendor';
    }
    if (id.includes('/rc-table/')) {
      return 'antd-table-vendor';
    }
    if (id.includes('/rc-picker/')) {
      return 'antd-date-vendor';
    }
    if (id.includes('/rc-field-form/')) {
      return 'antd-form-vendor';
    }
    if (id.includes('/antd/')) {
      return 'antd-vendor';
    }
    return undefined;
  };

  return {
    plugins: [react(), tailwindcss()],
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
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
      chunkSizeWarningLimit: 1000,
      sourcemap: isDevelopment, // 開發環境生成sourcemap，生產環境不生成
      minify: isProduction ? 'terser' : false, // 生產環境使用terser壓縮
      terserOptions: isProduction ? {
        compress: {
          drop_console: true, // 生產環境移除console
          drop_debugger: true, // 生產環境移除debugger
        },
      } as any : undefined,
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
