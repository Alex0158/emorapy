/**
 * utils/cache (CacheService) 單元測試
 * 使用內存緩存路徑（REDIS_URL 未設置）及 Redis 路徑
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockEnvRef = {
  current: {
    REDIS_URL: undefined as string | undefined,
    CACHE_MAX_SIZE: 1000,
    CACHE_CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
    NODE_ENV: 'test',
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

const mockRedisInstance = {
  connect: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => mockRedisInstance),
}));

// REDIS_URL 未設置時 CacheService 不創建 Redis，僅用內存緩存
import { CacheService, cacheService } from '../../../src/utils/cache';

describe('utils/cache', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockEnvRef.current = {
      REDIS_URL: undefined,
      CACHE_MAX_SIZE: 1000,
      CACHE_CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
      NODE_ENV: 'test',
    };
    (mockRedisInstance.connect as any).mockResolvedValue(undefined);
    (mockRedisInstance.get as any).mockResolvedValue(null);
    (mockRedisInstance.setex as any).mockResolvedValue('OK');
    (mockRedisInstance.del as any).mockResolvedValue(1);
    // 清空內存緩存（通過 delete 我們將要用的 key）
    await cacheService.delete('test-key');
    await cacheService.delete('k1');
  });

  describe('CacheService.generateKey', () => {
    it('應將 prefix 與 parts 用冒號連接', () => {
      expect(CacheService.generateKey('p', 'a', 1)).toBe('p:a:1');
      expect(CacheService.generateKey('user', 'id', '123')).toBe('user:id:123');
    });
  });

  describe('CacheService.generateHashKey', () => {
    it('應返回 prefix 加內容的哈希前16字符', () => {
      const key = CacheService.generateHashKey('h', 'hello');
      expect(key).toMatch(/^h:[a-f0-9]{16}$/);
    });
    it('相同內容應生成相同 key', () => {
      expect(CacheService.generateHashKey('p', 'same')).toBe(CacheService.generateHashKey('p', 'same'));
    });
    it('不同內容應生成不同 key', () => {
      expect(CacheService.generateHashKey('p', 'a')).not.toBe(CacheService.generateHashKey('p', 'b'));
    });
  });

  describe('cacheService (memory path)', () => {
    it('set 後 get 應返回相同值', async () => {
      await cacheService.set('test-key', { x: 1 }, 3600);
      const value = await cacheService.get<{ x: number }>('test-key');
      expect(value).toEqual({ x: 1 });
    });

    it('未設置的 key 應返回 null', async () => {
      const value = await cacheService.get('nonexistent');
      expect(value).toBeNull();
    });

    it('delete 後 get 應返回 null', async () => {
      await cacheService.set('k1', 'v1', 3600);
      await cacheService.delete('k1');
      const value = await cacheService.get('k1');
      expect(value).toBeNull();
    });

    it('過期條目 get 應返回 null', async () => {
      // 使用極短 TTL（1ms）並延遲，避免 ttlSeconds=0 時與 Date.now() 同毫秒導致未過期
      await cacheService.set('expired', 'v', 0.001);
      await new Promise(r => setTimeout(r, 20));
      const value = await cacheService.get('expired');
      expect(value).toBeNull();
    });
  });

  describe('LRU eviction (memory cache full)', () => {
    it('緩存滿時 set 新 key 應觸發 LRU 驅逐並記錄 logger.debug', async () => {
      mockEnvRef.current.CACHE_MAX_SIZE = 3;
      jest.resetModules();
      const { cacheService: svc } = await import('../../../src/utils/cache');
      await svc.set('a', 1, 3600);
      await new Promise(r => setTimeout(r, 2));
      await svc.set('b', 2, 3600);
      await svc.set('c', 3, 3600);
      await svc.set('d', 4, 3600);
      expect(mockLogger.debug).toHaveBeenCalledWith('LRU eviction', { key: 'a' });
      const gotA = await svc.get<number>('a');
      expect(gotA).toBeNull();
    });

  });

  describe('setInterval cleanup', () => {
    it('development 且 cleanup 有過期條目時應記錄 logger.debug', async () => {
      jest.useFakeTimers();
      mockEnvRef.current.CACHE_CLEANUP_INTERVAL_MS = 100;
      mockEnvRef.current.NODE_ENV = 'development';
      jest.resetModules();
      const { cacheService: svc } = await import('../../../src/utils/cache');
      await Promise.resolve();
      await svc.set('expire-soon', 'v', 0.001);
      jest.advanceTimersByTime(150);
      expect(mockLogger.debug).toHaveBeenCalledWith('Memory cache cleanup', { count: expect.any(Number) });
      jest.useRealTimers();
      mockEnvRef.current.NODE_ENV = 'test';
    });

    it('緩存滿時 set 已存在的 key 應更新值且不觸發 LRU 驅逐', async () => {
      mockEnvRef.current.CACHE_MAX_SIZE = 2;
      jest.resetModules();
      const { cacheService: svc } = await import('../../../src/utils/cache');
      await svc.set('a', 1, 3600);
      await new Promise(r => setTimeout(r, 2));
      await svc.set('b', 2, 3600);
      mockLogger.debug.mockClear();
      await svc.set('a', 99, 3600);
      expect(mockLogger.debug).not.toHaveBeenCalled();
      const value = await svc.get<number>('a');
      expect(value).toBe(99);
    });
  });

  describe('cacheService (Redis path)', () => {
    it('REDIS_URL 設置且 connect 成功時應使用 Redis get/set', async () => {
      mockEnvRef.current.REDIS_URL = 'redis://localhost';
      (mockRedisInstance.get as any).mockResolvedValue(JSON.stringify({ x: 1 }));
      jest.resetModules();
      const { cacheService: svc } = await import('../../../src/utils/cache');
      await new Promise(r => setImmediate(r));
      const value = await svc.get<{ x: number }>('k');
      expect(value).toEqual({ x: 1 });
      expect(mockRedisInstance.get).toHaveBeenCalledWith('k');
    });

    it('Redis get 拋錯時應降級到內存緩存並記錄 logger.warn', async () => {
      mockEnvRef.current.REDIS_URL = 'redis://localhost';
      (mockRedisInstance.setex as any).mockRejectedValue(new Error('redis down'));
      jest.resetModules();
      const { cacheService: svc } = await import('../../../src/utils/cache');
      await new Promise(r => setImmediate(r));
      await svc.set('fallback', 'v', 3600);
      (mockRedisInstance.get as any).mockRejectedValue(new Error('redis down'));
      const value = await svc.get<string>('fallback');
      expect(value).toBe('v');
      expect(mockLogger.warn).toHaveBeenCalledWith('Redis get failed, falling back to memory cache', expect.any(Object));
    });

    it('Redis init 失敗時應記錄 logger.warn', async () => {
      mockEnvRef.current.REDIS_URL = 'redis://localhost';
      (mockRedisInstance.connect as any).mockRejectedValue(new Error('connect failed'));
      jest.resetModules();
      await import('../../../src/utils/cache');
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));
      expect(mockLogger.warn).toHaveBeenCalledWith('Redis not available, using memory cache', expect.any(Object));
    });

    it('Redis delete 拋錯時應記錄 logger.warn 並仍刪除內存', async () => {
      mockEnvRef.current.REDIS_URL = 'redis://localhost';
      (mockRedisInstance.del as any).mockRejectedValue(new Error('del failed'));
      jest.resetModules();
      const { cacheService: svc } = await import('../../../src/utils/cache');
      await new Promise(r => setImmediate(r));
      await svc.set('k', 1, 3600);
      await svc.delete('k');
      expect(mockLogger.warn).toHaveBeenCalledWith('Redis delete failed', expect.any(Object));
      const got = await svc.get('k');
      expect(got).toBeNull();
    });
  });
});
