/**
 * 性能監控工具單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { measurePerformance, logPageLoadTime, logResourceTiming, getWebVitals } from './performance';

const mockLoggerDebug = vi.fn();
const mockLoggerWarn = vi.fn();
vi.mock('./logger', () => ({
  logger: {
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

describe('performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('measurePerformance', () => {
    it('應返回與原函數相同的結果', () => {
      const fn = vi.fn().mockReturnValue(42);
      const wrapped = measurePerformance(fn, 'test');
      expect(wrapped()).toBe(42);
      expect(fn).toHaveBeenCalled();
    });

    it('應傳遞參數給原函數', () => {
      const fn = vi.fn().mockReturnValue(0);
      const wrapped = measurePerformance(fn);
      wrapped(1, 2, 3);
      expect(fn).toHaveBeenCalledWith(1, 2, 3);
    });
  });

  describe('logPageLoadTime', () => {
    it('應註冊 load 事件監聽', () => {
      const addEventListener = vi.fn();
      Object.defineProperty(window, 'addEventListener', { value: addEventListener, writable: true });
      Object.defineProperty(window, 'performance', {
        value: { getEntriesByType: vi.fn().mockReturnValue([]) },
        writable: true,
      });
      logPageLoadTime();
      expect(addEventListener).toHaveBeenCalledWith('load', expect.any(Function), { once: true });
    });
  });

  describe('logResourceTiming', () => {
    it('window.performance 存在時應調用 getEntriesByType', () => {
      const getEntriesByType = vi.fn().mockReturnValue([]);
      Object.defineProperty(window, 'performance', {
        value: { getEntriesByType },
        writable: true,
      });
      logResourceTiming();
      expect(getEntriesByType).toHaveBeenCalledWith('resource');
    });
  });

  describe('getWebVitals', () => {
    it('應返回 vitals 物件和 disconnect 函數', () => {
      const { vitals, disconnect } = getWebVitals();
      expect(vitals).toBeDefined();
      expect(typeof vitals).toBe('object');
      expect(vitals).toEqual({});
      expect(typeof disconnect).toBe('function');
      disconnect();
    });
  });
});
