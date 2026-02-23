/**
 * 性能監控工具
 */

import { logger } from './logger';

/**
 * 測量函數執行時間
 */
export const measurePerformance = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  label?: string
): T => {
  return ((...args: Parameters<T>) => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    const duration = end - start;

    if (label && import.meta.env.DEV) {
      logger.debug(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }

    return result;
  }) as T;
};

/**
 * 記錄頁面加載時間
 */
export const logPageLoadTime = (): void => {
  if (typeof window !== 'undefined' && window.performance) {
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation && import.meta.env.DEV) {
        const loadTime = navigation.loadEventEnd - navigation.fetchStart;
        logger.debug(`[Performance] Page Load Time: ${loadTime.toFixed(2)}ms`);
      }
    }, { once: true });
  }
};

/**
 * 記錄資源加載時間
 */
export const logResourceTiming = (): void => {
  if (typeof window !== 'undefined' && window.performance) {
    const resources = performance.getEntriesByType('resource');
    resources.forEach((resource) => {
      const duration = resource.duration;
      if (duration > 1000 && import.meta.env.DEV) {
        logger.warn(`[Performance] Slow Resource: ${resource.name} (${duration.toFixed(2)}ms)`);
      }
    });
  }
};

/**
 * 獲取Web Vitals指標
 */
export const getWebVitals = (): {
  vitals: { fcp?: number; lcp?: number; fid?: number; cls?: number };
  disconnect: () => void;
} => {
  const vitals: {
    fcp?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
  } = {};

  const observers: PerformanceObserver[] = [];

  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            vitals.fcp = Math.round(entry.startTime);
          }
        });
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
      observers.push(fcpObserver);
    } catch {
      // PerformanceObserver not supported for this entry type
    }

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        type LCPEntry = { renderTime?: number; loadTime?: number };
        vitals.lcp = Math.round((lastEntry as LCPEntry).renderTime ?? (lastEntry as LCPEntry).loadTime ?? 0);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      observers.push(lcpObserver);
    } catch {
      // PerformanceObserver not supported for this entry type
    }
  }

  return {
    vitals,
    disconnect: () => observers.forEach(o => o.disconnect()),
  };
};

