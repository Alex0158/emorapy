/**
 * useAdminTokenEditor Hook 單元測試
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setAdminToken } from '@/services/api/admin';
import { useAdminTokenEditor } from './useAdminTokenEditor';

describe('useAdminTokenEditor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('應以已保存 token 初始化輸入框', async () => {
    act(() => {
      setAdminToken('a.b.c');
    });

    const { result } = renderHook(() => useAdminTokenEditor());
    await waitFor(() => {
      expect(result.current.savedToken).toBe('a.b.c');
    });
    expect(result.current.tokenInput).toBe('a.b.c');
  });

  it('輸入空 token 保存時應返回 required', () => {
    const { result } = renderHook(() => useAdminTokenEditor());
    act(() => {
      result.current.setTokenInput('   ');
    });
    let saveResult: ReturnType<typeof result.current.saveToken> = 'saved';
    act(() => {
      saveResult = result.current.saveToken();
    });
    expect(saveResult).toBe('required');
    expect(result.current.savedToken).toBe('');
  });

  it('輸入無效 token 保存時應返回 invalid', () => {
    const { result } = renderHook(() => useAdminTokenEditor());
    act(() => {
      result.current.setTokenInput('invalid-token');
    });
    let saveResult: ReturnType<typeof result.current.saveToken> = 'saved';
    act(() => {
      saveResult = result.current.saveToken();
    });
    expect(saveResult).toBe('invalid');
    expect(result.current.savedToken).toBe('');
  });

  it('輸入有效 token 保存時應 trim 後寫入 storage', async () => {
    const { result } = renderHook(() => useAdminTokenEditor());
    act(() => {
      result.current.setTokenInput('  a.b.c  ');
    });
    let saveResult: ReturnType<typeof result.current.saveToken> = 'required';
    act(() => {
      saveResult = result.current.saveToken();
    });

    expect(saveResult).toBe('saved');
    await waitFor(() => {
      expect(result.current.savedToken).toBe('a.b.c');
    });
    expect(result.current.tokenInput).toBe('a.b.c');
  });

  it('clearToken 應清除 saved token 與 input', async () => {
    const { result } = renderHook(() => useAdminTokenEditor());
    act(() => {
      result.current.setTokenInput('a.b.c');
    });
    act(() => {
      result.current.saveToken();
    });
    await waitFor(() => {
      expect(result.current.savedToken).toBe('a.b.c');
    });

    let clearResult: ReturnType<typeof result.current.clearToken> = 'storage_failed';
    act(() => {
      clearResult = result.current.clearToken();
    });
    expect(clearResult).toBe('cleared');
    await waitFor(() => {
      expect(result.current.savedToken).toBe('');
    });
    expect(result.current.tokenInput).toBe('');
  });

  it('storage 寫入失敗時 saveToken 應返回 storage_failed', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    const { result } = renderHook(() => useAdminTokenEditor());
    act(() => {
      result.current.setTokenInput('a.b.c');
    });

    let saveResult: ReturnType<typeof result.current.saveToken> = 'saved';
    act(() => {
      saveResult = result.current.saveToken();
    });

    expect(saveResult).toBe('storage_failed');
    expect(result.current.savedToken).toBe('');
    setItemSpy.mockRestore();
  });

  it('storage 清除失敗時 clearToken 應返回 storage_failed', async () => {
    act(() => {
      setAdminToken('a.b.c');
    });
    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    const { result } = renderHook(() => useAdminTokenEditor());
    await waitFor(() => {
      expect(result.current.savedToken).toBe('a.b.c');
    });

    let clearResult: ReturnType<typeof result.current.clearToken> = 'cleared';
    act(() => {
      clearResult = result.current.clearToken();
    });

    expect(clearResult).toBe('storage_failed');
    removeItemSpy.mockRestore();
  });
});
