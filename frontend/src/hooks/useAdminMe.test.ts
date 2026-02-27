/**
 * useAdminMe Hook 單元測試
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminMe } from './useAdminMe';

const mockGetMe = vi.fn();
const mockUseAdminToken = vi.fn(() => 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature');
const mockGetAdminTokenFingerprint = vi.fn((token?: string) => (token?.trim() ? 'h:test' : 'missing'));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    getMe: (...args: unknown[]) => mockGetMe(...args),
  },
  getAdminTokenFingerprint: (...args: unknown[]) => mockGetAdminTokenFingerprint(...args),
  isLikelyAdminJwt: (token: string) => token.trim().split('.').length === 3,
}));
vi.mock('./useAdminToken', () => ({
  useAdminToken: () => mockUseAdminToken(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAdminMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminToken.mockReturnValue('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoib3BzIn0.signature');
    mockGetAdminTokenFingerprint.mockImplementation((token?: string) => (token?.trim() ? 'h:test' : 'missing'));
  });

  it('應在 enabled=true 時調用 API', async () => {
    mockGetMe.mockResolvedValue({
      admin: { id: 'a1', email: 'ops@example.com', roleKey: 'ops', permissions: ['ops:read'] },
    });

    const { result } = renderHook(() => useAdminMe(true), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetMe).toHaveBeenCalledTimes(1);
  });

  it('應在 enabled=false 時不調用 API', async () => {
    renderHook(() => useAdminMe(false), { wrapper: createWrapper() });
    await waitFor(() => expect(mockGetMe).not.toHaveBeenCalled());
  });

  it('token 缺失時應避免調用 API', async () => {
    mockUseAdminToken.mockReturnValue('');
    renderHook(() => useAdminMe(true), { wrapper: createWrapper() });
    await waitFor(() => expect(mockGetMe).not.toHaveBeenCalled());
  });

  it('token 格式無效時應避免調用 API', async () => {
    mockUseAdminToken.mockReturnValue('invalid-token');
    renderHook(() => useAdminMe(true), { wrapper: createWrapper() });
    await waitFor(() => expect(mockGetMe).not.toHaveBeenCalled());
    expect(mockGetAdminTokenFingerprint).not.toHaveBeenCalled();
  });
});

