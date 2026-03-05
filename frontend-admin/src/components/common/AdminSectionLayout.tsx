import { Layout, Menu, Typography } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  AlertOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HeartOutlined,
  HistoryOutlined,
  SettingOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { t } from '@/utils/i18n';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const adminMenuItems = [
  {
    key: '/admin/ops/jobs',
    icon: <DashboardOutlined />,
    label: <Link to="/admin/ops/jobs">{t('admin.nav.ops')}</Link>,
  },
  {
    key: '/admin/jobs',
    icon: <ToolOutlined />,
    label: <Link to="/admin/jobs">{t('admin.nav.jobs')}</Link>,
  },
  {
    key: '/admin/health',
    icon: <HeartOutlined />,
    label: <Link to="/admin/health">{t('admin.nav.health')}</Link>,
  },
  {
    key: '/admin/configs',
    icon: <SettingOutlined />,
    label: <Link to="/admin/configs">{t('admin.nav.configs')}</Link>,
  },
  {
    key: '/admin/users',
    icon: <TeamOutlined />,
    label: <Link to="/admin/users">{t('admin.nav.users')}</Link>,
  },
  {
    key: '/admin/audit-logs',
    icon: <HistoryOutlined />,
    label: <Link to="/admin/audit-logs">{t('admin.nav.audit')}</Link>,
  },
  {
    key: '/admin/reports',
    icon: <FileTextOutlined />,
    label: <Link to="/admin/reports">{t('admin.nav.reports')}</Link>,
  },
  {
    key: '/admin/settings',
    icon: <AlertOutlined />,
    label: <Link to="/admin/settings">{t('admin.nav.settings')}</Link>,
  },
];

export default function AdminSectionLayout() {
  const location = useLocation();
  const selected =
    adminMenuItems.find((item) => location.pathname.startsWith(item.key))?.key ||
    '/admin/ops/jobs';

  return (
    <Layout style={{ background: 'transparent', marginTop: 16 }}>
      <Sider
        width={240}
        breakpoint="lg"
        collapsedWidth={0}
        style={{ background: 'transparent', marginRight: 16 }}
      >
        <Title level={4} style={{ marginBottom: 4 }}>
          {t('admin.nav.title')}
        </Title>
        <Text type="secondary">{t('admin.nav.subtitle')}</Text>
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={adminMenuItems}
          style={{ marginTop: 12 }}
        />
      </Sider>
      <Content>
        <Outlet />
      </Content>
    </Layout>
  );
}
