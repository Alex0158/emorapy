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

  it('未提供 condition 時應使用預設 data!==null', async () => {
    const fn = vi.fn().mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() =>
      usePolling(fn, 1000)
    );
    act(() => {
      result.current.startPolling();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isPolling).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
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

  it('達到最大次數時應停止並記錄 warn', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      usePolling(fn, 1000, () => false, { maxAttempts: 1 })
    );
    act(() => {
      result.current.startPolling();
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
      await vi.runOnlyPendingTimersAsync();
    });
    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(result.current.isPolling).toBe(false);
  });

  it('maxDuration=0 時應立即停止並記錄 warn', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      usePolling(fn, 1000, () => false, { maxAttempts: 10, maxDuration: 0 })
    );
    act(() => {
      result.current.startPolling();
    });
    await act(async () => Promise.resolve());
    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it('輪詢函數拋錯時應記錄 error 並可繼續重試', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() =>
      usePolling(fn, 1000, (data) => Boolean(data), {
        maxAttempts: 5,
        exponentialBackoff: true,
        initialInterval: 100,
        maxInterval: 500,
      })
    );
    act(() => {
      result.current.startPolling();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(mockLoggerError).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.current.isPolling).toBe(false);
  });

  it('錯誤且已達最大次數時應停止輪詢', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));
    const { result } = renderHook(() =>
      usePolling(fn, 1000, () => false, { maxAttempts: 1, exponentialBackoff: true })
    );
    act(() => {
      result.current.startPolling();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(mockLoggerError).toHaveBeenCalled();
    expect(result.current.isPolling).toBe(false);
  });

  it('重複調用 startPolling 不應重入', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() =>
      usePolling(fn, 1000, () => false, { maxAttempts: 1 })
    );
    act(() => {
      result.current.startPolling();
      result.current.startPolling();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stop 後若排程回調被觸發應直接返回（不再輪詢）', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    let scheduledPoll: (() => void) | undefined;
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: TimerHandler) => {
      if (typeof cb === 'function') {
        scheduledPoll = cb as () => void;
      }
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    const { result } = renderHook(() =>
      usePolling(fn, 1000, () => false, { maxAttempts: 5 })
    );
    act(() => {
      result.current.startPolling();
    });
    await act(async () => Promise.resolve());
    act(() => {
      result.current.stopPolling();
    });
    act(() => {
      scheduledPoll?.();
    });

    expect(result.current.isPolling).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });
});
