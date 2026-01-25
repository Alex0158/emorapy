/**
 * 認證布局（居中卡片式）
 */

import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import './AuthLayout.less';

const { Content } = Layout;

const AuthLayout = () => {
  return (
    <Layout className="auth-layout">
      <Content className="auth-content">
        <Outlet />
      </Content>
    </Layout>
  );
};

export default AuthLayout;

