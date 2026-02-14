/**
 * 認證相關Hooks
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { message } from 'antd';
import { t } from '@/utils/i18n';

/**
 * 使用認證狀態
 */
export function useAuth() {
  const { user, isAuthenticated, checkAuth, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // 檢查認證狀態
    if (!isAuthenticated) {
      checkAuth();
    }
  }, [isAuthenticated, checkAuth]);

  const handleLogout = () => {
    logout();
    message.success(t('common.logoutSuccess'));
    navigate('/');
  };

  return {
    user,
    isAuthenticated,
    logout: handleLogout,
  };
}

/**
 * 需要認證的Hook
 */
export function useRequireAuth() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return { isAuthenticated };
}

