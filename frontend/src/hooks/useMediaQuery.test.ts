/**
 * useMediaQuery Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from './useMediaQuery';

describe('useMediaQuery', () => {
  const mockMatchMedia = vi.fn();
  let listeners: Array<(e: { matches: boolean }) => void> = [];

  beforeEach(() => {
    listeners = [];
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query.includes('max-width') ? true : false,
      addEventListener: (_: string, handler: (e: { matches: boolean }) => void) => {
        listeners.push(handler);
      },
      removeEventListener: (_: string, handler: (e: { matches: boolean }) => void) => {
        listeners = listeners.filter((l) => l !== handler);
      },
      addListener: function (handler: (e: { matches: boolean }) => void) {
        listeners.push(handler);
      },
      removeListener: function (handler: (e: { matches: boolean }) => void) {
        listeners = listeners.filter((l) => l !== handler);
      },
    }));
    Object.defineProperty(window, 'matchMedia', {
      value: mockMatchMedia,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('應調用 matchMedia 並返回初始 matches', () => {
    mockMatchMedia.mockReturnValueOnce({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 768px)');
    expect(result.current).toBe(true);
  });

  it('matches 為 false 時應返回 false', () => {
    mockMatchMedia.mockReturnValueOnce({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
  });
});

describe('useIsMobile', () => {
  it('應調用 useMediaQuery 並傳入 max-width 查詢', () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, writable: true });
    const { result } = renderHook(() => useIsMobile());
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    expect(result.current).toBe(true);
  });
});

describe('useIsTablet', () => {
  it('應調用 useMediaQuery 並傳入區間查詢', () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, writable: true });
    renderHook(() => useIsTablet());
    expect(mockMatchMedia).toHaveBeenCalledWith(
      '(min-width: 768px) and (max-width: 1023px)'
    );
  });
});

describe('useIsDesktop', () => {
  it('應調用 useMediaQuery 並傳入 min-width 查詢', () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', { value: mockMatchMedia, writable: true });
    renderHook(() => useIsDesktop());
    expect(mockMatchMedia).toHaveBeenCalledWith('(min-width: 1440px)');
  });
});
