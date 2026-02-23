/**
 * sessionStore 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionStore } from './sessionStore';

const mockCreateSession = vi.fn();
const mockRefreshSession = vi.fn();
const mockGetErrorMessage = vi.fn((_e: unknown, fallback: string) => fallback);

vi.mock('@/services/api/session', () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
}));
vi.mock('@/utils/apiError', () => ({
  getErrorMessage: (...args: unknown[]) => mockGetErrorMessage(...args),
}));

const mockSessionStorageGet = vi.fn();
const mockSessionStorageSet = vi.fn();
const mockSessionStorageRemove = vi.fn();
vi.mock('@/utils/storage', () => ({
  sessionStorage: {
    get: () => mockSessionStorageGet(),
    set: (id: string) => mockSessionStorageSet(id),
    remove: () => mockSessionStorageRemove(),
  },
}));

const mockSession = {
  session_id: 's1',
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
};

describe('sessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({ session: null, error: null, isLoading: false });
    mockSessionStorageGet.mockReturnValue(null);
  });

  it('setSession 應更新 session', () => {
    useSessionStore.getState().setSession(mockSession);
    expect(useSessionStore.getState().session).toEqual(mockSession);
    expect(mockSessionStorageSet).toHaveBeenCalledWith('s1');
  });

  it('setSession null 應清除 session 並 remove storage', () => {
    useSessionStore.setState({ session: mockSession });
    useSessionStore.getState().setSession(null);
    expect(useSessionStore.getState().session).toBeNull();
    expect(mockSessionStorageRemove).toHaveBeenCalled();
  });

  it('clearSession 應清除 session 與 error', () => {
    useSessionStore.setState({ session: mockSession, error: 'err' });
    useSessionStore.getState().clearSession();
    expect(useSessionStore.getState().session).toBeNull();
    expect(useSessionStore.getState().error).toBeNull();
    expect(mockSessionStorageRemove).toHaveBeenCalled();
  });

  it('createSession 成功應設 session', async () => {
    mockCreateSession.mockResolvedValue(mockSession);
    const result = await useSessionStore.getState().createSession();
    expect(result).toEqual(mockSession);
    expect(useSessionStore.getState().session).toEqual(mockSession);
    expect(useSessionStore.getState().isLoading).toBe(false);
    expect(mockSessionStorageSet).toHaveBeenCalledWith('s1');
  });

  it('createSession 失敗應設 error 並返回 null', async () => {
    mockCreateSession.mockRejectedValue(new Error('創建Session失敗'));
    const result = await useSessionStore.getState().createSession();
    expect(result).toBeNull();
    expect(useSessionStore.getState().error).toBe('message.createSessionFail');
    expect(useSessionStore.getState().isLoading).toBe(false);
  });

  it('createSession 拋出非 Error 時應使用默認錯誤訊息', async () => {
    mockCreateSession.mockRejectedValue('boom');
    const result = await useSessionStore.getState().createSession();
    expect(result).toBeNull();
    expect(useSessionStore.getState().error).toBe('message.createSessionFail');
  });

  it('createSession 在有效舊 session 存在時應直接返回舊值', async () => {
    useSessionStore.setState({
      session: {
        session_id: 's-old',
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      },
    });
    mockSessionStorageGet.mockReturnValue('s-old');
    const result = await useSessionStore.getState().createSession();
    expect(result).toEqual(useSessionStore.getState().session);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('refreshSession 成功應設 session', async () => {
    mockRefreshSession.mockResolvedValue(mockSession);
    const result = await useSessionStore.getState().refreshSession();
    expect(result).toEqual(mockSession);
    expect(useSessionStore.getState().session).toEqual(mockSession);
  });

  it('refreshSession 有效且非 force 時應直接返回現有 session', async () => {
    const existing = {
      session_id: 's-existing',
      expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    };
    useSessionStore.setState({ session: existing });
    mockSessionStorageGet.mockReturnValue('s-existing');
    const result = await useSessionStore.getState().refreshSession();
    expect(result).toEqual(existing);
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('refreshSession force=true 應忽略快取並調用 API', async () => {
    const existing = {
      session_id: 's-existing',
      expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    };
    useSessionStore.setState({ session: existing });
    mockSessionStorageGet.mockReturnValue('s-existing');
    mockRefreshSession.mockResolvedValue(mockSession);
    const result = await useSessionStore.getState().refreshSession(true);
    expect(result).toEqual(mockSession);
    expect(mockRefreshSession).toHaveBeenCalled();
  });

  it('refreshSession 失敗應設 error 並返回 null', async () => {
    mockRefreshSession.mockRejectedValue(new Error('refresh failed'));
    mockGetErrorMessage.mockReturnValueOnce('message.refreshSessionFail');
    const result = await useSessionStore.getState().refreshSession();
    expect(result).toBeNull();
    expect(useSessionStore.getState().error).toBe('message.refreshSessionFail');
  });

  it('checkSessionExpiry 無 session 應返回 false', () => {
    useSessionStore.setState({ session: null });
    expect(useSessionStore.getState().checkSessionExpiry()).toBe(false);
  });

  it('checkSessionExpiry 無 expires_at 應返回 false', () => {
    useSessionStore.setState({
      session: {
        session_id: 'x',
        expires_at: '' as unknown as string,
      },
    });
    expect(useSessionStore.getState().checkSessionExpiry()).toBe(false);
  });

  it('checkSessionExpiry 未過期應返回 false', () => {
    useSessionStore.setState({
      session: {
        ...mockSession,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    });
    expect(useSessionStore.getState().checkSessionExpiry()).toBe(false);
  });

  it('checkSessionExpiry 已過期應返回 true', () => {
    useSessionStore.setState({
      session: {
        ...mockSession,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
    });
    expect(useSessionStore.getState().checkSessionExpiry()).toBe(true);
  });
});
