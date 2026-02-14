/**
 * 緩存工具函數單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }));

import { memoryCache, sessionCache } from './cache';

describe('cache', () => {
  describe('memoryCache', () => {
    beforeEach(() => {
      memoryCache.clear();
    });

    it('set 與 get 應讀寫正確', () => {
      memoryCache.set('k1', { a: 1 });
      expect(memoryCache.get<{ a: number }>('k1')).toEqual({ a: 1 });
    });
    it('get 不存在的 key 應返回 null', () => {
      expect(memoryCache.get('none')).toBeNull();
    });
    it('set 帶 ttl 時過期後 get 應返回 null', () => {
      vi.useFakeTimers();
      memoryCache.set('exp', 'v', 1000);
      expect(memoryCache.get('exp')).toBe('v');
      vi.advanceTimersByTime(1001);
      expect(memoryCache.get('exp')).toBeNull();
      vi.useRealTimers();
    });
    it('has 應反映是否存在', () => {
      memoryCache.set('x', 1);
      expect(memoryCache.has('x')).toBe(true);
      expect(memoryCache.has('y')).toBe(false);
    });
    it('delete 應移除項', () => {
      memoryCache.set('d', 1);
      memoryCache.delete('d');
      expect(memoryCache.get('d')).toBeNull();
    });
    it('clear 應清空所有', () => {
      memoryCache.set('a', 1);
      memoryCache.set('b', 2);
      memoryCache.clear();
      expect(memoryCache.size()).toBe(0);
      expect(memoryCache.get('a')).toBeNull();
    });
    it('size 應返回條目數', () => {
      memoryCache.set('a', 1);
      memoryCache.set('b', 2);
      expect(memoryCache.size()).toBe(2);
    });
  });

  describe('sessionCache', () => {
    const mockGetItem = vi.fn();
    const mockSetItem = vi.fn();
    const mockRemoveItem = vi.fn();
    const mockClear = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('sessionStorage', {
        getItem: mockGetItem,
        setItem: mockSetItem,
        removeItem: mockRemoveItem,
        clear: mockClear,
      });
      vi.clearAllMocks();
    });

    it('set 應調用 sessionStorage.setItem 並 JSON 序列化', () => {
      sessionCache.set('k', { foo: 1 });
      expect(mockSetItem).toHaveBeenCalledWith('k', '{"foo":1}');
    });
    it('get 有值時應解析並返回', () => {
      mockGetItem.mockReturnValue('{"x":2}');
      expect(sessionCache.get<{ x: number }>('k')).toEqual({ x: 2 });
    });
    it('get 無值時應返回 null', () => {
      mockGetItem.mockReturnValue(null);
      expect(sessionCache.get('k')).toBeNull();
    });
    it('remove 應調用 sessionStorage.removeItem', () => {
      sessionCache.remove('k');
      expect(mockRemoveItem).toHaveBeenCalledWith('k');
    });
    it('clear 應調用 sessionStorage.clear', () => {
      sessionCache.clear();
      expect(mockClear).toHaveBeenCalled();
    });
    it('get 解析失敗時應返回 null 並記錄錯誤', async () => {
      mockGetItem.mockReturnValue('invalid json');
      const logger = await import('@/utils/logger');
      expect(sessionCache.get('k')).toBeNull();
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });
});
