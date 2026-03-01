/**
 * authStore 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockClaimSession = vi.fn();
const mockGetProfile = vi.fn();
const mockCancelAllRequests = vi.fn();

vi.mock('@/services/api/auth', () => ({
  login: (...args: unknown[]) => mockLogin(...args),
  register: (...args: unknown[]) => mockRegister(...args),
  claimSession: (...args: unknown[]) => mockClaimSession(...args),
}));
vi.mock('@/services/api/user', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));
vi.mock('@/services/requestCancel', () => ({
  cancelAllRequests: (...args: unknown[]) => mockCancelAllRequests(...args),
}));

let mockSessionStorageValue: string | null = null;
vi.mock('@/utils/storage', () => ({
  sessionStorage: {
    get: () => mockSessionStorageValue,
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

const mockUser = { id: 'u1', email: 'u@example.com', nickname: 'User' };

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorageValue = null;
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    localStorage.clear();
    sessionStorage.clear();
  });

  it('logout 應清除 token、user 並呼叫 cancelAllRequests', () => {
    useAuthStore.setState({ user: mockUser, token: 't1', isAuthenticated: true });
    localStorage.setItem('token', 't1');
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(mockCancelAllRequests).toHaveBeenCalled();
  });

  it('login 成功（不勾 rememberMe）應存到 sessionStorage', async () => {
    mockLogin.mockResolvedValue({ user: mockUser, token: 't1' });
    await useAuthStore.getState().login('u@example.com', 'pass');
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe('t1');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(sessionStorage.getItem('token')).toBe('t1');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('login 成功（勾 rememberMe）應存到 localStorage 並清除 sessionStorage', async () => {
    sessionStorage.setItem('token', 'old');
    mockLogin.mockResolvedValue({ user: mockUser, token: 't1' });
    await useAuthStore.getState().login('u@example.com', 'pass', true);
    expect(useAuthStore.getState().token).toBe('t1');
    expect(localStorage.getItem('token')).toBe('t1');
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('login 失敗應拋錯並設 isLoading 為 false', async () => {
    mockLogin.mockRejectedValue(new Error('登錄失敗'));
    await expect(
      useAuthStore.getState().login('u@example.com', 'wrong')
    ).rejects.toThrow('登錄失敗');
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('register 成功應設 user、token 並存入 localStorage、清除 sessionStorage', async () => {
    sessionStorage.setItem('token', 'stale');
    mockRegister.mockResolvedValue({ user: mockUser, token: 't2' });
    await useAuthStore.getState().register('u@example.com', 'pass', 'Nick');
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe('t2');
    expect(localStorage.getItem('token')).toBe('t2');
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('updateUser 有 currentUser 時應合併更新', () => {
    useAuthStore.setState({ user: mockUser });
    useAuthStore.getState().updateUser({ nickname: 'NewNick' });
    expect(useAuthStore.getState().user?.nickname).toBe('NewNick');
  });

  it('updateUser 無 currentUser 時不應改 state', () => {
    useAuthStore.setState({ user: null });
    useAuthStore.getState().updateUser({ nickname: 'X' });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('checkAuth 有 token 且 getProfile 成功應設 user', async () => {
    localStorage.setItem('token', 't1');
    mockGetProfile.mockResolvedValue(mockUser);
    await useAuthStore.getState().checkAuth();
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('checkAuth 無 token 時不調用 getProfile 並清除殘留狀態', async () => {
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
    localStorage.clear();
    sessionStorage.clear();
    await useAuthStore.getState().checkAuth();
    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('checkAuth getProfile 失敗應清除 token 與 user', async () => {
    localStorage.setItem('token', 'bad');
    mockGetProfile.mockRejectedValue(new Error('unauthorized'));
    await useAuthStore.getState().checkAuth();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('login 成功時若有 quickSessionId 應呼叫 claimSession', async () => {
    mockSessionStorageValue = 'qs1';
    mockLogin.mockResolvedValue({ user: mockUser, token: 't1' });
    mockClaimSession.mockResolvedValue(undefined);
    await useAuthStore.getState().login('u@example.com', 'pass');
    expect(mockClaimSession).toHaveBeenCalledWith('qs1');
  });

  it('register 成功時若有 quickSessionId 應呼叫 claimSession', async () => {
    mockSessionStorageValue = 'qs2';
    mockRegister.mockResolvedValue({ user: mockUser, token: 't2' });
    mockClaimSession.mockResolvedValue(undefined);
    await useAuthStore.getState().register('u@example.com', 'pass', 'Nick');
    expect(mockClaimSession).toHaveBeenCalledWith('qs2');
  });
});
