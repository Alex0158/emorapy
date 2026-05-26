import type { IncomingMessage, ServerResponse } from 'node:http';
import { execSync } from 'node:child_process';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import pkg from './package.json';

const appVersion = pkg.version;
const appService = 'frontend-admin';
const appCommitSha = resolveCommitSha();

function resolveCommitSha(): string {
  const envSha = process.env.CJ_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (envSha) return envSha;

  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function versionManifest() {
  return {
    service: appService,
    version: appVersion,
    commitSha: appCommitSha,
    commitShortSha: appCommitSha === 'unknown' ? 'unknown' : appCommitSha.slice(0, 7),
  };
}

function versionManifestPlugin(): Plugin {
  return {
    name: 'version-manifest-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/version.json', (_req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(
          JSON.stringify(versionManifest())
        );
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(versionManifest(), null, 2),
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
    plugins: [react(), tailwindcss(), versionManifestPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/lib': path.resolve(__dirname, './src/lib'),
        '@cj/contracts': path.resolve(__dirname, '../packages/contracts/src'),
        '@cj/api-client': path.resolve(__dirname, '../packages/api-client/src'),
      },
      dedupe: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'zustand',
        'axios',
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
      include: ['react', 'react-dom', 'react-router-dom', 'axios', 'zustand'],
    },
    define: {
      __DEV__: JSON.stringify(isDevelopment),
      __PROD__: JSON.stringify(isProduction),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_APP_SERVICE': JSON.stringify(appService),
      'import.meta.env.VITE_APP_COMMIT_SHA': JSON.stringify(appCommitSha),
    },
  };
});
