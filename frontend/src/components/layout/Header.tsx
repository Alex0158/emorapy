/**
 * 頂部導航欄
 */

import { Layout, Menu, Button, Dropdown, Avatar, Space, Select } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HomeOutlined, LoginOutlined, UserOutlined, LogoutOutlined, SettingOutlined, GlobalOutlined, FileTextOutlined, CheckSquareOutlined, MessageOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getAdminLoginUrl } from '@/utils/adminEntry';
import { t, getLocale, onLocaleChange, setLocale, type Locale } from '@/utils/i18n';
import './Header.less';

const { Header: AntHeader } = Layout;

const NAV_PREFIX_MAP: Record<string, string> = {
  '/case': '/case/list',
  '/judgment': '/case/list',
  '/reconciliation': '/case/list',
  '/execution': '/execution/dashboard',
  '/profile': '/profile/index',
  '/chat': '/chat/room',
};
const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const adminLoginUrl = getAdminLoginUrl();
  const [locale, setLocalLocale] = useState<Locale>(getLocale());

  const selectedKeys = useMemo(() => {
    const { pathname } = location;
    if (pathname === '/') return ['/'];
    for (const [prefix, key] of Object.entries(NAV_PREFIX_MAP)) {
      if (pathname.startsWith(prefix)) return [key];
    }
    return [pathname];
  }, [location]);

  useEffect(() => {
    const unsubscribe = onLocaleChange(() => setLocalLocale(getLocale()));
    return unsubscribe;
  }, []);

  const handleLocaleChange = useCallback((value: Locale) => {
    // 先更新本地 state，避免 UI 因重渲染時序看起來像「沒切換」
    setLocalLocale(value);
    setLocale(value);
  }, []);

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">{t('nav.home')}</Link>,
    },
    ...(!isAuthenticated
      ? [
          {
            key: '/quick-experience/create',
            label: <Link to="/quick-experience/create">{t('nav.quickExperience')}</Link>,
          },
          {
            key: '/chat/room',
            icon: <MessageOutlined />,
            label: <Link to="/chat/room">{t('nav.chat')}</Link>,
          },
          {
            key: '/admin-login',
            icon: <SettingOutlined />,
            disabled: !adminLoginUrl,
            label: adminLoginUrl ? (
              <a href={adminLoginUrl} target="_blank" rel="noopener noreferrer">
                {t('nav.opsConsole')}
              </a>
            ) : (
              <span>{t('nav.opsConsole')}</span>
            ),
          },
        ]
      : [
          {
            key: '/case/list',
            icon: <FileTextOutlined />,
            label: <Link to="/case/list">{t('nav.myCases')}</Link>,
          },
          {
            key: '/execution/dashboard',
            icon: <CheckSquareOutlined />,
            label: <Link to="/execution/dashboard">{t('nav.execution')}</Link>,
          },
          {
            key: '/chat/room',
            icon: <MessageOutlined />,
            label: <Link to="/chat/room">{t('nav.chat')}</Link>,
          },
        ]),
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: t('nav.profile'),
      onClick: () => navigate('/profile/index'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: t('nav.settings'),
      onClick: () => navigate('/profile/settings'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('nav.logout'),
      onClick: () => {
        logout();
        navigate('/');
      },
    },
  ];

  return (
    <AntHeader className="app-header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-text">✨ {t('nav.logo')}</span>
        </Link>

        <Menu
          mode="horizontal"
          selectedKeys={selectedKeys}
          items={menuItems}
          className="header-menu"
        />

        <div className="header-actions">
          <Select
            value={locale}
            onChange={handleLocaleChange}
            size="small"
            className="locale-select"
            suffixIcon={<GlobalOutlined />}
            getPopupContainer={(triggerNode) => triggerNode.parentElement ?? document.body}
            options={[
              { value: 'zh-TW', label: t('auth.locale.zhTW') },
              { value: 'en-US', label: t('auth.locale.enUS') },
            ]}
          />
          {isAuthenticated ? (
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space className="user-info" style={{ cursor: 'pointer' }}>
                <Avatar
                  src={user?.avatar_url}
                  icon={<UserOutlined />}
                  size="small"
                />
                <span>{user?.nickname || user?.email}</span>
              </Space>
            </Dropdown>
          ) : (
            <>
              <Button type="link" icon={<LoginOutlined />}>
                <Link to="/auth/login">{t('nav.login')}</Link>
              </Button>
              <Button type="primary">
                <Link to="/auth/register">{t('nav.register')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </AntHeader>
  );
};

export default Header;

