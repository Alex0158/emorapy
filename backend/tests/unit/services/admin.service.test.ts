import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockAdminUserFindUnique = jest.fn();
const mockAdminUserUpdate = jest.fn();
const mockAdminUserCount = jest.fn();
const mockAdminUserFindMany = jest.fn();
const mockAdminUserCreate = jest.fn();
const mockAdminRoleFindUnique = jest.fn();
const mockAdminRoleUpsert = jest.fn();
const mockAuditLogCreate = jest.fn();
const mockAuditLogFindMany = jest.fn();
const mockAuditLogCount = jest.fn();

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {
    adminUser: {
      findUnique: (...args: unknown[]) => mockAdminUserFindUnique(...args),
      update: (...args: unknown[]) => mockAdminUserUpdate(...args),
      count: (...args: unknown[]) => mockAdminUserCount(...args),
      findMany: (...args: unknown[]) => mockAdminUserFindMany(...args),
      create: (...args: unknown[]) => mockAdminUserCreate(...args),
    },
    adminRole: {
      findUnique: (...args: unknown[]) => mockAdminRoleFindUnique(...args),
      upsert: (...args: unknown[]) => mockAdminRoleUpsert(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
      findMany: (...args: unknown[]) => mockAuditLogFindMany(...args),
      count: (...args: unknown[]) => mockAuditLogCount(...args),
    },
  },
}));

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async () => 'hashed'),
    compare: jest.fn(async () => true),
  },
}));

import { adminService } from '../../../src/services/admin.service';

describe('admin.service safety guards', () => {
  const originalAdminBootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockAdminUserCount as any).mockResolvedValue(2);
    (mockAdminUserCreate as any).mockResolvedValue({
      id: 'admin-created',
      email: 'new-admin@example.com',
      name: 'Admin',
      role: { key: 'super_admin' },
    });
    (mockAdminRoleUpsert as any).mockResolvedValue({});
    (mockAdminRoleFindUnique as any).mockResolvedValue({ id: 'role-super-admin', key: 'super_admin' });
    (mockAuditLogCreate as any).mockResolvedValue({});
  });

  afterEach(() => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = originalAdminBootstrapToken;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('updateAdminUser 應拒絕自行停用', async () => {
    (mockAdminUserFindUnique as any).mockResolvedValue({
      id: 'a1',
      deleted_at: null,
      role: { key: 'super_admin' },
    });

    await expect(
      adminService.updateAdminUser('a1', {
        actorId: 'a1',
        isActive: false,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('deleteAdminUser 應拒絕自刪', async () => {
    (mockAdminUserFindUnique as any).mockResolvedValue({
      id: 'a1',
      is_active: true,
      deleted_at: null,
      email: 'a1@test.com',
      role: { key: 'super_admin' },
    });

    await expect(adminService.deleteAdminUser('a1', 'a1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('deleteAdminUser 應拒絕刪除最後一位 super_admin', async () => {
    (mockAdminUserFindUnique as any).mockResolvedValue({
      id: 'a1',
      is_active: true,
      deleted_at: null,
      email: 'a1@test.com',
      role: { key: 'super_admin' },
    });
    (mockAdminUserCount as any).mockResolvedValue(1);

    await expect(adminService.deleteAdminUser('a1', 'a2')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('listAdminUsers 應默認過濾 deleted_at', async () => {
    (mockAdminUserFindMany as any).mockResolvedValue([]);
    (mockAdminUserCount as any).mockResolvedValue(0);

    await adminService.listAdminUsers({ limit: 20, offset: 0 });

    expect(mockAdminUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      })
    );
  });

  it('無管理員時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
    (mockAdminUserFindMany as any).mockResolvedValue([]);
    (mockAdminUserCount as any).mockResolvedValue(0);

    const result = await adminService.listAdminUsers({ limit: 20, offset: 0 });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('listAuditLogs 無審計時應返回 items 空陣列與 total 0（F10 邊界）', async () => {
    (mockAuditLogFindMany as any).mockResolvedValue([]);
    (mockAuditLogCount as any).mockResolvedValue(0);

    const result = await adminService.listAuditLogs({ limit: 20, offset: 0 });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('bootstrap 缺少 ADMIN_BOOTSTRAP_TOKEN 應拒絕', async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = '';
    process.env.NODE_ENV = 'development';
    (mockAdminUserCount as any).mockResolvedValue(0);

    await expect(
      adminService.bootstrap({
        email: 'root@example.com',
        password: 'Password1234',
        name: 'Root Admin',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockAdminRoleUpsert).not.toHaveBeenCalled();
  });

  it('bootstrap token 錯誤應拒絕', async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = 'expected-token';
    process.env.NODE_ENV = 'development';
    (mockAdminUserCount as any).mockResolvedValue(0);

    await expect(
      adminService.bootstrap({
        email: 'root@example.com',
        password: 'Password1234',
        name: 'Root Admin',
        bootstrapToken: 'wrong-token',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockAdminRoleUpsert).not.toHaveBeenCalled();
  });

  it('bootstrap 已存在管理員時應拒絕重入且不得重置角色權限', async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = 'expected-token';
    process.env.NODE_ENV = 'development';
    (mockAdminUserCount as any).mockResolvedValue(1);

    await expect(
      adminService.bootstrap({
        email: 'root@example.com',
        password: 'Password1234',
        name: 'Root Admin',
        bootstrapToken: 'expected-token',
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockAdminRoleUpsert).not.toHaveBeenCalled();
    expect(mockAdminRoleFindUnique).not.toHaveBeenCalled();
    expect(mockAdminUserCreate).not.toHaveBeenCalled();
  });

  it('bootstrap 已存在管理員且 token 錯誤時仍不得重置角色權限', async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = 'expected-token';
    process.env.NODE_ENV = 'production';
    (mockAdminUserCount as any).mockResolvedValue(1);

    await expect(
      adminService.bootstrap({
        email: 'attacker@example.com',
        password: 'Password1234',
        name: 'Attacker',
        bootstrapToken: 'wrong-token',
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockAdminRoleUpsert).not.toHaveBeenCalled();
    expect(mockAdminRoleFindUnique).not.toHaveBeenCalled();
    expect(mockAdminUserCreate).not.toHaveBeenCalled();
  });

  it('bootstrap 生產環境缺少 token 設定應拒絕', async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = '';
    process.env.NODE_ENV = 'production';
    (mockAdminUserCount as any).mockResolvedValue(0);

    await expect(
      adminService.bootstrap({
        email: 'root@example.com',
        password: 'Password1234',
        name: 'Root Admin',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockAdminRoleUpsert).not.toHaveBeenCalled();
  });

  it('bootstrap 弱密碼應在建立角色前拒絕', async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = 'expected-token';
    process.env.NODE_ENV = 'development';
    (mockAdminUserCount as any).mockResolvedValue(0);

    await expect(
      adminService.bootstrap({
        email: 'root@example.com',
        password: 'short',
        name: 'Root Admin',
        bootstrapToken: 'expected-token',
      })
    ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    expect(mockAdminRoleUpsert).not.toHaveBeenCalled();
    expect(mockAdminUserCreate).not.toHaveBeenCalled();
  });

  it('bootstrap roleKey 對應角色不存在時應拋出 VALIDATION_ERROR（F10 邊界）', async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = 'expected-token';
    process.env.NODE_ENV = 'development';
    (mockAdminUserCount as any).mockResolvedValue(0);
    (mockAdminRoleFindUnique as any).mockResolvedValue(null);

    await expect(
      adminService.bootstrap({
        email: 'root@example.com',
        password: 'Password1234',
        name: 'Root Admin',
        bootstrapToken: 'expected-token',
        roleKey: 'invalid_role' as any,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('角色') });
    expect(mockAdminRoleUpsert).not.toHaveBeenCalled();
    expect(mockAdminRoleFindUnique).not.toHaveBeenCalled();
    expect(mockAdminUserCreate).not.toHaveBeenCalled();
  });

  it('bootstrap 合法首次請求應建立預設角色與管理員', async () => {
    process.env.ADMIN_BOOTSTRAP_TOKEN = 'expected-token';
    process.env.NODE_ENV = 'development';
    (mockAdminUserCount as any).mockResolvedValue(0);

    const result = await adminService.bootstrap({
      email: 'ROOT@example.com',
      password: 'Password1234',
      name: 'Root Admin',
      bootstrapToken: 'expected-token',
    });

    expect(mockAdminRoleUpsert).toHaveBeenCalledTimes(4);
    expect(mockAdminRoleFindUnique).toHaveBeenCalledWith({ where: { key: 'super_admin' } });
    expect(mockAdminUserCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'root@example.com',
        role_id: 'role-super-admin',
      }),
    }));
    expect(mockAuditLogCreate).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'admin-created',
      email: 'new-admin@example.com',
      name: 'Admin',
      role: 'super_admin',
    });
  });
});
