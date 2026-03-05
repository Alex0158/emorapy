import { Alert } from 'antd';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useAdminToken } from '@/hooks/useAdminToken';
import { deriveAdminTokenStatus } from '@/utils/adminTokenState';
import { t } from '@/utils/i18n';

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
        description={queryError?.message}
      />
    );
  }

  if (!hasPermission) {
    const requiredLabel =
      missingPermissions.length > 0
        ? missingPermissions.join(', ')
        : requiredPermissions.join(', ');
    return (
      <Alert
        showIcon
        type="warning"
        title={t('admin.ops.accessDeniedWithPermissions', {
          permissions: requiredLabel,
        })}
      />
    );
  }

  return <>{children}</>;
}
