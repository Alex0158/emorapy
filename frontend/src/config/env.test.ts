/**
 * 環境變量配置單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const originalImportMeta = import.meta.env;

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('import.meta.env', {
    ...originalImportMeta,
    VITE_API_BASE_URL: undefined,
    VITE_APP_TITLE: undefined,
    VITE_APP_DESCRIPTION: undefined,
    DEV: false,
    PROD: true,
  });
});

describe('env', () => {
  it('應導出 env 含 apiBaseURL、appTitle、isDevelopment、isProduction', async () => {
    const { env } = await import('./env');
    expect(env).toHaveProperty('apiBaseURL');
    expect(env).toHaveProperty('appTitle');
    expect(env).toHaveProperty('appDescription');
    expect(env).toHaveProperty('isDevelopment');
    expect(env).toHaveProperty('isProduction');
    expect(typeof env.apiBaseURL).toBe('string');
  });
});
