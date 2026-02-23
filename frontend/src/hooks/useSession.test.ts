/**
 * useSession Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSession } from './useSession';

const mockCreateSession = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRemove = vi.fn();
const mockMessageError = vi.fn();
vi.mock('@/services/api/session', () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
}));
vi.mock('@/utils/storage', () => ({
  sessionStorage: {
    get: () => mockGet(),
    set: (id: string) => mockSet(id),
    remove: () => mockRemove(),
  },
}));
vi.mock('antd', () => ({
  message: { error: (...args: unknown[]) => mockMessageError(...args) },
}));
vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初始無 stored session 時 sessionId 應為 null', () => {
    mockGet.mockReturnValue(null);
    const { result } = renderHook(() => useSession());
    expect(result.current.sessionId).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('有 stored session 時應設為 sessionId', () => {
    mockGet.mockReturnValue('s1');
    const { result } = renderHook(() => useSession());
    expect(result.current.sessionId).toBe('s1');
  });

  it('createSession 成功後應更新 sessionId', async () => {
    mockGet.mockReturnValue(null);
    mockCreateSession.mockResolvedValue({ session_id: 's2' });
    const { result } = renderHook(() => useSession());
    let id: string | undefined;
    await act(async () => {
      id = await result.current.createSession();
    });
    expect(id).toBe('s2');
    expect(result.current.sessionId).toBe('s2');
    expect(mockSet).toHaveBeenCalledWith('s2');
  });

  it('createSession 失敗時應提示錯誤並拋出', async () => {
    mockGet.mockReturnValue(null);
    mockCreateSession.mockRejectedValueOnce(new Error('api-failed'));
    const { result } = renderHook(() => useSession());
    await expect(
      act(async () => {
        await result.current.createSession();
      })
    ).rejects.toThrow('api-failed');
    expect(mockMessageError).toHaveBeenCalledWith('message.sessionCreateFail');
    expect(result.current.loading).toBe(false);
  });

  it('getOrCreateSession 有 sessionId 時應直接返回', async () => {
    mockGet.mockReturnValue('s1');
    const { result } = renderHook(() => useSession());
    let id: string | undefined;
    await act(async () => {
      id = await result.current.getOrCreateSession();
    });
    expect(id).toBe('s1');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('getOrCreateSession 無 sessionId 時應調用 createSession', async () => {
    mockGet.mockReturnValue(null);
    mockCreateSession.mockResolvedValue({ session_id: 's3' });
    const { result } = renderHook(() => useSession());
    await act(async () => {
      await result.current.getOrCreateSession();
    });
    expect(mockCreateSession).toHaveBeenCalled();
    expect(result.current.sessionId).toBe('s3');
  });

  it('clearSession 應清除 sessionId 並調用 remove', () => {
    mockGet.mockReturnValue('s1');
    const { result } = renderHook(() => useSession());
    expect(result.current.sessionId).toBe('s1');
    act(() => {
      result.current.clearSession();
    });
    expect(result.current.sessionId).toBeNull();
    expect(mockRemove).toHaveBeenCalled();
  });
});
