/**
 * useLocalStorage Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

const { mockLogger } = vi.hoisted(() => ({ mockLogger: { error: vi.fn() } }));
vi.mock('@/utils/logger', () => ({ logger: mockLogger }));

describe('useLocalStorage', () => {
  const storage: Record<string, string> = {};
  const getItem = vi.fn((key: string) => storage[key] ?? null);
  const setItem = vi.fn((key: string, value: string) => {
    storage[key] = value;
  });
  const removeItem = vi.fn((key: string) => {
    delete storage[key];
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(storage).forEach((k) => delete storage[k]);
    Object.defineProperty(window, 'localStorage', {
      value: { getItem, setItem, removeItem },
      writable: true,
    });
  });

  it('無已存值時應返回 initialValue', () => {
    getItem.mockReturnValue(null);
    const { result } = renderHook(() => useLocalStorage('key1', 'default'));
    expect(result.current[0]).toBe('default');
    expect(getItem).toHaveBeenCalledWith('key1');
  });

  it('有已存值時應解析並返回', () => {
    storage['key2'] = JSON.stringify({ name: 'test' });
    getItem.mockImplementation((k: string) => storage[k] ?? null);
    const { result } = renderHook(() => useLocalStorage('key2', {}));
    expect(result.current[0]).toEqual({ name: 'test' });
  });

  it('setValue 應寫入 localStorage 並更新 state', async () => {
    getItem.mockReturnValue(null);
    const { result } = renderHook(() => useLocalStorage('key3', 0));
    await act(async () => {
      result.current[1](42);
    });
    await waitFor(() => {
      expect(result.current[0]).toBe(42);
    });
    expect(setItem).toHaveBeenCalledWith('key3', '42');
  });

  it('setValue 接受函數 updater', async () => {
    storage['key4'] = '10';
    getItem.mockImplementation((k: string) => storage[k] ?? null);
    const { result } = renderHook(() => useLocalStorage('key4', 0));
    expect(result.current[0]).toBe(10);
    await act(async () => {
      result.current[1]((prev: number) => prev + 5);
    });
    await waitFor(() => {
      expect(result.current[0]).toBe(15);
    });
    expect(setItem).toHaveBeenCalledWith('key4', '15');
  });

  it('讀取時 JSON 解析失敗應返回 initialValue 並記錄錯誤', () => {
    storage['bad'] = 'not json';
    getItem.mockImplementation((k: string) => storage[k] ?? null);
    const { result } = renderHook(() => useLocalStorage('bad', 'fallback'));
    expect(result.current[0]).toBe('fallback');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('寫入時異常應記錄錯誤且不拋出', async () => {
    getItem.mockReturnValue(null);
    setItem.mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    const { result } = renderHook(() => useLocalStorage('key5', 'v'));
    await act(async () => {
      result.current[1]('v2');
    });
    expect(mockLogger.error).toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current[0]).toBe('v2');
    });
  });
});
