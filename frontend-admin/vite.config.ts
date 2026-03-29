import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import pkg from './package.json';

const appVersion = pkg.version;
const appService = 'frontend-admin';

function versionManifestPlugin(): Plugin {
  return {
    name: 'version-manifest-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/version.json', (_req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(
          JSON.stringify({
            service: appService,
            version: appVersion,
          })
        );
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(
          {
            service: appService,
            version: appVersion,
          },
          null,
          2
        ),
      });
    },
  };
}

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
    return undefined;
  };

  return {
    plugins: [react(), versionManifestPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'zustand',
        'antd',
        '@ant-design/icons',
      ],
    },
    server: {
      port: 5175,
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
      sourcemap: isDevelopment,
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction
        ? ({
            compress: {
              drop_console: true,
              drop_debugger: true,
            },
          } as any)
        : undefined,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'antd', 'axios', 'zustand'],
    },
    define: {
      __DEV__: JSON.stringify(isDevelopment),
      __PROD__: JSON.stringify(isProduction),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_APP_SERVICE': JSON.stringify(appService),
    },
  };
});
