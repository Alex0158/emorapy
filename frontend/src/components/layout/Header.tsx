/**
 * 頂部導航欄
 */

import { Layout, Menu, Button, Dropdown, Avatar, Space } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HomeOutlined, LoginOutlined, UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/utils/i18n';
import './Header.less';

const { Header: AntHeader } = Layout;

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">{t('nav.home')}</Link>,
    },
    {
      key: '/quick-experience/create',
      label: <Link to="/quick-experience/create">{t('nav.quickExperience')}</Link>,
    },
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
          <span className="logo-text">🐻 {t('nav.logo')}</span>
        </Link>

        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className="header-menu"
        />

        <div className="header-actions">
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

