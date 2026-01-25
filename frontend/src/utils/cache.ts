/**
 * 緩存工具函數
 */

interface CacheItem<T> {
  value: T;
  expiry: number;
}

/**
 * 內存緩存類
 */
class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();

  set<T>(key: string, value: T, ttl: number = 0): void {
    const expiry = ttl > 0 ? Date.now() + ttl : Infinity;
    this.cache.set(key, { value, expiry });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const memoryCache = new MemoryCache();

/**
 * 使用SessionStorage的緩存
 */
export const sessionCache = {
  set: <T>(key: string, value: T): void => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('SessionStorage set error:', error);
      }
    }
  },

  get: <T>(key: string): T | null => {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('SessionStorage get error:', error);
      }
      return null;
    }
  },

  remove: (key: string): void => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('SessionStorage remove error:', error);
      }
    }
  },

  clear: (): void => {
    try {
      sessionStorage.clear();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('SessionStorage clear error:', error);
      }
    }
  },
};

