/**
 * useWindowSize Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWindowSize } from './useWindowSize';

describe('useWindowSize', () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true, configurable: true });
    window.addEventListener = addEventListener;
    window.removeEventListener = removeEventListener;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初始應返回當前 window.innerWidth 與 innerHeight', () => {
    const { result } = renderHook(() => useWindowSize());
    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
  });

  it('應監聽 resize 事件', () => {
    renderHook(() => useWindowSize());
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('resize 後應更新 width 與 height', () => {
    let resizeHandler: (() => void) | null = null;
    addEventListener.mockImplementation((event: string, handler: () => void) => {
      if (event === 'resize') resizeHandler = handler;
    });
    const { result } = renderHook(() => useWindowSize());
    expect(result.current.width).toBe(1024);
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true, configurable: true });
    act(() => {
      resizeHandler?.();
    });
    expect(result.current.width).toBe(800);
    expect(result.current.height).toBe(600);
  });
});
