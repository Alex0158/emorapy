/**
 * usePerformance Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useThrottle, useVirtualList } from './usePerformance';

describe('usePerformance', () => {
  describe('useDebounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('應延遲執行 callback', () => {
      const fn = vi.fn();
      const { result } = renderHook(() => useDebounce(fn, 300));
      act(() => {
        result.current();
      });
      expect(fn).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('多次快速調用應只執行最後一次', () => {
      const fn = vi.fn();
      const { result } = renderHook(() => useDebounce(fn, 300));
      act(() => {
        result.current();
        result.current();
        result.current();
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('useThrottle', () => {
    it('應節流 callback', () => {
      const fn = vi.fn();
      const { result } = renderHook(() => useThrottle(fn, 100));
      act(() => {
        result.current();
        result.current();
        result.current();
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('delay 過後應可再次執行', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const { result } = renderHook(() => useThrottle(fn, 100));
      act(() => {
        result.current();
      });
      expect(fn).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current();
      });
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe('useVirtualList', () => {
    it('應返回 visibleItems、offsetY、totalHeight、handleScroll', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const { result } = renderHook(() =>
        useVirtualList(items, 50, 200)
      );
      expect(result.current.visibleItems).toBeDefined();
      expect(Array.isArray(result.current.visibleItems)).toBe(true);
      expect(result.current.offsetY).toBe(0);
      expect(result.current.totalHeight).toBe(500);
      expect(typeof result.current.handleScroll).toBe('function');
      expect(result.current.containerRef).toBeDefined();
    });

    it('scrollTop 變化時 visibleItems 應更新', () => {
      const items = Array.from({ length: 20 }, (_, i) => i);
      const { result } = renderHook(() =>
        useVirtualList(items, 50, 200)
      );
      expect(result.current.visibleItems.length).toBeGreaterThan(0);
      expect(result.current.visibleItems.length).toBeLessThanOrEqual(items.length);
    });
  });
});
