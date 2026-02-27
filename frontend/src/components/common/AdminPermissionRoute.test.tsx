/**
 * AdminPermissionRoute 組件單元測試
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminPermissionRoute from './AdminPermissionRoute';

const mockUseAdminToken = vi.fn();
const mockUseAdminAccess = vi.fn();

vi.mock('@/hooks/useAdminToken', () => ({
  useAdminToken: () => mockUseAdminToken(),
}));

vi.mock('@/hooks/useAdminAccess', () => ({
  useAdminAccess: (...args: unknown[]) => mockUseAdminAccess(...args),
}));
vi.mock('@/services/api/admin', () => ({
  isLikelyAdminJwt: (token: string) => token === 'h.payload.s',
}));

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('AdminPermissionRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAdminToken.mockReturnValue('');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        isLoading: false,
        error: null,
      },
      hasPermission: false,
      missingPermissions: ['ops:read'],
    });
  });

  it('allowMissingToken=true 且無 token 時應渲染 children', () => {
    render(
      <AdminPermissionRoute requiredPermissions={['ops:read']} allowMissingToken>
        <span>child content</span>
      </AdminPermissionRoute>
    );

    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('allowMissingToken=false 且無 token 時應顯示 tokenRequired', () => {
    render(
      <AdminPermissionRoute requiredPermissions={['ops:read']}>
        <span>child content</span>
      </AdminPermissionRoute>
    );

    expect(screen.getByText('admin.ops.tokenRequired')).toBeInTheDocument();
    expect(screen.queryByText('child content')).not.toBeInTheDocument();
  });

  it('有 token 且 adminMe 載入中時應顯示 verifyingAccess', () => {
    mockUseAdminToken.mockReturnValue('h.payload.s');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        isLoading: true,
        error: null,
      },
      hasPermission: false,
      missingPermissions: ['ops:read'],
    });

    render(
      <AdminPermissionRoute requiredPermissions={['ops:read']}>
        <span>child content</span>
      </AdminPermissionRoute>
    );

    expect(screen.getByText('admin.ops.verifyingAccess')).toBeInTheDocument();
  });

  it('有 token 且 adminMe 錯誤時應顯示 identityFailed', () => {
    mockUseAdminToken.mockReturnValue('h.payload.s');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        isLoading: false,
        error: new Error('401'),
      },
      hasPermission: false,
      missingPermissions: ['ops:read'],
    });

    render(
      <AdminPermissionRoute requiredPermissions={['ops:read']}>
        <span>child content</span>
      </AdminPermissionRoute>
    );

    expect(screen.getByText('admin.ops.identityFailed')).toBeInTheDocument();
  });

  it('有 token 且權限不足時應顯示 accessDeniedWithPermissions', () => {
    mockUseAdminToken.mockReturnValue('h.payload.s');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        isLoading: false,
        error: null,
      },
      hasPermission: false,
      missingPermissions: ['users:read', 'ops:read'],
    });

    render(
      <AdminPermissionRoute requiredPermissions={['ops:read']}>
        <span>child content</span>
      </AdminPermissionRoute>
    );

    expect(screen.getByText('admin.ops.accessDeniedWithPermissions')).toBeInTheDocument();
    expect(screen.queryByText('child content')).not.toBeInTheDocument();
  });

  it('有 token 且權限足夠時應渲染 children', () => {
    mockUseAdminToken.mockReturnValue('h.payload.s');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        isLoading: false,
        error: null,
      },
      hasPermission: true,
      missingPermissions: [],
    });

    render(
      <AdminPermissionRoute requiredPermissions={['ops:read']}>
        <span>child content</span>
      </AdminPermissionRoute>
    );

    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('permissionMode=all 時應把模式傳給 useAdminAccess', () => {
    mockUseAdminToken.mockReturnValue('h.payload.s');
    mockUseAdminAccess.mockReturnValue({
      adminMeQuery: {
        isLoading: false,
        error: null,
      },
      hasPermission: true,
      missingPermissions: [],
    });

    render(
      <AdminPermissionRoute requiredPermissions={['users:read', 'ops:read']} permissionMode="all">
        <span>child content</span>
      </AdminPermissionRoute>
    );

    expect(mockUseAdminAccess).toHaveBeenCalledWith(['users:read', 'ops:read'], true, 'all');
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('token 格式無效且 allowMissingToken=false 時應顯示 invalidTokenFormat', () => {
    mockUseAdminToken.mockReturnValue('invalid');

    render(
      <AdminPermissionRoute requiredPermissions={['ops:read']}>
        <span>child content</span>
      </AdminPermissionRoute>
    );

    expect(screen.getByText('admin.ops.invalidTokenFormat')).toBeInTheDocument();
    expect(screen.queryByText('child content')).not.toBeInTheDocument();
  });
});
