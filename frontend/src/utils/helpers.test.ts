/**
 * helpers 工具單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { delay, deepClone, generateId, debounce, throttle, isMobile, isTablet, isDesktop, scrollToElement, copyToClipboard } from './helpers';

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

  describe('isMobile', () => {
    it('innerWidth < 768 應返回 true', () => {
      Object.defineProperty(window, 'innerWidth', { value: 767, writable: true });
      expect(isMobile()).toBe(true);
    });
    it('innerWidth >= 768 應返回 false', () => {
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true });
      expect(isMobile()).toBe(false);
    });
  });

  describe('isTablet', () => {
    it('768 <= innerWidth < 1024 應返回 true', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      expect(isTablet()).toBe(true);
    });
    it('innerWidth < 768 應返回 false', () => {
      Object.defineProperty(window, 'innerWidth', { value: 767, writable: true });
      expect(isTablet()).toBe(false);
    });
  });

  describe('isDesktop', () => {
    it('innerWidth >= 1024 應返回 true', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
      expect(isDesktop()).toBe(true);
    });
    it('innerWidth < 1024 應返回 false', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1023, writable: true });
      expect(isDesktop()).toBe(false);
    });
  });

  describe('scrollToElement', () => {
    it('元素存在時應呼叫 scrollTo', () => {
      const scrollTo = vi.fn();
      const getBoundingClientRect = vi.fn(() => ({ top: 100 }));
      const mockEl = { getBoundingClientRect };
      vi.stubGlobal('document', {
        getElementById: vi.fn(() => mockEl),
      });
      vi.stubGlobal('window', { ...window, pageYOffset: 0, scrollTo });
      scrollToElement('target', 10);
      expect(scrollTo).toHaveBeenCalledWith({ top: 90, behavior: 'smooth' });
    });
    it('元素不存在時不應呼叫 scrollTo', () => {
      const scrollTo = vi.fn();
      vi.stubGlobal('document', { getElementById: vi.fn(() => null) });
      vi.stubGlobal('window', { ...window, scrollTo });
      scrollToElement('missing');
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('copyToClipboard', () => {
    it('navigator.clipboard 可用時應寫入並返回 true', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      const result = await copyToClipboard('hello');
      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith('hello');
    });
    it('clipboard 失敗時降級 execCommand 成功應返回 true', async () => {
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
      const removeChild = vi.fn();
      const appendChild = vi.fn();
      const execCommand = vi.fn().mockReturnValue(true);
      vi.stubGlobal('document', {
        createElement: () => ({
          value: '',
          style: {},
          select: vi.fn(),
        }),
        body: { appendChild, removeChild },
        execCommand,
      });
      const result = await copyToClipboard('fallback');
      expect(appendChild).toHaveBeenCalled();
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(removeChild).toHaveBeenCalled();
      expect(result).toBe(true);
    });
    it('降級 execCommand 拋錯時應 removeChild 並返回 false', async () => {
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
      const removeChild = vi.fn();
      vi.stubGlobal('document', {
        createElement: () => ({ value: '', style: {}, select: vi.fn() }),
        body: { appendChild: vi.fn(), removeChild },
        execCommand: vi.fn().mockImplementation(() => {
          throw new Error('execCommand failed');
        }),
      });
      const result = await copyToClipboard('x');
      expect(removeChild).toHaveBeenCalled();
      expect(result).toBe(false);
    });
    it('降級 execCommand 回傳 false 時不得誤報成功', async () => {
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
      const removeChild = vi.fn();
      vi.stubGlobal('document', {
        createElement: () => ({ value: '', style: {}, select: vi.fn() }),
        body: { appendChild: vi.fn(), removeChild },
        execCommand: vi.fn().mockReturnValue(false),
      });
      const result = await copyToClipboard('x');
      expect(removeChild).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
