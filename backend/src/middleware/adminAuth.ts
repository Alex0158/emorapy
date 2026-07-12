import { NextFunction, Request, Response } from 'express';
import prisma from '../config/database';
import { verifyAdminToken } from '../utils/admin-jwt';
import { hasAdminPermission } from '../utils/admin-permissions';
import { Errors } from '../utils/errors';

export type AdminPermission =
  | 'admin:all'
  | 'ops:read'
  | 'ops:execute'
  | 'config:read'
  | 'config:write'
  | 'users:read'
  | 'users:write'
  | 'reports:read'
  | 'reports:sensitive:read'
  | 'alerts:write';

export const authenticateAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw Errors.UNAUTHORIZED('未提供管理員認證 Token');
    }

    const token = authHeader.substring(7);
    const decoded = verifyAdminToken(token);

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      include: { role: true },
    });

    if (!admin || !admin.is_active || admin.deleted_at) {
      throw Errors.UNAUTHORIZED('管理員帳號不存在或未啟用');
    }
    // 使用 token iat 與帳號 updated_at 比對，確保帳號敏感變更（改密/停用/角色調整）後舊 token 失效。
    if (typeof decoded.iat === 'number') {
      const notBefore = Math.floor(admin.updated_at.getTime() / 1000);
      if (decoded.iat < notBefore) {
        throw Errors.UNAUTHORIZED('管理員 Token 已失效，請重新登入');
      }
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      roleKey: admin.role.key,
      permissions: Array.isArray(admin.role.permissions)
        ? admin.role.permissions.filter((p): p is string => typeof p === 'string')
        : [],
    };

    next();
  } catch (error) {
    next(error);
  }
};

const buildPermissionGuard = (mode: 'any' | 'all', permissions: AdminPermission[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.admin) {
        throw Errors.UNAUTHORIZED('管理員未認證');
      }

      const hasRequired =
        mode === 'all'
          ? permissions.every((permission) =>
              hasAdminPermission(req.admin!.permissions, permission)
            )
          : permissions.some((permission) =>
              hasAdminPermission(req.admin!.permissions, permission)
            );
      if (!hasRequired) {
        throw Errors.FORBIDDEN('管理員權限不足');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireAdminPermissionAny = (...permissions: AdminPermission[]) =>
  buildPermissionGuard('any', permissions);

export const requireAdminPermissionAll = (...permissions: AdminPermission[]) =>
  buildPermissionGuard('all', permissions);

// 向後相容：預設維持 any 模式
export const requireAdminPermission = (...permissions: AdminPermission[]) =>
  requireAdminPermissionAny(...permissions);
