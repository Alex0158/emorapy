/**
 * useResponsive Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponsive } from './useResponsive';

const mockUseMediaQuery = vi.fn();
vi.mock('./useMediaQuery', () => ({
  useMediaQuery: (query: string) => mockUseMediaQuery(query),
}));

describe('useResponsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應調用 useMediaQuery 三次並返回 isMobile、isTablet、isDesktop、isMobileOrTablet', () => {
    mockUseMediaQuery.mockReturnValue(false);
    const { result } = renderHook(() => useResponsive());
    expect(mockUseMediaQuery).toHaveBeenCalledTimes(3);
    expect(result.current).toHaveProperty('isMobile', false);
    expect(result.current).toHaveProperty('isTablet', false);
    expect(result.current).toHaveProperty('isDesktop', false);
    expect(result.current).toHaveProperty('isMobileOrTablet', false);
  });

  it('isMobile 為 true 時 isMobileOrTablet 應為 true', () => {
    mockUseMediaQuery
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isMobileOrTablet).toBe(true);
  });

  it('isTablet 為 true 時 isMobileOrTablet 應為 true', () => {
    mockUseMediaQuery
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobileOrTablet).toBe(true);
  });
});
