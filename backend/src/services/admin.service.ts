import bcrypt from 'bcrypt';
import { AdminRoleKey, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { generateAdminToken } from '../utils/admin-jwt';
import { DEFAULT_ROLE_PERMISSIONS } from '../utils/admin-permissions';
import { Errors } from '../utils/errors';

const ADMIN_SALT_ROUNDS = 10;

type AuditDetail = Prisma.InputJsonValue | undefined;

class AdminService {
  private async ensureDefaultRoles(): Promise<void> {
    const roles: Array<{ key: AdminRoleKey; name: string; description: string }> = [
      { key: 'super_admin', name: 'Super Admin', description: '全域管理權限' },
      { key: 'ops', name: 'Ops', description: '運維管理權限' },
      { key: 'marketing', name: 'Marketing', description: '行銷分析權限' },
      { key: 'support', name: 'Support', description: '客服與用戶管理權限' },
    ];

    for (const role of roles) {
      await prisma.adminRole.upsert({
        where: { key: role.key },
        create: {
          key: role.key,
          name: role.name,
          description: role.description,
          permissions: DEFAULT_ROLE_PERMISSIONS[role.key] as Prisma.InputJsonValue,
        },
        update: {
          name: role.name,
          description: role.description,
        },
      });
    }
  }

  async bootstrap(payload: {
    email: string;
    password: string;
    name: string;
    roleKey?: AdminRoleKey;
    bootstrapToken?: string;
  }) {
    await this.ensureDefaultRoles();
    const existingCount = await prisma.adminUser.count();
    if (existingCount > 0) {
      throw Errors.CONFLICT('管理員帳號已存在，請改用登入');
    }

    const requiredBootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!requiredBootstrapToken) {
      // 防止生產環境在未配置 token 時被公開初始化
      if (process.env.NODE_ENV === 'production') {
        throw Errors.FORBIDDEN('生產環境必須配置 ADMIN_BOOTSTRAP_TOKEN');
      }
      // 非生產環境也要求顯式 token，以免誤開
      throw Errors.FORBIDDEN('缺少 ADMIN_BOOTSTRAP_TOKEN 配置');
    }
    if (payload.bootstrapToken !== requiredBootstrapToken) {
      throw Errors.FORBIDDEN('Bootstrap token 不正確');
    }

    if (payload.password.length < 10) {
      throw Errors.WEAK_PASSWORD('管理員密碼至少 10 碼');
    }

    const roleKey = payload.roleKey || 'super_admin';
    const role = await prisma.adminRole.findUnique({ where: { key: roleKey } });
    if (!role) {
      throw Errors.VALIDATION_ERROR('管理員角色不存在');
    }

    const passwordHash = await bcrypt.hash(payload.password, ADMIN_SALT_ROUNDS);
    const admin = await prisma.adminUser.create({
      data: {
        email: payload.email.toLowerCase(),
        password_hash: passwordHash,
        name: payload.name,
        role_id: role.id,
      },
      include: { role: true },
    });

    await this.writeAuditLog({
      actorId: admin.id,
      actorType: 'admin',
      entityType: 'admin_user',
      entityId: admin.id,
      action: 'bootstrap',
      detail: { email: admin.email, role: admin.role.key },
    });

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role.key,
    };
  }

  async login(payload: { email: string; password: string }) {
    await this.ensureDefaultRoles();
    const admin = await prisma.adminUser.findUnique({
      where: { email: payload.email.toLowerCase() },
      include: { role: true },
    });

    if (!admin || admin.deleted_at || !admin.is_active) {
      throw Errors.INVALID_CREDENTIALS('管理員帳號或密碼錯誤');
    }

    const ok = await bcrypt.compare(payload.password, admin.password_hash);
    if (!ok) {
      throw Errors.INVALID_CREDENTIALS('管理員帳號或密碼錯誤');
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { last_login_at: new Date() },
    });

    const token = generateAdminToken({
      id: admin.id,
      email: admin.email,
      roleKey: admin.role.key,
    });

    await this.writeAuditLog({
      actorId: admin.id,
      actorType: 'admin',
      entityType: 'admin_user',
      entityId: admin.id,
      action: 'login',
      detail: { role: admin.role.key },
    });

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role.key,
        permissions: Array.isArray(admin.role.permissions)
          ? admin.role.permissions.filter((p): p is string => typeof p === 'string')
          : [],
      },
    };
  }

  async writeAuditLog(input: {
    actorId?: string;
    actorType?: string;
    entityType: string;
    entityId?: string;
    action: string;
    detail?: AuditDetail;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actor_id: input.actorId,
        actor_type: input.actorType,
        entity_type: input.entityType,
        entity_id: input.entityId,
        action: input.action,
        detail: input.detail ?? Prisma.JsonNull,
      },
    });
  }

  async listAuditLogs(query: {
    limit: number;
    offset: number;
    entityType?: string;
    action?: string;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType) where.entity_type = query.entityType;
    if (query.action) where.action = query.action;
    if (query.from || query.to) {
      where.created_at = {
        gte: query.from,
        lte: query.to,
      };
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }

  async listAdminUsers(query: { limit: number; offset: number; q?: string }) {
    const q = query.q?.trim();
    const where: Prisma.AdminUserWhereInput = q
      ? {
          deleted_at: null,
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { id: { contains: q } },
          ],
        }
      : { deleted_at: null };
    const [items, total] = await Promise.all([
      prisma.adminUser.findMany({
        where,
        include: {
          role: {
            select: {
              key: true,
              name: true,
              permissions: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      prisma.adminUser.count({ where }),
    ]);
    return { items, total };
  }

  async createAdminUser(input: {
    email: string;
    password: string;
    name: string;
    roleKey: AdminRoleKey;
    actorId?: string;
  }) {
    await this.ensureDefaultRoles();
    if (input.password.length < 10) {
      throw Errors.WEAK_PASSWORD('管理員密碼至少 10 碼');
    }
    const role = await prisma.adminRole.findUnique({ where: { key: input.roleKey } });
    if (!role) throw Errors.VALIDATION_ERROR('管理員角色不存在');
    const passwordHash = await bcrypt.hash(input.password, ADMIN_SALT_ROUNDS);
    const created = await prisma.adminUser.create({
      data: {
        email: input.email.toLowerCase(),
        password_hash: passwordHash,
        name: input.name,
        role_id: role.id,
      },
      include: { role: true },
    });
    await this.writeAuditLog({
      actorId: input.actorId,
      actorType: 'admin',
      entityType: 'admin_user',
      entityId: created.id,
      action: 'admin_user_create',
      detail: {
        email: created.email,
        roleKey: created.role.key,
      },
    });
    return created;
  }

  async updateAdminUser(
    adminUserId: string,
    input: { name?: string; roleKey?: AdminRoleKey; isActive?: boolean; password?: string; actorId?: string }
  ) {
    const target = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      include: { role: true },
    });
    if (!target || target.deleted_at) throw Errors.NOT_FOUND('管理員不存在');
    if (input.actorId && input.actorId === adminUserId) {
      if (input.isActive === false) {
        throw Errors.FORBIDDEN('不可停用自己的管理員帳號');
      }
      if (input.roleKey && input.roleKey !== target.role.key) {
        throw Errors.FORBIDDEN('不可自行變更角色');
      }
    }

    const shouldDowngradeOrDisableSuperAdmin =
      target.role.key === 'super_admin' &&
      ((typeof input.isActive === 'boolean' && input.isActive === false) ||
        (input.roleKey !== undefined && input.roleKey !== 'super_admin'));
    if (shouldDowngradeOrDisableSuperAdmin) {
      const activeSuperAdminCount = await prisma.adminUser.count({
        where: {
          deleted_at: null,
          is_active: true,
          role: { key: 'super_admin' },
        },
      });
      if (activeSuperAdminCount <= 1) {
        throw Errors.FORBIDDEN('系統至少需保留一位啟用中的 super_admin');
      }
    }

    const data: Prisma.AdminUserUpdateInput = {};
    if (typeof input.name === 'string') data.name = input.name.trim();
    if (typeof input.isActive === 'boolean') {
      data.is_active = input.isActive;
      data.deleted_at = input.isActive ? null : new Date();
    }
    if (typeof input.password === 'string' && input.password.trim().length > 0) {
      if (input.password.length < 10) {
        throw Errors.WEAK_PASSWORD('管理員密碼至少 10 碼');
      }
      data.password_hash = await bcrypt.hash(input.password, ADMIN_SALT_ROUNDS);
    }
    if (input.roleKey) {
      const role = await prisma.adminRole.findUnique({ where: { key: input.roleKey } });
      if (!role) throw Errors.VALIDATION_ERROR('管理員角色不存在');
      data.role = { connect: { id: role.id } };
    }

    const updated = await prisma.adminUser.update({
      where: { id: adminUserId },
      data,
      include: { role: true },
    });

    await this.writeAuditLog({
      actorId: input.actorId,
      actorType: 'admin',
      entityType: 'admin_user',
      entityId: updated.id,
      action: 'admin_user_update',
      detail: {
        changed: {
          name: typeof input.name === 'string',
          roleKey: input.roleKey || null,
          isActive: typeof input.isActive === 'boolean' ? input.isActive : null,
          passwordReset: typeof input.password === 'string' && input.password.trim().length > 0,
        },
      },
    });
    return updated;
  }

  async deleteAdminUser(adminUserId: string, actorId?: string) {
    const target = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      include: { role: true },
    });
    if (!target || target.deleted_at) throw Errors.NOT_FOUND('管理員不存在');
    if (actorId && actorId === adminUserId) {
      throw Errors.FORBIDDEN('不可刪除自己的管理員帳號');
    }
    if (target.role.key === 'super_admin' && target.is_active) {
      const activeSuperAdminCount = await prisma.adminUser.count({
        where: {
          deleted_at: null,
          is_active: true,
          role: { key: 'super_admin' },
        },
      });
      if (activeSuperAdminCount <= 1) {
        throw Errors.FORBIDDEN('系統至少需保留一位啟用中的 super_admin');
      }
    }

    const deleted = await prisma.adminUser.update({
      where: { id: adminUserId },
      data: {
        is_active: false,
        deleted_at: new Date(),
      },
      include: { role: true },
    });

    await this.writeAuditLog({
      actorId,
      actorType: 'admin',
      entityType: 'admin_user',
      entityId: deleted.id,
      action: 'admin_user_delete',
      detail: {
        email: deleted.email,
        roleKey: deleted.role.key,
      },
    });

    return deleted;
  }
}

export const adminService = new AdminService();

