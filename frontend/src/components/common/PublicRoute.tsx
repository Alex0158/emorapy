/**
 * 公開路由組件（已認證用戶訪問時重定向）
 */

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * 公開路由組件
 * 如果用戶已認證，重定向到指定頁面（默認首頁）
 */
export default function PublicRoute({
  children,
  redirectTo = '/',
}: PublicRouteProps) {
  const { isAuthenticated } = useAuthStore();

  // 如果已認證，重定向
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

