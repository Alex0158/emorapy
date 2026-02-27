import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useAdminSession } from './useAdminSession';

const mockInvalidateQueries = vi.fn();
const mockLogin = vi.fn();
const mockSetAdminToken = vi.fn();

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    login: (...args: unknown[]) => mockLogin(...args),
  },
  setAdminToken: (...args: unknown[]) => mockSetAdminToken(...args),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
    }),
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return createElement(QueryClientProvider, { client }, children);
}

describe('useAdminSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login 成功應寫入 token 並失效 admin queries', async () => {
    mockLogin.mockResolvedValue({
      token: 'h.payload.s',
      admin: { id: 'a1', email: 'admin@test.com', name: 'Admin', role: 'ops', permissions: ['ops:read'] },
    });

    const { result } = renderHook(() => useAdminSession(), { wrapper });
    await act(async () => {
      await result.current.loginMutation.mutateAsync({
        email: 'admin@test.com',
        password: 'Password123',
      });
    });

    expect(mockSetAdminToken).toHaveBeenCalledWith('h.payload.s');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['admin'] });
  });

  it('logout 應清除 token 並失效 admin queries', () => {
    const { result } = renderHook(() => useAdminSession(), { wrapper });
    act(() => {
      result.current.logout();
    });

    expect(mockSetAdminToken).toHaveBeenCalledWith('');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['admin'] });
  });
});
