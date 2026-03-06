/**
 * 應用主布局（完整布局：Header + Footer）
 */

import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import Header from './Header';
import Footer from './Footer';
import BottomNav from './BottomNav';
import ScrollToTop from '@/components/common/ScrollToTop';
import './AppLayout.less';

const { Content } = Layout;

const AppLayout = () => {
  return (
    <Layout className="app-layout min-h-screen bg-background">
      <ScrollToTop />
      <Header />
      <Content className="app-content">
        <Outlet />
      </Content>
      <Footer />
      <BottomNav />
    </Layout>
  );
};

export default AppLayout;

