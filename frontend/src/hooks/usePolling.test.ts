/**
 * usePolling Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling } from './usePolling';

const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

describe('usePolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始 isPolling 應為 false', () => {
    const fn = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      usePolling(fn, 1000, (data) => data !== null)
    );
    expect(result.current.isPolling).toBe(false);
  });

  it('startPolling 後 isPolling 應為 true', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      usePolling(fn, 1000, (data) => data !== null, { maxAttempts: 2 })
    );
    act(() => {
      result.current.startPolling();
    });
    expect(result.current.isPolling).toBe(true);
  });

  it('fn 返回非 null 時應停止輪詢', async () => {
    const fn = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 });
    const { result } = renderHook(() =>
      usePolling(fn, 1000, (data) => data !== null)
    );
    act(() => {
      result.current.startPolling();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(fn).toHaveBeenCalled();
    expect(result.current.isPolling).toBe(false);
  });

  it('stopPolling 應停止輪詢', () => {
    const fn = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      usePolling(fn, 1000, () => false, { maxAttempts: 5 })
    );
    act(() => {
      result.current.startPolling();
    });
    expect(result.current.isPolling).toBe(true);
    act(() => {
      result.current.stopPolling();
    });
    expect(result.current.isPolling).toBe(false);
  });
});
