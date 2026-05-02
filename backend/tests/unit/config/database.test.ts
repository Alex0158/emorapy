/**
 * config/database 單元測試（mock env、logger、PrismaClient，測試環境跳過初始化路徑）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

process.env.SKIP_DB_INIT = 'true';
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const mockPrismaInstance = {
  $connect: jest.fn(),
  $queryRaw: jest.fn(),
  $disconnect: jest.fn(),
};

const mockEnvRef: { DB_RETRY_INTERVAL: number } = { DB_RETRY_INTERVAL: 3000 };
const mockEnv = () => ({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost/test',
  DB_MAX_RETRIES: 3,
  DB_CONNECT_TIMEOUT: 10000,
  DB_RETRY_INTERVAL: mockEnvRef.DB_RETRY_INTERVAL,
});

jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnv();
  },
}));
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('../../../src/types/prisma-client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaInstance),
}));
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

import prisma from '../../../src/config/database';
import { databaseReady } from '../../../src/config/database';

describe('config/database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SKIP_DB_INIT = 'true';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
  });

  it('應導出 prisma 實例', () => {
    expect(prisma).toBeDefined();
    expect(prisma.$connect).toBeDefined();
    expect(prisma.$disconnect).toBeDefined();
  });

  it('databaseReady 應為 Promise 且可 resolve（測試環境通常跳過 DB 初始化）', async () => {
    await expect(databaseReady).resolves.toBeUndefined();
  });

  it('當 SKIP_DB_INIT=false 時應執行初始化並呼叫 parseDatabaseUrl、$connect、$queryRaw', async () => {
    process.env.SKIP_DB_INIT = 'false';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockPrismaInstance.$connect as any).mockResolvedValue(undefined);
    (mockPrismaInstance.$queryRaw as any).mockResolvedValue(undefined);
    jest.resetModules();
    const mod = await import('../../../src/config/database');
    await expect(mod.databaseReady).resolves.toBeUndefined();
    expect(mockPrismaInstance.$connect).toHaveBeenCalled();
    expect(mockPrismaInstance.$queryRaw).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('數據庫連接信息', expect.objectContaining({
      hostname: 'localhost',
      port: '5432',
      username: 'user',
      hasPassword: true,
    }));
    expect(mockLogger.info).toHaveBeenCalledWith('數據庫連接成功並驗證通過');
  });

  it('當 DATABASE_URL 無法解析時應記錄 logger.warn', async () => {
    const origUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'not-a-valid-url';
    process.env.SKIP_DB_INIT = 'false';
    (mockPrismaInstance.$connect as any).mockResolvedValue(undefined);
    (mockPrismaInstance.$queryRaw as any).mockResolvedValue(undefined);
    jest.resetModules();
    const mod = await import('../../../src/config/database');
    await expect(mod.databaseReady).resolves.toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith('無法解析 DATABASE_URL，請檢查格式');
    process.env.DATABASE_URL = origUrl;
  });

  it('TEST_USE_SQLITE=true 且 TEST_SQLITE_URL 非 file: 開頭時應在載入時拋錯', async () => {
    const origSqlite = process.env.TEST_USE_SQLITE;
    const origSqliteUrl = process.env.TEST_SQLITE_URL;
    process.env.TEST_USE_SQLITE = 'true';
    process.env.TEST_SQLITE_URL = 'postgresql://localhost/x';
    process.env.SKIP_DB_INIT = 'true';
    jest.resetModules();
    await expect(import('../../../src/config/database')).rejects.toThrow(/TEST_USE_SQLITE|file:/);
    process.env.TEST_USE_SQLITE = origSqlite;
    process.env.TEST_SQLITE_URL = origSqliteUrl;
  });

  it('當 SKIP_DB_INIT=false 且 $connect 重試耗盡時應記錄 logger.error 與 P1001 診斷', async () => {
    process.env.SKIP_DB_INIT = 'false';
    mockEnvRef.DB_RETRY_INTERVAL = 0;
    const p1001Error = Object.assign(new Error("Can't reach database server"), { code: 'P1001' });
    (mockPrismaInstance.$connect as any).mockRejectedValue(p1001Error);
    jest.resetModules();
    const mod = await import('../../../src/config/database');
    await expect(mod.databaseReady).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      '數據庫連接失敗，已用盡所有重試機會',
      expect.objectContaining({ errorCode: 'P1001', errorName: 'Error' })
    );
    expect(mockLogger.error).toHaveBeenCalledWith('連接診斷建議：', expect.objectContaining({ problem: '無法到達數據庫服務器' }));
    expect(mockLogger.warn).toHaveBeenCalledWith('應用將繼續運行，但數據庫功能可能不可用');
    mockEnvRef.DB_RETRY_INTERVAL = 3000;
  });
});
