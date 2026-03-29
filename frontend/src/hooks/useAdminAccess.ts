/**
 * 管理員權限存取 Hook
 */

import { useMemo } from 'react';
import { useAdminMe } from './useAdminMe';

type PermissionMode = 'any' | 'all';

function hasRequiredPermission(
  permissions: string[],
  requiredPermissions: string[],
  mode: PermissionMode
) {
  if (requiredPermissions.length === 0) return true;
  if (permissions.includes('admin:all')) return true;
  if (mode === 'all') {
    return requiredPermissions.every((permission) => permissions.includes(permission));
  }
  return requiredPermissions.some((permission) => permissions.includes(permission));
}

export function useAdminAccess(
  requiredPermissions: string[],
  enabled = true,
  mode: PermissionMode = 'any'
) {
  const adminMeQuery = useAdminMe(enabled);
  const rawPermissions = adminMeQuery.data?.admin?.permissions ?? [];
  const permissions = Array.isArray(rawPermissions)
    ? rawPermissions.filter((p): p is string => typeof p === 'string')
    : [];

  const hasPermission = useMemo(
    () => hasRequiredPermission(permissions, requiredPermissions, mode),
    [permissions, requiredPermissions, mode]
  );
  const missingPermissions = useMemo(
    () => requiredPermissions.filter((permission) => !permissions.includes(permission)),
    [permissions, requiredPermissions]
  );

  return {
    adminMeQuery,
    permissions,
    hasPermission,
    missingPermissions,
  };
}

