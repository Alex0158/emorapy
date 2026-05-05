import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AdminPermissionRoute from '@/components/common/AdminPermissionRoute';
import AdminSectionLayout from '@/components/common/AdminSectionLayout';

const AdminLogin = lazy(() => import('@/pages/Admin/Login'));
const AdminOpsJobs = lazy(() => import('@/pages/Admin/OpsJobs'));
const AdminJobs = lazy(() => import('@/pages/Admin/Jobs'));
const AdminHealth = lazy(() => import('@/pages/Admin/Health'));
const AdminConfigs = lazy(() => import('@/pages/Admin/Configs'));
const AdminUsers = lazy(() => import('@/pages/Admin/Users'));
const AdminAuditLogs = lazy(() => import('@/pages/Admin/AuditLogs'));
const AdminReports = lazy(() => import('@/pages/Admin/Reports'));
const AdminSettings = lazy(() => import('@/pages/Admin/Settings'));

function LazyWrapper({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function RootLayout() {
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/admin/login" replace />,
      },
      {
        path: 'admin',
        element: (
          <LazyWrapper>
            <AdminSectionLayout />
          </LazyWrapper>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="/admin/ops/jobs" replace />,
          },
          {
            path: 'ops/jobs',
            element: (
              <LazyWrapper>
                <AdminPermissionRoute requiredPermissions={['ops:read']}>
                  <AdminOpsJobs />
                </AdminPermissionRoute>
              </LazyWrapper>
            ),
          },
          {
            path: 'jobs',
            element: (
              <LazyWrapper>
                <AdminPermissionRoute requiredPermissions={['ops:read']}>
                  <AdminJobs />
                </AdminPermissionRoute>
              </LazyWrapper>
            ),
          },
          {
            path: 'health',
            element: (
              <LazyWrapper>
                <AdminPermissionRoute requiredPermissions={['ops:read']}>
                  <AdminHealth />
                </AdminPermissionRoute>
              </LazyWrapper>
            ),
          },
          {
            path: 'configs',
            element: (
              <LazyWrapper>
                <AdminPermissionRoute requiredPermissions={['config:read']}>
                  <AdminConfigs />
                </AdminPermissionRoute>
              </LazyWrapper>
            ),
          },
          {
            path: 'users',
            element: (
              <LazyWrapper>
                <AdminPermissionRoute requiredPermissions={['users:read']}>
                  <AdminUsers />
                </AdminPermissionRoute>
              </LazyWrapper>
            ),
          },
          {
            path: 'audit-logs',
            element: (
              <LazyWrapper>
                <AdminPermissionRoute
                  requiredPermissions={['users:read', 'ops:read']}
                  permissionMode="all"
                >
                  <AdminAuditLogs />
                </AdminPermissionRoute>
              </LazyWrapper>
            ),
          },
          {
            path: 'reports',
            element: (
              <LazyWrapper>
                <AdminPermissionRoute requiredPermissions={['reports:read']}>
                  <AdminReports />
                </AdminPermissionRoute>
              </LazyWrapper>
            ),
          },
          {
            path: 'settings',
            element: (
              <LazyWrapper>
                <AdminPermissionRoute requiredPermissions={['admin:all']}>
                  <AdminSettings />
                </AdminPermissionRoute>
              </LazyWrapper>
            ),
          },
        ],
      },
      {
        path: 'admin/login',
        element: (
          <LazyWrapper>
            <AdminLogin />
          </LazyWrapper>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/admin/login" replace />,
      },
    ],
  },
]);
