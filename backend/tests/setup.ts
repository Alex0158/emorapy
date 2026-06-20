/**
 * Jest測試環境設置
 */

import { existsSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const backendRoot = path.resolve(__dirname, '..');

// 測試環境需主動載入 dotenv；否則 env.ts 在 NODE_ENV=test 下不會再讀取 .env。
for (const filename of ['.env.test.local', '.env.test', '.env']) {
  const envPath = path.join(backendRoot, filename);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

// 設置測試環境變量
process.env.NODE_ENV = 'test';
if (!process.env.TEST_REDIS_URL) {
  delete process.env.REDIS_URL;
}
// 使用環境變量中的 DATABASE_URL，如果有 TEST_DATABASE_URL 則優先使用
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:password@localhost:5432/emorapy_platform_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-api-key';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.SKIP_RATE_LIMIT = process.env.SKIP_RATE_LIMIT || 'true';

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

afterAll(async () => {
  const clients = Object.values(require.cache)
    .map((cachedModule) => cachedModule?.exports?.default)
    .filter((client): client is { $disconnect: () => Promise<void> } => typeof client?.$disconnect === 'function');

  await Promise.all(clients.map((client) => client.$disconnect()));
});
