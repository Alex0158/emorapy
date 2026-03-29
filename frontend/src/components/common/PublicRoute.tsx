/**
 * 公開路由組件（已認證用戶訪問時重定向）
 */

import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

const HYDRATION_TIMEOUT_MS = 5000;

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

interface LocationState {
  from?: { pathname: string };
}

export default function PublicRoute({
  children,
  redirectTo = '/case/list',
}: PublicRouteProps) {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);
  const validRedirectPrefixes = [
    '/case', '/judgment', '/reconciliation', '/execution',
    '/profile', '/interview', '/quick-experience', '/chat',
  ];
  const state = location.state as LocationState | null;
  const rawFrom = state?.from?.pathname;
  const resolvedRedirectTo =
    rawFrom &&
    (rawFrom === '/' || validRedirectPrefixes.some((prefix) => rawFrom.startsWith(prefix)))
      ? rawFrom
      : redirectTo;

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

  if (isAuthenticated) {
    return <Navigate to={resolvedRedirectTo} replace />;
  }

  return <>{children}</>;
}
