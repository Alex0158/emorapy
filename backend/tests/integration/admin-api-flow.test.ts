import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

const mockAdminUserFindUnique = jest.fn() as any;
const mockAdminUserCount = jest.fn() as any;
const mockAdminUserCreate = jest.fn() as any;
const mockAdminRoleUpsert = jest.fn() as any;
const mockAdminRoleFindUnique = jest.fn() as any;
const mockAuditLogCreate = jest.fn() as any;
const mockAuditLogFindMany = jest.fn() as any;
const mockAuditLogCount = jest.fn() as any;
const mockSystemConfigFindMany = jest.fn() as any;
const mockSystemConfigCount = jest.fn() as any;
const mockSystemConfigUpsert = jest.fn() as any;
const mockUserUpdate = jest.fn() as any;
const mockUserCount = jest.fn() as any;

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    adminUser: {
      findUnique: (...args: unknown[]) => mockAdminUserFindUnique(...args),
      count: (...args: unknown[]) => mockAdminUserCount(...args),
      create: (...args: unknown[]) => mockAdminUserCreate(...args),
    },
    adminRole: {
      upsert: (...args: unknown[]) => mockAdminRoleUpsert(...args),
      findUnique: (...args: unknown[]) => mockAdminRoleFindUnique(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
      findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
      count: (...args: unknown[]) => mockAuditLogCount(...args),
    },
    systemConfig: {
      findMany: (...args: unknown[]) => mockSystemConfigFindMany(...args),
      count: (...args: unknown[]) => mockSystemConfigCount(...args),
      upsert: (...args: unknown[]) => mockSystemConfigUpsert(...args),
    },
    user: {
      count: (...args: unknown[]) => mockUserCount(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}));

jest.mock('../../src/utils/admin-jwt', () => ({
  verifyAdminToken: (token: string) => {
    if (token === 'super-token') {
      return { id: 'super-1', email: 'super@example.com', roleKey: 'super_admin' };
    }
    if (token === 'limited-token') {
      return { id: 'support-1', email: 'support@example.com', roleKey: 'support' };
    }
    if (token === 'disabled-token') {
      return { id: 'disabled-1', email: 'disabled@example.com', roleKey: 'ops' };
    }
    throw new Error('invalid token');
  },
  generateAdminToken: () => 'generated-admin-token',
}));

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async () => 'hashed-password'),
    compare: jest.fn(async () => true),
  },
}));

import app from '../../src/app';

describe('Admin API integration flow', () => {
  const originalAdminBootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_BOOTSTRAP_TOKEN = 'bootstrap-secret';

    mockAdminRoleUpsert.mockResolvedValue({} as any);
    mockAdminRoleFindUnique.mockResolvedValue({ id: 'role-super-admin', key: 'super_admin' } as any);
    mockUserCount.mockResolvedValue(42 as any);
    mockAdminUserCreate.mockResolvedValue({
      id: 'admin-1',
      email: 'root@example.com',
      name: 'Root',
      role: { key: 'super_admin' },
    } as any);
    mockAuditLogCreate.mockResolvedValue({} as any);
    mockAuditLogFindMany.mockResolvedValue([] as any);
    mockAuditLogCount.mockResolvedValue(0 as any);
    mockSystemConfigFindMany.mockResolvedValue([] as any);
    mockSystemConfigCount.mockResolvedValue(0 as any);
    mockSystemConfigUpsert.mockResolvedValue({
      id: 'cfg-1',
      key: 'feature.flags',
      value: { adminAuditExport: true },
      description: 'feature flags',
      is_runtime: true,
      is_sensitive: false,
      updated_by: 'super-1',
    } as any);
    mockUserUpdate.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'user@example.com',
      is_active: false,
      locked_until: null,
      deleted_at: new Date('2026-03-17T00:00:00.000Z'),
    } as any);
    mockAdminUserFindUnique.mockImplementation((({ where }: { where?: { id?: string } }) => {
      const id = where?.id;
      if (id === 'super-1') {
        return Promise.resolve({
          id: 'super-1',
          email: 'super@example.com',
          is_active: true,
          deleted_at: null,
          role: { key: 'super_admin', permissions: ['admin:all'] },
        });
      }
      if (id === 'support-1') {
        return Promise.resolve({
          id: 'support-1',
          email: 'support@example.com',
          is_active: true,
          deleted_at: null,
          role: { key: 'support', permissions: ['users:read'] },
        });
      }
      if (id === 'disabled-1') {
        return Promise.resolve({
          id: 'disabled-1',
          email: 'disabled@example.com',
          is_active: false,
          deleted_at: null,
          role: { key: 'ops', permissions: ['ops:read'] },
        });
      }
      return Promise.resolve(null);
    }) as any);
  });

  afterEach(() => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = originalAdminBootstrapToken;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('bootstrap 缺少 token 設定時應拒絕', async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = '';
    mockAdminUserCount.mockResolvedValue(0 as any);

    const res = await request(app).post('/api/v1/admin/bootstrap').send({
      email: 'root@example.com',
      password: 'Password1234',
      name: 'Root',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('bootstrap token 錯誤時應拒絕', async () => {
    mockAdminUserCount.mockResolvedValue(0 as any);

    const res = await request(app)
      .post('/api/v1/admin/bootstrap')
      .set('x-admin-bootstrap-token', 'wrong-token')
      .send({
        email: 'root@example.com',
        password: 'Password1234',
        name: 'Root',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('bootstrap 重入時應返回 CONFLICT', async () => {
    mockAdminUserCount.mockResolvedValue(1 as any);

    const res = await request(app)
      .post('/api/v1/admin/bootstrap')
      .set('x-admin-bootstrap-token', 'bootstrap-secret')
      .send({
        email: 'root@example.com',
        password: 'Password1234',
        name: 'Root',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('低權限 token 訪問高敏端點應返回 403', async () => {
    const auditRes = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', 'Bearer limited-token');

    expect(auditRes.status).toBe(403);
    expect(auditRes.body.success).toBe(false);
    expect(auditRes.body.error.code).toBe('FORBIDDEN');
  });

  it('super_admin 可 upsert config，且應寫入 audit log（F10 配置生效 + 審計留痕）', async () => {
    const res = await request(app)
      .put('/api/v1/admin/configs')
      .set('Authorization', 'Bearer super-token')
      .send({
        key: 'feature.flags',
        value: { adminAuditExport: true },
        description: 'feature flags',
        isRuntime: true,
        isSensitive: false,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.item.key).toBe('feature.flags');
    expect(mockSystemConfigUpsert).toHaveBeenCalled();
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actor_id: 'super-1',
        entity_type: 'system_config',
        action: 'upsert',
      }),
    }));
  });

  it('低權限 token 不可寫入 config（F10 RBAC）', async () => {
    const res = await request(app)
      .put('/api/v1/admin/configs')
      .set('Authorization', 'Bearer limited-token')
      .send({
        key: 'feature.flags',
        value: { adminAuditExport: true },
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('super_admin 可更新 user status，且應寫入 audit log（F10 用戶治理留痕）', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const res = await request(app)
      .patch(`/api/v1/admin/users/${userId}/status`)
      .set('Authorization', 'Bearer super-token')
      .send({
        action: 'deactivate',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(userId);
    expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: userId },
      data: expect.objectContaining({ is_active: false }),
    }));
    expect(mockAuditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actor_id: 'super-1',
        entity_type: 'user',
        entity_id: userId,
        action: 'user_deactivate',
      }),
    }));
  });

  it('super_admin 可查 audit logs，且返回 items/total（F10 審計查詢證據）', async () => {
    mockAuditLogFindMany.mockResolvedValueOnce([
      {
        id: 101,
        actor_id: 'super-1',
        actor_type: 'admin',
        entity_type: 'system_config',
        entity_id: 'cfg-1',
        action: 'upsert',
        detail: { key: 'feature.flags' },
        created_at: new Date('2026-03-17T08:00:00.000Z'),
      },
    ] as any);
    mockAuditLogCount.mockResolvedValueOnce(1 as any);

    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', 'Bearer super-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toEqual(expect.objectContaining({
      id: '101',
      actor_id: 'super-1',
      entity_type: 'system_config',
      action: 'upsert',
    }));
  });

  it('停用管理員 token 訪問多端點應返回 401', async () => {
    const meRes = await request(app)
      .get('/api/v1/admin/me')
      .set('Authorization', 'Bearer disabled-token');
    const usersRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer disabled-token');
    const auditRes = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', 'Bearer disabled-token');

    expect(meRes.status).toBe(401);
    expect(usersRes.status).toBe(401);
    expect(auditRes.status).toBe(401);
    expect(meRes.body.error.code).toBe('UNAUTHORIZED');
  });
});
