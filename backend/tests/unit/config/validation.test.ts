/**
 * config/validation 單元測試
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

describe('config/validation', () => {
  beforeEach(() => {
    mockLogger.error.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
  });

  it('應在環境有效時通過驗證', async () => {
    const { validateEnvConfig } = await import('../../../src/config/validation');
    validateEnvConfig();
    expect(mockLogger.info).toHaveBeenCalledWith('Environment validation passed');
  });
});
