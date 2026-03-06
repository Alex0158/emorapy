/**
 * 管理員權限路由守衛
 */

import { Alert } from 'antd';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useAdminToken } from '@/hooks/useAdminToken';
import { deriveAdminTokenStatus } from '@/utils/adminTokenState';
import { t } from '@/utils/i18n';

const ADMIN_PERMISSION_LABEL_KEYS: Record<string, string> = {
  'ops:read': 'admin.ops.permission.opsRead',
  'ops:execute': 'admin.ops.permission.opsExecute',
  'users:read': 'admin.ops.permission.usersRead',
  'users:write': 'admin.ops.permission.usersWrite',
  'config:read': 'admin.ops.permission.configRead',
  'config:write': 'admin.ops.permission.configWrite',
};

const ADMIN_ERROR_CODE_I18N_KEYS: Record<string, string> = {
  UNAUTHORIZED: 'common.unauthorized',
  FORBIDDEN: 'common.forbidden',
  NOT_FOUND: 'common.notFound',
  NETWORK_ERROR: 'common.networkError',
  INVALID_TOKEN: 'admin.ops.invalidTokenFormat',
};

const getPermissionLabel = (permission: string) => {
  const labelKey = ADMIN_PERMISSION_LABEL_KEYS[permission];
  if (labelKey) {
    return t(labelKey);
  }
  return t('admin.ops.permission.code', { code: permission });
};

const getIdentityErrorMessage = (error: { code?: string; message?: string } | null) => {
  const code = error?.code;
  if (code && ADMIN_ERROR_CODE_I18N_KEYS[code]) {
    return t(ADMIN_ERROR_CODE_I18N_KEYS[code]);
  }
  return t('admin.ops.identityFailedDesc');
};

interface AdminPermissionRouteProps {
  children: React.ReactNode;
  requiredPermissions: string[];
  allowMissingToken?: boolean;
  permissionMode?: 'any' | 'all';
}

export default function AdminPermissionRoute({
  children,
  requiredPermissions,
  allowMissingToken = false,
  permissionMode = 'any',
}: AdminPermissionRouteProps) {
  const adminToken = useAdminToken();
  const { tokenPresent, tokenReady } = deriveAdminTokenStatus(adminToken);
  const { adminMeQuery, hasPermission, missingPermissions } = useAdminAccess(
    requiredPermissions,
    tokenReady,
    permissionMode
  );

  if (!tokenPresent) {
    if (allowMissingToken) {
      return <>{children}</>;
    }
    return <Alert showIcon type="warning" title={t('admin.ops.tokenRequired')} />;
  }

  if (!tokenReady) {
    if (allowMissingToken) {
      return <>{children}</>;
    }
    return <Alert showIcon type="error" title={t('admin.ops.invalidTokenFormat')} />;
  }

  if (adminMeQuery.isLoading) {
    return <Alert showIcon type="info" title={t('admin.ops.verifyingAccess')} />;
  }

  if (adminMeQuery.error) {
    const queryError = adminMeQuery.error as { code?: string; message?: string } | null;
    const errorCode = queryError?.code;
    if (errorCode === 'FORBIDDEN') {
      return <Alert showIcon type="warning" title={t('admin.ops.accessDenied')} />;
    }
    if (errorCode === 'NETWORK_ERROR') {
      return <Alert showIcon type="error" title={t('common.networkError')} />;
    }
    return (
      <Alert
        showIcon
        type="error"
        title={t('admin.ops.identityFailed')}
        description={getIdentityErrorMessage(queryError)}
      />
    );
  }

  if (!hasPermission) {
    const requiredLabel = (missingPermissions.length > 0 ? missingPermissions : requiredPermissions)
      .map(getPermissionLabel)
      .join(', ');
    return (
      <Alert
        showIcon
        type="warning"
        title={t('admin.ops.accessDeniedWithPermissions', { permissions: requiredLabel })}
      />
    );
  }

  return <>{children}</>;
}
