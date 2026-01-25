/**
 * 緩存工具類
 * 支持Redis（生產環境）和內存緩存（開發環境）降級
 */

import logger from '../config/logger';
import { env } from '../config/env';
import { CACHE_CONFIG } from './constants';
import Redis from 'ioredis';

// 內存緩存配置（優先使用環境變量，否則使用常量）
const DEFAULT_MAX_SIZE = env.CACHE_MAX_SIZE || CACHE_CONFIG.MAX_SIZE;
const CLEANUP_INTERVAL_MS = env.CACHE_CLEANUP_INTERVAL_MS || CACHE_CONFIG.CLEANUP_INTERVAL_MS;

/**
 * 緩存條目接口
 */
interface CacheEntry<T> {
  data: T;
  expires: number;
  lastAccessed: number; // 用於LRU算法
}

/**
 * 內存緩存實現（使用LRU算法）
 */
class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number;
  
  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * 獲取緩存值（更新訪問時間）
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // 檢查是否過期
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // 更新最後訪問時間（LRU）
    entry.lastAccessed = Date.now();
    return entry.data as T;
  }

  /**
   * 設置緩存值（使用LRU算法管理）
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    // 如果緩存已滿，刪除最久未使用的條目（LRU）
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data: value,
      expires: Date.now() + ttlSeconds * 1000,
      lastAccessed: Date.now(),
    });
  }

  /**
   * 刪除最久未使用的條目（LRU算法）
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      // 跳過已過期的條目（由cleanup處理）
      if (entry.expires < Date.now()) {
        continue;
      }
      
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('LRU eviction', { key: oldestKey });
    }
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  /**
   * 清理過期條目
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * 獲取緩存統計信息
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// 全局內存緩存實例
const memoryCache = new MemoryCache();

// 定期清理過期條目
// 根據環境調整日誌級別
setInterval(() => {
  const count = memoryCache.cleanup();
  if (count > 0) {
    if (env.NODE_ENV === 'development') {
      logger.debug('Memory cache cleanup', { count });
    } else {
      // 生產環境：僅在清理大量條目時記錄
      if (count > 10) {
        logger.info('Memory cache cleanup', { count });
      }
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * 緩存服務
 */
export class CacheService {
  private redis: Redis | null = null; // Redis客戶端（可選）

  constructor() {
    // 嘗試初始化Redis（如果可用）
    this.initRedis().catch(err => {
      logger.warn('Redis not available, using memory cache', { error: err.message });
    });
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
    logger.info('Redis connected for cache');
  }

  /**
   * 獲取緩存
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // 優先使用Redis
      if (this.redis) {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value) as T;
        }
        return null;
      }
    } catch (error) {
      logger.warn('Redis get failed, falling back to memory cache', { key, error });
    }

    // 降級到內存緩存
    return memoryCache.get<T>(key);
  }

  /**
   * 設置緩存
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      // 優先使用Redis
      if (this.redis) {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
        return;
      }
    } catch (error) {
      logger.warn('Redis set failed, falling back to memory cache', { key, error });
    }

    // 降級到內存緩存
    memoryCache.set(key, value, ttlSeconds);
  }

  /**
   * 刪除緩存
   */
  async delete(key: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(key);
      }
    } catch (error) {
      logger.warn('Redis delete failed', { key, error });
    }

    memoryCache.delete(key);
  }

  /**
   * 生成緩存鍵
   */
  static generateKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  /**
   * 生成哈希鍵（用於長字符串）
   * 使用crypto模塊確保哈希安全性和唯一性
   */
  static generateHashKey(prefix: string, content: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    // 使用前16個字符足夠唯一（可根據需要調整）
    return `${prefix}:${hash.substring(0, 16)}`;
  }
}

export const cacheService = new CacheService();
