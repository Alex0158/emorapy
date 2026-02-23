/**
 * useAuth Hook 單元測試
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth, useRequireAuth } from './useAuth';

const mockCheckAuth = vi.fn();
const mockLogout = vi.fn();
const mockNavigate = vi.fn();
const mockMessageSuccess = vi.fn();

let mockAuthState = {
  user: { id: 'u1', email: 'u@example.com' } as Record<string, unknown> | null,
  isAuthenticated: true,
  checkAuth: mockCheckAuth,
  logout: mockLogout,
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('antd', () => ({
  message: { success: (...args: unknown[]) => mockMessageSuccess(...args) },
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: { id: 'u1', email: 'u@example.com' },
      isAuthenticated: true,
      checkAuth: mockCheckAuth,
      logout: mockLogout,
    };
  });

  it('應返回 user、isAuthenticated、logout', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toEqual({ id: 'u1', email: 'u@example.com' });
    expect(result.current.isAuthenticated).toBe(true);
    expect(typeof result.current.logout).toBe('function');
  });

  it('logout 應調用 store.logout、message.success、navigate("/")', () => {
    const { result } = renderHook(() => useAuth());
    act(() => {
      result.current.logout();
    });
    expect(mockLogout).toHaveBeenCalled();
    expect(mockMessageSuccess).toHaveBeenCalledWith('common.logoutSuccess');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

describe('useRequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('已認證時應返回 isAuthenticated=true', () => {
    mockAuthState.isAuthenticated = true;
    const { result } = renderHook(() => useRequireAuth());
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('未認證時應導航到登入頁', () => {
    mockAuthState.isAuthenticated = false;
    renderHook(() => useRequireAuth());
    expect(mockNavigate).toHaveBeenCalledWith('/auth/login', { replace: true });
  });
});
