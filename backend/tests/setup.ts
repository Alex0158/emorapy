/**
 * Jest測試環境設置
 */

// 設置測試環境變量
process.env.NODE_ENV = 'test';
// 使用環境變量中的 DATABASE_URL，如果有 TEST_DATABASE_URL 則優先使用
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/cj_platform_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-api-key';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';

// 設置測試超時
jest.setTimeout(60000);

// 抑制控制台輸出（測試時，除非 DEBUG_TESTS=true）
if (process.env.SUPPRESS_LOGS === 'true' || !process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    // 保留 warn 和 error 以便調試
    // warn: jest.fn(),
    // error: jest.fn(),
  };
}

