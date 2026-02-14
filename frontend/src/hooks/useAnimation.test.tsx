/**
 * useAnimation Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useFadeIn,
  useSlideIn,
  useIntersectionAnimation,
  useHoverAnimation,
} from './useAnimation';

describe('useAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useFadeIn', () => {
    it('初始 isVisible 應為 false', () => {
      const { result } = renderHook(() => useFadeIn(300, 0));
      expect(result.current.isVisible).toBe(false);
    });

    it('delay 後 isVisible 應變為 true', () => {
      const { result } = renderHook(() => useFadeIn(300, 100));
      expect(result.current.isVisible).toBe(false);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current.isVisible).toBe(true);
      expect(result.current.ref).toHaveProperty('current');
    });
  });

  describe('useSlideIn', () => {
    it('初始 isVisible 應為 false，delay 後變為 true', () => {
      const { result } = renderHook(() => useSlideIn('up', 300, 50));
      expect(result.current.isVisible).toBe(false);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(result.current.isVisible).toBe(true);
    });

    it('應支持 direction 參數', () => {
      const { result } = renderHook(() => useSlideIn('right', 300, 0));
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(result.current.ref).toHaveProperty('current');
    });
  });

  describe('useIntersectionAnimation', () => {
    it('應返回 ref 與 isVisible', () => {
      const { result } = renderHook(() => useIntersectionAnimation({ threshold: 0.1 }));
      expect(result.current.ref).toHaveProperty('current');
      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('useHoverAnimation', () => {
    it('應返回 ref 與 isHovered，初始 isHovered 為 false', () => {
      const { result } = renderHook(() => useHoverAnimation());
      expect(result.current.ref).toHaveProperty('current');
      expect(result.current.isHovered).toBe(false);
    });
  });
});
