/**
 * helpers 工具單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { delay, deepClone, generateId, debounce, throttle } from './helpers';

describe('helpers', () => {
  describe('delay', () => {
    it('應在指定 ms 後 resolve', async () => {
      const start = Date.now();
      await delay(20);
      expect(Date.now() - start).toBeGreaterThanOrEqual(18);
    });
  });

  describe('deepClone', () => {
    it('null 與非對象應原樣返回', () => {
      expect(deepClone(null)).toBe(null);
      expect(deepClone(1)).toBe(1);
      expect(deepClone('a')).toBe('a');
    });
    it('應深拷貝對象', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect((cloned as { a: number; b: { c: number } }).b).not.toBe(obj.b);
    });
    it('應深拷貝陣列', () => {
      const arr = [1, { x: 2 }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect((cloned as (number | { x: number })[])[1]).not.toBe(arr[1]);
    });
    it('應正確拷貝 Date', () => {
      const d = new Date('2025-01-01');
      const cloned = deepClone(d);
      expect(cloned).toEqual(d);
      expect(cloned).not.toBe(d);
    });
  });

  describe('generateId', () => {
    it('應返回非空字串', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
    it('連續調用應返回不同值', () => {
      const a = generateId();
      const b = generateId();
      expect(a).not.toBe(b);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });
    it('應在 wait 後執行一次', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      debounced();
      debounced();
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });
    it('在 limit 內多次調用應只執行一次', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      throttled();
      throttled();
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
