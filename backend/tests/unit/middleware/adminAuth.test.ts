/**
 * adminAuth middleware 單元測試
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import {
  authenticateAdmin,
  requireAdminPermission,
  requireAdminPermissionAll,
} from '../../../src/middleware/adminAuth';
import {
  DEFAULT_ROLE_PERMISSIONS,
  hasAdminPermission,
} from '../../../src/utils/admin-permissions';

const mockVerifyAdminToken = jest.fn();
const mockFindAdminUser = jest.fn();

jest.mock('../../../src/utils/admin-jwt', () => ({
  verifyAdminToken: (token: string) => mockVerifyAdminToken(token),
}));

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    adminUser: {
      findUnique: (...args: unknown[]) => mockFindAdminUser(...args),
    },
  },
}));

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request;
}

function createRes(): Response {
  return {} as Response;
}

describe('middleware/adminAuth', () => {
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
  });

  describe('authenticateAdmin', () => {
    it('缺少 Authorization 應回 UNAUTHORIZED', async () => {
      const req = createReq();
      await authenticateAdmin(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as { code: string }).code).toBe('UNAUTHORIZED');
    });

    it('token 無效時應回 UNAUTHORIZED', async () => {
      const req = createReq({ headers: { authorization: 'Bearer bad' } });
      mockVerifyAdminToken.mockImplementation(() => {
        throw new Error('bad token');
      });
      await authenticateAdmin(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('管理員不存在或停用時應回 UNAUTHORIZED', async () => {
      const req = createReq({ headers: { authorization: 'Bearer ok' } });
      mockVerifyAdminToken.mockReturnValue({ id: 'a1' });
      mockFindAdminUser.mockResolvedValue(null as never);
      await authenticateAdmin(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as { code: string }).code).toBe('UNAUTHORIZED');
    });

    it('驗證成功應掛載 req.admin', async () => {
      const req = createReq({ headers: { authorization: 'Bearer ok' } });
      mockVerifyAdminToken.mockReturnValue({ id: 'a1', email: 'admin@test.com', roleKey: 'ops' });
      mockFindAdminUser.mockResolvedValue({
        id: 'a1',
        email: 'admin@test.com',
        is_active: true,
        deleted_at: null,
        updated_at: new Date('2025-01-01T00:00:00Z'),
        role: {
          key: 'ops',
          permissions: ['ops:read', 'ops:execute'],
        },
      } as never);

      await authenticateAdmin(req, createRes(), next);
      expect(req.admin).toEqual({
        id: 'a1',
        email: 'admin@test.com',
        roleKey: 'ops',
        permissions: ['ops:read', 'ops:execute'],
      });
      expect(next).toHaveBeenCalledWith();
    });

    it('token iat 早於 admin.updated_at 時應回 UNAUTHORIZED（F10 權限：帳號變更後舊 token 失效）', async () => {
      const req = createReq({ headers: { authorization: 'Bearer ok' } });
      mockVerifyAdminToken.mockReturnValue({
        id: 'a1',
        email: 'admin@test.com',
        roleKey: 'ops',
        iat: 1000,
      });
      mockFindAdminUser.mockResolvedValue({
        id: 'a1',
        email: 'admin@test.com',
        is_active: true,
        deleted_at: null,
        updated_at: new Date(3000 * 1000),
        role: { key: 'ops', permissions: ['ops:read'] },
      } as never);

      await authenticateAdmin(req, createRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as { code: string; message: string }).code).toBe('UNAUTHORIZED');
      expect((next.mock.calls[0][0] as { message: string }).message).toContain('已失效');
    });
  });

  describe('requireAdminPermission', () => {
    it('未認證 admin 應回 UNAUTHORIZED', () => {
      const req = createReq();
      const guard = requireAdminPermission('ops:read');
      guard(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as { code: string }).code).toBe('UNAUTHORIZED');
    });

    it('權限不足應回 FORBIDDEN', () => {
      const req = createReq({
        admin: {
          id: 'a1',
          email: 'admin@test.com',
          roleKey: 'marketing',
          permissions: ['reports:read'],
        },
      } as unknown as Partial<Request>);
      const guard = requireAdminPermission('users:write');
      guard(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as { code: string }).code).toBe('FORBIDDEN');
    });

    it('有對應權限應通過', () => {
      const req = createReq({
        admin: {
          id: 'a1',
          email: 'admin@test.com',
          roleKey: 'ops',
          permissions: ['ops:read', 'ops:execute'],
        },
      } as unknown as Partial<Request>);
      const guard = requireAdminPermission('ops:read');
      guard(req, createRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    it('admin:all 應可通過所有權限檢查', () => {
      const req = createReq({
        admin: {
          id: 'a1',
          email: 'admin@test.com',
          roleKey: 'super_admin',
          permissions: ['admin:all'],
        },
      } as unknown as Partial<Request>);
      const guard = requireAdminPermission('users:write');
      guard(req, createRes(), next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('reports:sensitive:read', () => {
    it('只由 admin:all 或 ops 預設敏感報表權限通過', () => {
      expect(hasAdminPermission(['admin:all'], 'reports:sensitive:read')).toBe(true);
      expect(DEFAULT_ROLE_PERMISSIONS.ops).toContain('reports:sensitive:read');
      expect(hasAdminPermission(DEFAULT_ROLE_PERMISSIONS.ops, 'reports:sensitive:read')).toBe(true);
      expect(DEFAULT_ROLE_PERMISSIONS.marketing).not.toContain('reports:sensitive:read');
      expect(DEFAULT_ROLE_PERMISSIONS.support).not.toContain('reports:sensitive:read');
    });
  });

  describe('requireAdminPermissionAll', () => {
    it('缺少任一權限應回 FORBIDDEN', () => {
      const req = createReq({
        admin: {
          id: 'a1',
          email: 'admin@test.com',
          roleKey: 'ops',
          permissions: ['users:read'],
        },
      } as unknown as Partial<Request>);
      const guard = requireAdminPermissionAll('users:read', 'ops:read');
      guard(req, createRes(), next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((next.mock.calls[0][0] as { code: string }).code).toBe('FORBIDDEN');
    });

    it('具備全部權限時應通過', () => {
      const req = createReq({
        admin: {
          id: 'a1',
          email: 'admin@test.com',
          roleKey: 'ops',
          permissions: ['users:read', 'ops:read'],
        },
      } as unknown as Partial<Request>);
      const guard = requireAdminPermissionAll('users:read', 'ops:read');
      guard(req, createRes(), next);
      expect(next).toHaveBeenCalledWith();
    });
  });
});
