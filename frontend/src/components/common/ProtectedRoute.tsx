/**
 * 路由保護組件
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

/**
 * 保護路由組件
 * @param requireAuth - 是否需要認證（默認true）
 * @param redirectTo - 未認證時重定向的路徑（默認'/auth/login'）
 */
export default function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  // 如果需要認證但未認證，重定向到登錄頁
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

