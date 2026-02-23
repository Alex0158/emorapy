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

  it('stop 後不應繼續輪詢', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    const { start, stop } = createPolling(fetchFn, { interval: 10, maxAttempts: 10 });
    const p = start();
    stop();
    const result = await p;
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(null);
  });

  it('無 onSuccess 時應在首次成功後安排下次輪詢', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: 1 });
    const { start, stop } = createPolling(fetchFn, { interval: 100, maxAttempts: 3 });
    void start();
    await vi.advanceTimersByTimeAsync(50);
    expect(fetchFn).toHaveBeenCalled();
    stop();
  });
});
