import { useLocation, useNavigate } from 'react-router-dom';
import { HomeOutlined, PlusCircleOutlined, MessageOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/utils/i18n';
import './BottomNav.less';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const navItems = isAuthenticated
    ? [
        { key: '/', icon: <HomeOutlined />, label: t('nav.home') },
        { key: '/case/list', icon: <FileTextOutlined />, label: t('nav.myCases') },
        { key: '/case/create', icon: <PlusCircleOutlined className="text-2xl text-primary" />, label: t('nav.createCase'), isPrimary: true },
        { key: '/chat/room', icon: <MessageOutlined />, label: t('nav.chat') },
        { key: '/profile/index', icon: <UserOutlined />, label: t('nav.profile') },
      ]
    : [
        { key: '/', icon: <HomeOutlined />, label: t('nav.home') },
        { key: '/quick-experience/create', icon: <PlusCircleOutlined className="text-2xl text-primary" />, label: t('nav.quickExperience'), isPrimary: true },
        { key: '/chat/room', icon: <MessageOutlined />, label: t('nav.chat') },
        { key: '/auth/login', icon: <UserOutlined />, label: t('nav.login') },
      ];

  return (
    <div className="bottom-nav md:hidden">
      {navItems.map((item) => {
        const isActive = location.pathname === item.key || (item.key !== '/' && location.pathname.startsWith(item.key));
        return (
          <div
            key={item.key}
            className={`nav-item ${isActive ? 'active' : ''} ${item.isPrimary ? 'primary-item' : ''}`}
            onClick={() => navigate(item.key)}
          >
            <div className="icon-wrapper">{item.icon}</div>
            <span className="label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
};

export default BottomNav;
