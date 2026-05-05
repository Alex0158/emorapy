import { AlertCircle, AlertTriangle, Loader2, Info } from 'lucide-react';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useAdminToken } from '@/hooks/useAdminToken';
import { deriveAdminTokenStatus } from '@/utils/adminTokenState';
import { t } from '@/utils/i18n';

function StatusAlert({ variant, title, description }: { variant: 'warning' | 'error' | 'info'; title: string; description?: string }) {
  const Icon = variant === 'error' ? AlertCircle : variant === 'warning' ? AlertTriangle : Info;
  const border = variant === 'error' ? 'border-destructive/30 bg-destructive/5' : variant === 'warning' ? 'border-warning/30 bg-warning/5' : 'border-primary/30 bg-primary/5';
  const iconColor = variant === 'error' ? 'text-destructive' : variant === 'warning' ? 'text-warning' : 'text-primary';
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${border}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor}`} />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

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
    if (allowMissingToken) return <>{children}</>;
    return <StatusAlert variant="warning" title={t('admin.ops.tokenRequired')} />;
  }

  if (!tokenReady) {
    if (allowMissingToken) return <>{children}</>;
    return <StatusAlert variant="error" title={t('admin.ops.invalidTokenFormat')} />;
  }

  if (adminMeQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{t('admin.ops.verifyingAccess')}</span>
      </div>
    );
  }

  if (adminMeQuery.error) {
    const queryError = adminMeQuery.error as { code?: string; message?: string } | null;
    const errorCode = queryError?.code;
    if (errorCode === 'FORBIDDEN') {
      return <StatusAlert variant="warning" title={t('admin.ops.accessDenied')} />;
    }
    if (errorCode === 'NETWORK_ERROR') {
      return <StatusAlert variant="error" title={t('common.networkError')} />;
    }
    return <StatusAlert variant="error" title={t('admin.ops.identityFailed')} description={queryError?.message} />;
  }

  if (!hasPermission) {
    const requiredLabel = missingPermissions.length > 0 ? missingPermissions.join(', ') : requiredPermissions.join(', ');
    return <StatusAlert variant="warning" title={t('admin.ops.accessDeniedWithPermissions', { permissions: requiredLabel })} />;
  }

  return <>{children}</>;
}
