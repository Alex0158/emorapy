/**
 * useAdminAccess Hook 單元測試
 */

import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdminAccess } from './useAdminAccess';

const mockUseAdminMe = vi.fn();

vi.mock('./useAdminMe', () => ({
  useAdminMe: (...args: unknown[]) => mockUseAdminMe(...args),
}));

describe('useAdminAccess', () => {
  it('requiredPermissions 為空時應返回 true', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: {
          id: 'a0',
          email: 'ops@example.com',
          roleKey: 'ops',
          permissions: [],
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess([], true));
    expect(result.current.hasPermission).toBe(true);
  });

  it('具備 admin:all 應視為有權限', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: {
          id: 'a1',
          email: 'root@example.com',
          roleKey: 'super_admin',
          permissions: ['admin:all'],
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['ops:read'], true));
    expect(result.current.hasPermission).toBe(true);
  });

  it('缺少必要權限應返回 false', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: {
          id: 'a2',
          email: 'support@example.com',
          roleKey: 'support',
          permissions: ['users:read'],
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['ops:read'], true));
    expect(result.current.hasPermission).toBe(false);
    expect(result.current.missingPermissions).toEqual(['ops:read']);
  });

  it('mode=all 時缺少其中一個權限應返回 false', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: {
          id: 'a3',
          email: 'audit@example.com',
          roleKey: 'ops',
          permissions: ['users:read'],
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['users:read', 'ops:read'], true, 'all'));
    expect(result.current.hasPermission).toBe(false);
  });

  it('mode=all 時具備全部權限應返回 true', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: {
          id: 'a4',
          email: 'audit@example.com',
          roleKey: 'ops',
          permissions: ['users:read', 'ops:read'],
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['users:read', 'ops:read'], true, 'all'));
    expect(result.current.hasPermission).toBe(true);
  });
});

