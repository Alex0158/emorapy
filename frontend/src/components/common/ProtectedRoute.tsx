/**
 * 路由保護組件
 */

import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

const HYDRATION_TIMEOUT_MS = 5000;

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
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (_hasHydrated) return;
    const id = setTimeout(() => setTimedOut(true), HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [_hasHydrated]);

  if (!_hasHydrated && !timedOut) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!_hasHydrated && timedOut) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

