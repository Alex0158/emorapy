/**
 * useApi Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useApi } from './useApi';

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/utils/apiError', () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Unknown'),
  isNetworkError: () => false,
  isAuthError: () => false,
}));

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初始 loading、error、data 應為 false、null、null', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useApi(fn));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
    expect(typeof result.current.execute).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('execute 成功應更新 data 並返回結果', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const { result } = renderHook(() => useApi(fn));
    let resolved: number | undefined;
    await act(async () => {
      resolved = await result.current.execute();
    });
    expect(resolved).toBe(42);
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('execute 失敗應更新 error 並拋出', async () => {
    const err = new Error('fail');
    const fn = vi.fn().mockRejectedValue(err);
    const { result } = renderHook(() => useApi(fn));
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
      expect(result.current.error?.message).toBe('fail');
    });
    expect(result.current.data).toBeNull();
  });

  it('showSuccess 與 successMessage 時成功應調用 toast.success', async () => {
    const fn = vi.fn().mockResolvedValue(1);
    const { result } = renderHook(() =>
      useApi(fn, { showSuccess: true, successMessage: '成功' })
    );
    await act(async () => {
      await result.current.execute();
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('成功');
  });

  it('reset 應清空 data', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const { result } = renderHook(() => useApi(fn));
    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe(42);
    act(() => {
      result.current.reset();
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('reset 應清空 error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useApi(fn, { showError: false }));
    await act(async () => {
      try { await result.current.execute(); } catch { /* expected */ }
    });
    expect(result.current.error).toBeTruthy();
    act(() => {
      result.current.reset();
    });
    expect(result.current.error).toBeNull();
  });
});
