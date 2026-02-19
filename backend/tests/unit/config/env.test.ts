/**
 * config/env 單元測試（通過 process.env 與 resetModules 覆蓋 getEnvConfig 路徑）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockLogger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

describe('config/env', () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...origEnv };
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
    process.env.OPENAI_API_KEY = 'sk-test-key';
  });

  it('應導出 env 並包含必需欄位', async () => {
    jest.resetModules();
    const mod = await import('../../../src/config/env');
    expect(mod.env).toBeDefined();
    expect(mod.env.DATABASE_URL).toBe('postgresql://localhost/test');
    expect(mod.env.JWT_SECRET).toBeDefined();
    expect(mod.env.OPENAI_API_KEY).toBe('sk-test-key');
    expect(mod.env.NODE_ENV).toBeDefined();
    expect(mod.env.PORT).toBeGreaterThanOrEqual(1);
    expect(mod.env.PORT).toBeLessThanOrEqual(65535);
  });

  it('缺少 DATABASE_URL 時應拋錯', async () => {
    delete process.env.DATABASE_URL;
    jest.resetModules();
    await expect(import('../../../src/config/env')).rejects.toThrow(/缺少必需的環境變量|DATABASE_URL/);
  });

  it('缺少 JWT_SECRET 時應拋錯', async () => {
    delete process.env.JWT_SECRET;
    jest.resetModules();
    await expect(import('../../../src/config/env')).rejects.toThrow(/缺少必需的環境變量|JWT_SECRET/);
  });

  it('缺少 OPENAI_API_KEY 時應拋錯', async () => {
    delete process.env.OPENAI_API_KEY;
    jest.resetModules();
    await expect(import('../../../src/config/env')).rejects.toThrow(/缺少必需的環境變量|OPENAI_API_KEY/);
  });

  it('PORT 無效時應拋錯', async () => {
    process.env.PORT = '99999';
    jest.resetModules();
    await expect(import('../../../src/config/env')).rejects.toThrow(/無效的端口號|1-65535|環境變量驗證失敗|PORT must be between/);
  });

  it('應解析可選欄位默認值', async () => {
    jest.resetModules();
    const mod = await import('../../../src/config/env');
    expect(mod.env.JWT_EXPIRES_IN).toBeDefined();
    expect(mod.env.AI_MOCK).toBe(false);
  });

  it('DATABASE_URL 非 postgresql 開頭時在 development 應記錄 warn', async () => {
    process.env.DATABASE_URL = 'http://localhost/db';
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    await import('../../../src/config/env');
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'));
  });

  it('JWT_SECRET 長度不足 32 時在 development 應記錄 warn', async () => {
    process.env.JWT_SECRET = 'short';
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    await import('../../../src/config/env');
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
  });

  it('OPENAI_API_KEY 非 sk- 開頭時在 development 應記錄 warn', async () => {
    process.env.OPENAI_API_KEY = 'invalid-prefix';
    process.env.NODE_ENV = 'development';
    jest.resetModules();
    await import('../../../src/config/env');
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('OPENAI_API_KEY'));
  });

  it('生產環境 DATABASE_URL 非 postgresql 開頭時應拋錯', async () => {
    process.env.DATABASE_URL = 'http://localhost/db';
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    await expect(import('../../../src/config/env')).rejects.toThrow(/DATABASE_URL|postgresql/);
  });
});
