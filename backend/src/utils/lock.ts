/**
 * 分布式鎖工具
 * 
 * 提供簡單的鎖機制，支持：
 * - 內存鎖（單實例部署，快速響應）
 * - Redis分布式鎖（多實例部署，需要配置Redis）
 * 
 * 使用場景：
 * - 防止判決生成並發問題
 * - 防止其他關鍵操作的競態條件
 * 
 * 注意事項：
 * - 生產環境多實例部署時，必須使用Redis
 * - 鎖的TTL應設置為足夠完成操作的時間
 * - 鎖釋放失敗時會自動過期，但建議確保操作在TTL內完成
 * 
 * @example
 * ```typescript
 * await lockService.withLock('judgment:lock:caseId', async () => {
 *   // 執行需要加鎖的操作
 * }, 120); // TTL: 120秒
 * ```
 */

import logger from '../config/logger';
import { env } from '../config/env';
import { Errors } from './errors';
import Redis from 'ioredis';

/**
 * 簡單的內存鎖（單實例有效）
 * 多實例部署時需要Redis分布式鎖
 */
class SimpleLock {
  private locks: Map<string, number> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // 清理間隔（優先使用環境變量，默認1分鐘）
    const cleanupInterval = env.LOCK_CLEANUP_INTERVAL_MS || 60 * 1000;
    if (env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, cleanupInterval);
    }
  }

  /**
   * 嘗試獲取鎖
   */
  async acquire(key: string, ttlSeconds: number = 60): Promise<boolean> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const existing = this.locks.get(key);

    // 如果鎖已存在且未過期，返回false
    if (existing && existing > Date.now()) {
      return false;
    }

    // 獲取鎖
    this.locks.set(key, expiresAt);
    return true;
  }

  /**
   * 釋放鎖
   */
  async release(key: string): Promise<void> {
    this.locks.delete(key);
  }

  /**
   * 清理過期鎖
   */
  private cleanup(): void {
    const now = Date.now();
    let count = 0;

    for (const [key, expiresAt] of this.locks.entries()) {
      if (expiresAt <= now) {
        this.locks.delete(key);
        count++;
      }
    }

    if (count > 0) {
      // 根據環境調整日誌級別
      if (env.NODE_ENV === 'development') {
        logger.debug('Lock cleanup', { count });
      } else {
        // 生產環境：僅在清理大量鎖時記錄
        if (count > 5) {
          logger.info('Lock cleanup', { count });
        }
      }
    }
  }

  /**
   * 清理所有資源
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.locks.clear();
  }
}

// 全局鎖實例
const simpleLock = new SimpleLock();

/**
 * 鎖服務
 */
export class LockService {
  private redis: Redis | null = null; // Redis客戶端（可選）

  constructor() {
    // 嘗試初始化Redis（如果可用）
    this.initRedis().catch(err => {
      logger.warn('Redis not available, using simple lock', { error: err.message });
    });

    // 生產環境強制要求 Redis，除非顯式允許降級
    if (env.NODE_ENV === 'production' && !env.REDIS_URL && process.env.ALLOW_SIMPLE_LOCK !== 'true') {
      logger.error('生產環境缺少 Redis，禁止使用內存鎖，請配置 REDIS_URL 或設置 ALLOW_SIMPLE_LOCK=true 以接受風險');
    }
  }

  /**
   * 初始化Redis（可選）
   */
  private async initRedis(): Promise<void> {
    if (!env.REDIS_URL) return;
    this.redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    await this.redis.connect();
    logger.info('Redis connected for lock');
  }

  /**
   * 嘗試獲取鎖
   */
  async acquire(key: string, ttlSeconds: number = 60): Promise<boolean> {
    try {
      // 優先使用Redis分布式鎖
      if (this.redis) {
        const result = await this.redis.set(key, '1', 'PX', ttlSeconds * 1000, 'NX');
        return result === 'OK';
      }
    } catch (error) {
      logger.warn('Redis lock failed, falling back to simple lock', { key, error });
    }

    // 降級到簡單鎖
    return await simpleLock.acquire(key, ttlSeconds);
  }

  /**
   * 釋放鎖
   */
  async release(key: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(key);
        return;
      }
    } catch (error) {
      logger.warn('Redis unlock failed', { key, error });
    }

    await simpleLock.release(key);
  }

  /**
   * 執行帶鎖的操作
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    if (env.NODE_ENV === 'production' && !this.redis && process.env.ALLOW_SIMPLE_LOCK !== 'true') {
      throw Errors.INTERNAL_ERROR('缺少分布式鎖後端 (Redis)，請聯繫管理員');
    }

    const acquired = await this.acquire(key, ttlSeconds);
    
    if (!acquired) {
      throw Errors.CONFLICT('操作正在進行中，請稍後再試');
    }

    try {
      return await fn();
    } finally {
      await this.release(key);
    }
  }
}

export const lockService = new LockService();
