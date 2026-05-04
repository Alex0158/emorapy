/**
 * Admin Section Layout（遷移：Ant Layout/Menu/Typography → shadcn + Tailwind + Lucide）
 */

import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wrench, Heart, Settings, Users, History, FileText, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/utils/i18n';

const adminMenuItems = [
  { key: '/admin/ops/jobs', icon: LayoutDashboard, label: 'admin.nav.ops' },
  { key: '/admin/jobs', icon: Wrench, label: 'admin.nav.jobs' },
  { key: '/admin/health', icon: Heart, label: 'admin.nav.health' },
  { key: '/admin/configs', icon: Settings, label: 'admin.nav.configs' },
  { key: '/admin/users', icon: Users, label: 'admin.nav.users' },
  { key: '/admin/audit-logs', icon: History, label: 'admin.nav.audit' },
  { key: '/admin/reports', icon: FileText, label: 'admin.nav.reports' },
  { key: '/admin/settings', icon: Bell, label: 'admin.nav.settings' },
];

export default function AdminSectionLayout() {
  const location = useLocation();
  const selected = adminMenuItems.find((item) => location.pathname.startsWith(item.key))?.key || '/admin/ops/jobs';

  return (
    <div className="flex gap-4 mt-4">
      <aside className="hidden w-[240px] shrink-0 lg:block">
        <h4 className="text-base font-semibold text-foreground mb-1">{t('admin.nav.title')}</h4>
        <p className="text-xs text-muted-foreground mb-3">{t('admin.nav.subtitle')}</p>
        <nav className="space-y-1">
          {adminMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = selected === item.key;
            return (
              <Link
                key={item.key}
                to={item.key}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {t(item.label)}
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
