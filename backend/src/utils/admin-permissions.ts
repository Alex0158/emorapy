import type { AdminRoleKey } from '@prisma/client';

export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRoleKey, string[]> = {
  super_admin: ['admin:all'],
  ops: [
    'ops:read',
    'ops:execute',
    'config:read',
    'users:read',
    'reports:read',
    'reports:sensitive:read',
  ],
  marketing: ['reports:read', 'config:read'],
  support: ['users:read', 'users:write', 'reports:read'],
};

export function hasAdminPermission(
  permissions: string[],
  requiredPermission: string
): boolean {
  return permissions.includes('admin:all') || permissions.includes(requiredPermission);
}
