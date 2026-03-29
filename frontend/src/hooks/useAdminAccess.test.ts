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

  it('mode=any 時具備任一權限應返回 true（F10 權限矩陣：any 模式）', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: {
          id: 'a5',
          email: 'ops@example.com',
          roleKey: 'ops',
          permissions: ['ops:read'],
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['ops:read', 'users:read'], true, 'any'));
    expect(result.current.hasPermission).toBe(true);
    expect(result.current.missingPermissions).toContain('users:read');
  });

  it('permissions 為非陣列時應正規化為空陣列不崩潰（F10 邊界：API 回傳不完整時防禦）', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: {
          id: 'a6',
          email: 'malformed@example.com',
          roleKey: 'ops',
          permissions: { ops: 'read' } as unknown as string[],
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['ops:read'], true));
    expect(result.current.hasPermission).toBe(false);
    expect(result.current.missingPermissions).toEqual(['ops:read']);
    expect(result.current.permissions).toEqual([]);
  });

  it('permissions 為 null 時應正規化為空陣列（F10 邊界：API 回傳不完整時防禦）', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: {
          id: 'a7',
          email: 'null@example.com',
          roleKey: 'ops',
          permissions: null,
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['ops:read'], true));
    expect(result.current.hasPermission).toBe(false);
    expect(result.current.permissions).toEqual([]);
  });

  it('admin 為 null 時應正規化為空陣列不崩潰（F10 邊界：API 回傳不完整時防禦）', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: null,
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['ops:read'], true));
    expect(result.current.permissions).toEqual([]);
    expect(result.current.hasPermission).toBe(false);
    expect(result.current.missingPermissions).toEqual(['ops:read']);
  });

  it('enabled=false 時 useAdminMe 不請求，permissions 為空應返回 hasPermission=false（F10 權限矩陣：disabled 時不放行）', () => {
    mockUseAdminMe.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['ops:read'], false));
    expect(result.current.permissions).toEqual([]);
    expect(result.current.hasPermission).toBe(false);
    expect(result.current.missingPermissions).toEqual(['ops:read']);
  });

  it('permissions 含非字串項時應過濾掉（F10 邊界：API 回傳不完整時防禦）', () => {
    mockUseAdminMe.mockReturnValue({
      data: {
        admin: {
          id: 'a8',
          email: 'mixed@example.com',
          roleKey: 'ops',
          permissions: ['ops:read', 123, null, undefined, {}, 'users:read'] as unknown as string[],
        },
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useAdminAccess(['ops:read', 'users:read'], true));
    expect(result.current.permissions).toEqual(['ops:read', 'users:read']);
    expect(result.current.hasPermission).toBe(true);
  });
});

