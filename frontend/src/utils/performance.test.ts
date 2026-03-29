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

    it('傳入 label 且在 DEV 時應呼叫 logger.debug 記錄耗時', () => {
      const fn = vi.fn().mockReturnValue(0);
      const wrapped = measurePerformance(fn, 'myLabel');
      wrapped();
      expect(mockLoggerDebug).toHaveBeenCalledWith(expect.stringMatching(/\[Performance\] myLabel:/));
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

    it('load 觸發時應記錄頁面加載耗時', () => {
      const navEntry = { loadEventEnd: 2000, fetchStart: 100 };
      const getEntriesByType = vi.fn().mockReturnValue([navEntry]);
      let loadCallback: () => void = () => {};
      const addEventListener = vi.fn((_ev: string, cb: () => void) => {
        loadCallback = cb;
      });
      Object.defineProperty(window, 'addEventListener', { value: addEventListener, writable: true });
      Object.defineProperty(window, 'performance', { value: { getEntriesByType }, writable: true });
      logPageLoadTime();
      loadCallback();
      expect(getEntriesByType).toHaveBeenCalledWith('navigation');
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringMatching(/\[Performance\] Page Load Time: 1900\.00ms/)
      );
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
    it('duration > 1000 的資源應呼叫 logger.warn', () => {
      const getEntriesByType = vi.fn().mockReturnValue([
        { name: 'https://example.com/slow.js', duration: 1500 },
      ]);
      Object.defineProperty(window, 'performance', {
        value: { getEntriesByType },
        writable: true,
      });
      logResourceTiming();
      expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringMatching(/Slow Resource.*1500\.00ms/));
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

    it('FCP observer 收到 first-contentful-paint 時應記錄 vitals.fcp', () => {
      const callbacks: Array<(list: { getEntries: () => PerformanceEntry[] }) => void> = [];
      vi.stubGlobal(
        'PerformanceObserver',
        vi.fn().mockImplementation((callback: (list: { getEntries: () => PerformanceEntry[] }) => void) => {
          callbacks.push(callback);
          return { observe: vi.fn(), disconnect: vi.fn() };
        })
      );
      const { vitals, disconnect } = getWebVitals();
      expect(vitals.fcp).toBeUndefined();
      callbacks[0]?.({ getEntries: () => [{ name: 'first-contentful-paint', startTime: 123.4 }] as PerformanceEntry[] });
      expect(vitals.fcp).toBe(123);
      disconnect();
      vi.unstubAllGlobals();
    });

    it('LCP observer 收到 largest-contentful-paint 時應記錄 vitals.lcp', () => {
      let lcpCallback: ((list: { getEntries: () => PerformanceEntry[] }) => void) | null = null;
      const observers: Array<{ observe: (opts: { entryTypes: string[] }) => void }> = [];
      vi.stubGlobal(
        'PerformanceObserver',
        vi.fn().mockImplementation((callback: (list: { getEntries: () => PerformanceEntry[] }) => void) => {
          const obs = {
            observe: vi.fn((opts: { entryTypes: string[] }) => {
              if (opts.entryTypes.includes('largest-contentful-paint')) {
                lcpCallback = callback;
              }
            }),
            disconnect: vi.fn(),
          };
          observers.push(obs);
          return obs;
        })
      );
      const { vitals, disconnect } = getWebVitals();
      expect(vitals.lcp).toBeUndefined();
      lcpCallback?.({ getEntries: () => [{ renderTime: 456.7, loadTime: 400 }] as PerformanceEntry[] });
      expect(vitals.lcp).toBe(457);
      disconnect();
      vi.unstubAllGlobals();
    });

    it('LCP 無 renderTime 時應回退為 loadTime', () => {
      let lcpCallback: ((list: { getEntries: () => PerformanceEntry[] }) => void) | null = null;
      vi.stubGlobal(
        'PerformanceObserver',
        vi.fn().mockImplementation((callback: (list: { getEntries: () => PerformanceEntry[] }) => void) => {
          const obs = {
            observe: vi.fn((opts: { entryTypes: string[] }) => {
              if (opts.entryTypes.includes('largest-contentful-paint')) lcpCallback = callback;
            }),
            disconnect: vi.fn(),
          };
          return obs;
        })
      );
      const { vitals, disconnect } = getWebVitals();
      lcpCallback?.({ getEntries: () => [{ loadTime: 300 }] as PerformanceEntry[] });
      expect(vitals.lcp).toBe(300);
      disconnect();
      vi.unstubAllGlobals();
    });

    it('observe 拋錯時應靜默忽略', () => {
      vi.stubGlobal(
        'PerformanceObserver',
        vi.fn().mockImplementation(() => ({
          observe: () => {
            throw new Error('not supported');
          },
          disconnect: vi.fn(),
        }))
      );
      const { vitals, disconnect } = getWebVitals();
      expect(vitals).toEqual({});
      disconnect();
      vi.unstubAllGlobals();
    });
  });
});
