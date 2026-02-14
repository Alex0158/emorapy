/**
 * useAsync Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsync } from './useAsync';

describe('useAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初始狀態應為 idle，value 與 error 為 null', () => {
    const fn = vi.fn().mockResolvedValue(1);
    const { result } = renderHook(() => useAsync(fn));
    expect(result.current.status).toBe('idle');
    expect(result.current.value).toBeNull();
    expect(result.current.error).toBeNull();
    expect(typeof result.current.execute).toBe('function');
  });

  it('immediate: false 時不應自動執行', () => {
    const fn = vi.fn().mockResolvedValue(1);
    renderHook(() => useAsync(fn, { immediate: false }));
    expect(fn).not.toHaveBeenCalled();
  });

  it('execute() 成功時應更新 status 與 value', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const { result } = renderHook(() => useAsync(fn));
    let resolved: number | undefined;
    await act(async () => {
      resolved = await result.current.execute();
    });
    expect(resolved).toBe(42);
    expect(result.current.status).toBe('success');
    expect(result.current.value).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('execute() 失敗時應更新 status 與 error 並拋出', async () => {
    const err = new Error('fail');
    const fn = vi.fn().mockRejectedValue(err);
    const { result } = renderHook(() => useAsync(fn));
    let thrown: unknown;
    await act(async () => {
      try {
        await result.current.execute();
      } catch (e) {
        thrown = e;
      }
    });
    expect(thrown).toEqual(err);
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.value).toBeNull();
    expect(result.current.error).toEqual(err);
  });

  it('immediate: true 時應在 mount 後執行', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useAsync(fn, { immediate: true }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fn).toHaveBeenCalled();
    expect(result.current.status).toBe('success');
    expect(result.current.value).toBe('ok');
  });

  it('執行前應清空 value 與 error，status 為 pending', async () => {
    const fn = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(1), 50))
    );
    const { result } = renderHook(() => useAsync(fn));
    act(() => {
      result.current.execute();
    });
    expect(result.current.status).toBe('pending');
    expect(result.current.value).toBeNull();
    expect(result.current.error).toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
  });
});
