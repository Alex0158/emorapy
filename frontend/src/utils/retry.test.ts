/**
 * 重試工具單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestWithRetry } from './retry';

const mockLoggerWarn = vi.fn();
vi.mock('./logger', () => ({
  logger: { warn: (...args: unknown[]) => mockLoggerWarn(...args) },
}));

describe('retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('首次成功應直接返回', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await requestWithRetry(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('失敗後重試成功應返回', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(1);
    const p = requestWithRetry(fn, { maxRetries: 3, initialDelay: 100 });
    await vi.advanceTimersByTimeAsync(150);
    const result = await p;
    expect(result).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('shouldRetry 返回 false 應立即拋出', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('bad'));
    const p = requestWithRetry(fn, {
      maxRetries: 3,
      shouldRetry: () => false,
    });
    await expect(p).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('耗盡 maxRetries 應拋出最後錯誤', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('net'));
    const p = requestWithRetry(fn, { maxRetries: 2, initialDelay: 10 });
    const rejectPromise = expect(p).rejects.toThrow('net');
    await vi.advanceTimersByTimeAsync(50);
    await rejectPromise;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('自定義 shouldRetry 僅對符合條件的錯誤重試', async () => {
    const fn = vi.fn().mockRejectedValue({ code: 'NETWORK_ERROR' });
    const p = requestWithRetry(fn, {
      maxRetries: 2,
      initialDelay: 10,
      shouldRetry: (e: unknown) => (e as { code?: string }).code === 'NETWORK_ERROR',
    });
    const rejectPromise = expect(p).rejects.toBeDefined();
    await vi.runAllTimersAsync();
    await rejectPromise;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('signal 被 abort 時應中斷重試', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('net'));
    const p = requestWithRetry(fn, {
      maxRetries: 5,
      initialDelay: 1000,
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    await expect(p).rejects.toThrow();
    expect(fn.mock.calls.length).toBeLessThan(5);
  });
});
