/**
 * 配置驗證單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLoggerError = vi.fn();
const mockLoggerInfo = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
  },
}));

vi.mock('./env', () => ({
  env: {
    apiBaseURL: 'http://localhost:3001/api/v1',
    isDevelopment: true,
  },
}));

describe('validateEnvConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('應導出 validateEnvConfig 函數', async () => {
    const mod = await import('./validation');
    expect(typeof mod.validateEnvConfig).toBe('function');
  });

  it('apiBaseURL 有效時應調用 logger.info', async () => {
    const { validateEnvConfig } = await import('./validation');
    validateEnvConfig();
    expect(mockLoggerInfo).toHaveBeenCalledWith('Environment validation passed');
  });
});
