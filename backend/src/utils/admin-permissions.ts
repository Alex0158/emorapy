import type { AdminRoleKey } from '@prisma/client';

export const DEFAULT_ROLE_PERMISSIONS: Record<AdminRoleKey, string[]> = {
  super_admin: ['admin:all'],
  ops: ['ops:read', 'ops:execute', 'config:read', 'users:read', 'reports:read'],
  marketing: ['reports:read', 'config:read'],
  support: ['users:read', 'users:write', 'reports:read'],
};

