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

    it('callback 變化後應調用最新的 callback', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const { result, rerender } = renderHook(
        ({ cb }) => useDebounce(cb, 300),
        { initialProps: { cb: fn1 } }
      );
      act(() => { result.current(); });
      rerender({ cb: fn2 });
      act(() => { vi.advanceTimersByTime(300); });
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('debounced 函數在 callback 變化時引用應保持穩定', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const { result, rerender } = renderHook(
        ({ cb }) => useDebounce(cb, 300),
        { initialProps: { cb: fn1 } }
      );
      const prevRef = result.current;
      rerender({ cb: fn2 });
      expect(result.current).toBe(prevRef);
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
      expect(result.current.visibleItems).toEqual([0, 1, 2, 3, 4]);
      expect(result.current.offsetY).toBe(0);

      act(() => {
        result.current.handleScroll({
          currentTarget: { scrollTop: 300 },
        } as unknown as React.UIEvent<HTMLDivElement>);
      });

      expect(result.current.visibleItems).toEqual([6, 7, 8, 9, 10]);
      expect(result.current.offsetY).toBe(300);
    });
  });
});
