/**
 * 簡化布局（快速體驗模式：僅Logo，無Header和Footer）
 */

import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import { Link } from 'react-router-dom';
import ScrollToTop from '@/components/common/ScrollToTop';
import { t } from '@/utils/i18n';
import './SimpleLayout.less';

const { Header, Content } = Layout;

const SimpleLayout = () => {
  return (
    <Layout className="simple-layout">
      <ScrollToTop />
      <Header className="simple-header">
        <Link to="/" className="logo-link">
          <span className="logo-text">{t('nav.logo')}</span>
        </Link>
      </Header>
      <Content className="simple-content">
        <Outlet />
      </Content>
    </Layout>
  );
};

export default SimpleLayout;

