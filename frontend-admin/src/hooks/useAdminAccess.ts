import { useMemo } from 'react';
import { hasAdminPermissions, type AdminPermissionMode } from '@/config/adminNavigation';
import { useAdminMe } from './useAdminMe';

export function useAdminAccess(
  requiredPermissions: string[],
  enabled = true,
  mode: AdminPermissionMode = 'any'
) {
  const adminMeQuery = useAdminMe(enabled);
  const permissions = adminMeQuery.data?.admin.permissions ?? [];

  const hasPermission = useMemo(
    () => hasAdminPermissions(permissions, requiredPermissions, mode),
    [permissions, requiredPermissions, mode]
  );
  const missingPermissions = useMemo(
    () =>
      requiredPermissions.filter((permission) => !permissions.includes(permission)),
    [permissions, requiredPermissions]
  );

  return {
    adminMeQuery,
    permissions,
    hasPermission,
    missingPermissions,
  };
}
