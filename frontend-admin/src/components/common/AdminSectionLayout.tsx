import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wrench, Heart, Settings, Users, History, FileText, AlertTriangle } from 'lucide-react';
import { useAdminToken } from '@/hooks/useAdminToken';
import { deriveAdminTokenStatus } from '@/utils/adminTokenState';
import { t } from '@/utils/i18n';
import { cn } from '@/lib/utils';
import VersionPopover from '@/components/common/VersionPopover';

const navItems = [
  { path: '/admin/ops/jobs', icon: LayoutDashboard, labelKey: 'admin.nav.ops' },
  { path: '/admin/jobs', icon: Wrench, labelKey: 'admin.nav.jobs' },
  { path: '/admin/health', icon: Heart, labelKey: 'admin.nav.health' },
  { path: '/admin/configs', icon: Settings, labelKey: 'admin.nav.configs' },
  { path: '/admin/users', icon: Users, labelKey: 'admin.nav.users' },
  { path: '/admin/audit-logs', icon: History, labelKey: 'admin.nav.audit' },
  { path: '/admin/reports', icon: FileText, labelKey: 'admin.nav.reports' },
  { path: '/admin/settings', icon: AlertTriangle, labelKey: 'admin.nav.settings' },
];

export default function AdminSectionLayout() {
  const location = useLocation();
  const token = useAdminToken();
  const { tokenPresent, tokenReady } = deriveAdminTokenStatus(token);

  if (!tokenPresent || !tokenReady) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex gap-4 mt-4">
      <aside className="w-60 shrink-0 hidden lg:block">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h4 className="text-base font-semibold text-foreground">{t('admin.nav.title')}</h4>
            <p className="text-xs text-muted-foreground">{t('admin.nav.subtitle')}</p>
          </div>
          <VersionPopover />
        </div>
        <nav className="space-y-1">
          {navItems.map(({ path, icon: Icon, labelKey }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
