/**
 * 管理員權限路由守衛（遷移：Ant Alert → shadcn Alert）
 */

import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
  return labelKey ? t(labelKey) : t('admin.ops.permission.code', { code: permission });
};

const getIdentityErrorMessage = (error: { code?: string; message?: string } | null) => {
  const code = error?.code;
  if (code && ADMIN_ERROR_CODE_I18N_KEYS[code]) return t(ADMIN_ERROR_CODE_I18N_KEYS[code]);
  return t('admin.ops.identityFailedDesc');
};

interface AdminPermissionRouteProps {
  children: React.ReactNode;
  requiredPermissions: string[];
  allowMissingToken?: boolean;
  permissionMode?: 'any' | 'all';
}

export default function AdminPermissionRoute({ children, requiredPermissions, allowMissingToken = false, permissionMode = 'any' }: AdminPermissionRouteProps) {
  const adminToken = useAdminToken();
  const { tokenPresent, tokenReady } = deriveAdminTokenStatus(adminToken);
  const { adminMeQuery, hasPermission, missingPermissions } = useAdminAccess(requiredPermissions, tokenReady, permissionMode);

  if (!tokenPresent) {
    if (allowMissingToken) return <>{children}</>;
    return <Alert className="border-warning/30 bg-warning/5"><AlertTriangle className="size-4" /><AlertTitle>{t('admin.ops.tokenRequired')}</AlertTitle></Alert>;
  }

  if (!tokenReady) {
    if (allowMissingToken) return <>{children}</>;
    return <Alert className="border-destructive/30 bg-destructive/5"><AlertCircle className="size-4" /><AlertTitle>{t('admin.ops.invalidTokenFormat')}</AlertTitle></Alert>;
  }

  if (adminMeQuery.isLoading) {
    return <Alert className="border-primary/30 bg-primary-light/50"><Loader2 className="size-4 animate-spin" /><AlertTitle>{t('admin.ops.verifyingAccess')}</AlertTitle></Alert>;
  }

  if (adminMeQuery.error) {
    const queryError = adminMeQuery.error as { code?: string; message?: string } | null;
    const errorCode = queryError?.code;
    if (errorCode === 'FORBIDDEN') return <Alert className="border-warning/30 bg-warning/5"><AlertTriangle className="size-4" /><AlertTitle>{t('admin.ops.accessDenied')}</AlertTitle></Alert>;
    if (errorCode === 'NETWORK_ERROR') return <Alert className="border-destructive/30 bg-destructive/5"><AlertCircle className="size-4" /><AlertTitle>{t('common.networkError')}</AlertTitle></Alert>;
    return <Alert className="border-destructive/30 bg-destructive/5"><AlertCircle className="size-4" /><AlertTitle>{t('admin.ops.identityFailed')}</AlertTitle><AlertDescription>{getIdentityErrorMessage(queryError)}</AlertDescription></Alert>;
  }

  if (!hasPermission) {
    const requiredLabel = (missingPermissions.length > 0 ? missingPermissions : requiredPermissions).map(getPermissionLabel).join(', ');
    return <Alert className="border-warning/30 bg-warning/5"><AlertTriangle className="size-4" /><AlertTitle>{t('admin.ops.accessDeniedWithPermissions', { permissions: requiredLabel })}</AlertTitle></Alert>;
  }

  return <>{children}</>;
}
