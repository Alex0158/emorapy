/**
 * 輪詢工具單元測試
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPolling } from './polling';

describe('polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('onSuccess 返回 true 時應立即返回數據並停止', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ id: 1 });
    const { start, stop } = createPolling(fetchFn, {
      interval: 1000,
      maxAttempts: 5,
      onSuccess: (data) => (data as { id: number }).id === 1,
    });
    const p = start();
    const result = await p;
    expect(result).toEqual({ id: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    stop();
  });

  it('maxAttempts 為 0 時應立即拋 Max polling attempts reached', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    const { start, stop } = createPolling(fetchFn, { maxAttempts: 0 });
    await expect(start()).rejects.toThrow('Max polling attempts reached');
    expect(fetchFn).not.toHaveBeenCalled();
    stop();
  });

  it('stop 後再 start 應立即拋 Polling stopped', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    const { start, stop } = createPolling(fetchFn, { interval: 10, maxAttempts: 5 });
    stop();
    await expect(start()).rejects.toThrow('Polling stopped');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('達到 maxAttempts 應拋錯', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    const { start, stop } = createPolling(fetchFn, {
      interval: 10,
      maxAttempts: 2,
    });
    const p = start();
    const rejectPromise = expect(p).rejects.toThrow('Max polling attempts reached');
    await vi.runAllTimersAsync();
    await rejectPromise;
    expect(fetchFn).toHaveBeenCalledTimes(2);
    stop();
  });

  it('耗盡 maxAttempts 且 onSuccess 不停止時應在 try 內拋錯', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    const { start, stop } = createPolling(fetchFn, {
      interval: 10,
      maxAttempts: 2,
      onSuccess: () => false,
    });
    const p = start();
    const rejection = expect(p).rejects.toThrow('Max polling attempts reached');
    await vi.runAllTimersAsync();
    await rejection;
    expect(fetchFn).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stop 後不應繼續輪詢', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    const { start, stop } = createPolling(fetchFn, { interval: 10, maxAttempts: 10 });
    const p = start();
    stop();
    const result = await p;
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(null);
  });

  it('stop 在 interval 等待期間被調用時應 reject 且不繼續輪詢', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    const { start, stop } = createPolling(fetchFn, { interval: 10000, maxAttempts: 10 });
    const p = start();
    await vi.advanceTimersByTimeAsync(100);
    stop();
    await expect(p).rejects.toThrow('Polling stopped');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('無 onSuccess 時應在首次成功後安排下次輪詢', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: 1 });
    const { start, stop } = createPolling(fetchFn, { interval: 10, maxAttempts: 2 });
    const p = start().catch(() => {});
    await vi.advanceTimersByTimeAsync(20);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    stop();
    await p;
  });

  it('onError 返回 true 時應停止並拋出錯誤', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const { start, stop } = createPolling(fetchFn, {
      interval: 100,
      maxAttempts: 5,
      onError: () => true,
    });
    await expect(start()).rejects.toThrow('fetch failed');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    stop();
  });

  it('onError 返回 false 時失敗後應繼續輪詢直至耗盡次數', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('net error'));
    const { start, stop } = createPolling(fetchFn, {
      interval: 10,
      maxAttempts: 4,
      onError: () => false,
    });
    const p = start().then(() => null, (e: unknown) => e);
    await vi.advanceTimersByTimeAsync(100);
    const err = await p;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('net error');
    expect(fetchFn).toHaveBeenCalledTimes(4);
    stop();
  });

});
