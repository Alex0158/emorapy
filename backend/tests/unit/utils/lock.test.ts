/**
 * utils/lock (LockService) 單元測試
 * 使用內存鎖路徑（REDIS_URL 未設置）
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockEnvRef = {
  current: {
    REDIS_URL: undefined as string | undefined,
    NODE_ENV: 'test' as string,
    LOCK_CLEANUP_INTERVAL_MS: 60 * 1000,
  },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));
jest.mock('../../../src/config/env', () => ({
  get env() {
    return mockEnvRef.current;
  },
}));

const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisConnect = jest.fn();
const mockRedisOn = jest.fn();
const mockRedisRemoveListener = jest.fn();
const mockRedisDisconnect = jest.fn();
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    connect: mockRedisConnect,
    set: mockRedisSet,
    del: mockRedisDel,
    on: mockRedisOn,
    removeListener: mockRedisRemoveListener,
    disconnect: mockRedisDisconnect,
  })),
}));

import { LockService, lockService } from '../../../src/utils/lock';

describe('utils/lock', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockEnvRef.current = {
      REDIS_URL: undefined,
      NODE_ENV: 'test',
      LOCK_CLEANUP_INTERVAL_MS: 60 * 1000,
    };
    (mockRedisConnect as any).mockResolvedValue(undefined);
    (mockRedisSet as any).mockResolvedValue('OK');
    (mockRedisDel as any).mockResolvedValue(1);
    (mockRedisOn as any).mockReturnValue(undefined);
    (mockRedisRemoveListener as any).mockReturnValue(undefined);
    (mockRedisDisconnect as any).mockReturnValue(undefined);
    // 釋放測試用 key，避免跨用例殘留
    await lockService.release('lock-key');
    await lockService.release('lock-key-2');
    await lockService.release('lock-conflict');
  });

  describe('LockService (memory path)', () => {
    it('acquire 新 key 應返回 true', async () => {
      const got = await lockService.acquire('lock-key', 60);
      expect(got).toBe(true);
    });

    it('同一 key 重複 acquire 應返回 false', async () => {
      await lockService.acquire('lock-key', 60);
      const second = await lockService.acquire('lock-key', 60);
      expect(second).toBe(false);
    });

    it('release 後可再次 acquire', async () => {
      await lockService.acquire('lock-key', 60);
      await lockService.release('lock-key');
      const got = await lockService.acquire('lock-key', 60);
      expect(got).toBe(true);
    });

    it('withLock 應執行 fn 並返回結果', async () => {
      const result = await lockService.withLock('lock-key-2', async () => 42, 60);
      expect(result).toBe(42);
    });

    it('withLock 應在執行後釋放鎖', async () => {
      await lockService.withLock('lock-key-2', async () => undefined, 60);
      const got = await lockService.acquire('lock-key-2', 60);
      expect(got).toBe(true);
    });

    it('withLock 在無法獲取鎖時應拋出 CONFLICT', async () => {
      await lockService.acquire('lock-conflict', 60);
      await expect(
        lockService.withLock('lock-conflict', async () => 'ok', 60)
      ).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('進行中') });
      await lockService.release('lock-conflict');
    });

    it('release 不存在的 key 應不拋錯（邊界：冪等釋放）', async () => {
      await expect(lockService.release('nonexistent-key')).resolves.not.toThrow();
    });

    it('getBackendStatus 在 test 無 Redis 時應返回 simple-lock', () => {
      expect(lockService.getBackendStatus()).toBe('simple-lock');
    });

    it('withLock 當 fn 拋錯時仍應釋放鎖（高風險：併發冪等）', async () => {
      await expect(
        lockService.withLock('lock-key-2', async () => {
          throw new Error('業務錯誤');
        }, 60)
      ).rejects.toThrow('業務錯誤');
      const got = await lockService.acquire('lock-key-2', 60);
      expect(got).toBe(true);
    });
  });

  describe('withLock (production 無 Redis)', () => {
    it('生產環境且無 Redis 且未設 ALLOW_SIMPLE_LOCK 時應拋出 INTERNAL_ERROR', async () => {
      mockEnvRef.current.NODE_ENV = 'production';
      const orig = process.env.ALLOW_SIMPLE_LOCK;
      delete process.env.ALLOW_SIMPLE_LOCK;
      await expect(
        lockService.withLock('prod-lock', async () => 1, 60)
      ).rejects.toMatchObject({ code: 'INTERNAL_ERROR', message: expect.stringContaining('Redis') });
      process.env.ALLOW_SIMPLE_LOCK = orig;
      mockEnvRef.current.NODE_ENV = 'test';
    });
  });

  describe('LockService (Redis path)', () => {
    it('REDIS_URL 設置且 Redis set 成功時 acquire 應返回 true', async () => {
      mockEnvRef.current.REDIS_URL = 'redis://localhost';
      jest.resetModules();
      const { lockService: svc } = await import('../../../src/utils/lock');
      await new Promise((r) => setImmediate(r));
      (mockRedisSet as any).mockResolvedValue('OK');
      const got = await svc.acquire('redis-key', 60);
      expect(got).toBe(true);
      expect(mockRedisSet).toHaveBeenCalledWith('redis-key', '1', 'PX', 60000, 'NX');
    });

    it('Redis set 失敗時應降級到內存鎖並記錄 logger.warn', async () => {
      mockEnvRef.current.REDIS_URL = 'redis://localhost';
      jest.resetModules();
      const { lockService: svc } = await import('../../../src/utils/lock');
      await new Promise((r) => setImmediate(r));
      (mockRedisSet as any).mockRejectedValue(new Error('redis down'));
      const got = await svc.acquire('fallback-key', 60);
      expect(got).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Redis lock failed, falling back to simple lock', expect.objectContaining({ key: 'fallback-key', error: expect.any(Error) }));
    });

    it('Redis del 失敗時應記錄 logger.warn 並仍調用 simpleLock.release', async () => {
      mockEnvRef.current.REDIS_URL = 'redis://localhost';
      jest.resetModules();
      const { lockService: svc } = await import('../../../src/utils/lock');
      await new Promise((r) => setImmediate(r));
      await svc.acquire('release-key', 60);
      (mockRedisDel as any).mockRejectedValue(new Error('del failed'));
      await svc.release('release-key');
      expect(mockRedisDel).toHaveBeenCalledWith('release-key');
      expect(mockLogger.warn).toHaveBeenCalledWith('Redis unlock failed, falling back to simple lock', expect.objectContaining({ key: 'release-key', error: expect.any(Error) }));
    });

    it('Redis set 返回 null（key 已存在）時 acquire 應返回 false', async () => {
      mockEnvRef.current.REDIS_URL = 'redis://localhost';
      jest.resetModules();
      const { lockService: svc } = await import('../../../src/utils/lock');
      await new Promise((r) => setImmediate(r));
      (mockRedisSet as any).mockResolvedValue(null);
      const got = await svc.acquire('existing-key', 60);
      expect(got).toBe(false);
    });

    it('Redis acquire 失敗後後續請求不應再次觸發 Redis set', async () => {
      mockEnvRef.current.REDIS_URL = 'redis://localhost';
      jest.resetModules();
      const { lockService: svc } = await import('../../../src/utils/lock');
      await new Promise((r) => setImmediate(r));
      (mockRedisSet as any).mockRejectedValueOnce(new Error('redis down'));

      const first = await svc.acquire('first-fallback-key', 60);
      const second = await svc.acquire('second-fallback-key', 60);

      expect(first).toBe(true);
      expect(second).toBe(true);
      expect(mockRedisSet).toHaveBeenCalledTimes(1);
      expect(mockRedisDisconnect).toHaveBeenCalled();
    });
  });

  describe('SimpleLock cleanup (NODE_ENV=development)', () => {
    it('development 時應設 cleanupInterval 且定時清理過期鎖', async () => {
      jest.useFakeTimers();
      mockEnvRef.current.REDIS_URL = undefined;
      mockEnvRef.current.NODE_ENV = 'development';
      mockEnvRef.current.LOCK_CLEANUP_INTERVAL_MS = 100;
      jest.resetModules();
      const logger = require('../../../src/config/logger').default;
      const { lockService: svc } = await import('../../../src/utils/lock');
      await Promise.resolve();
      await svc.acquire('expire-key', 0.001);
      jest.advanceTimersByTime(150);
      expect(logger.debug).toHaveBeenCalledWith('Lock cleanup', expect.objectContaining({ count: expect.any(Number) }));
      jest.useRealTimers();
      mockEnvRef.current.NODE_ENV = 'test';
    });
  });

  describe('LockService constructor (production 無 Redis)', () => {
    it('生產環境且無 REDIS_URL 且未設 ALLOW_SIMPLE_LOCK 時應記錄 logger.error', async () => {
      jest.useFakeTimers();
      mockEnvRef.current.NODE_ENV = 'production';
      mockEnvRef.current.REDIS_URL = undefined;
      const orig = process.env.ALLOW_SIMPLE_LOCK;
      delete process.env.ALLOW_SIMPLE_LOCK;
      mockLogger.error.mockClear();
      jest.resetModules();
      await import('../../../src/utils/lock');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('生產環境缺少 Redis')
      );
      jest.useRealTimers();
      process.env.ALLOW_SIMPLE_LOCK = orig;
      mockEnvRef.current.NODE_ENV = 'test';
    });
  });

  describe('SimpleLock cleanup (NODE_ENV=production, count > 5)', () => {
    it('production 時清理超過 5 個過期鎖應記錄 logger.info', async () => {
      jest.useFakeTimers();
      mockEnvRef.current.REDIS_URL = undefined;
      mockEnvRef.current.NODE_ENV = 'production';
      mockEnvRef.current.LOCK_CLEANUP_INTERVAL_MS = 80;
      jest.resetModules();
      const { lockService: svc } = await import('../../../src/utils/lock');
      await Promise.resolve();
      for (let i = 0; i < 7; i++) {
        await svc.acquire(`prod-expire-${i}`, 0.001);
      }
      jest.advanceTimersByTime(100);
      expect(mockLogger.info).toHaveBeenCalledWith('Lock cleanup', expect.objectContaining({ count: 7 }));
      jest.useRealTimers();
      mockEnvRef.current.NODE_ENV = 'test';
    });
  });
});
