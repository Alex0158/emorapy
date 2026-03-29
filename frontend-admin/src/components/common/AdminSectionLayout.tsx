import { Layout, Menu, Typography } from 'antd';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
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
import { useAdminToken } from '@/hooks/useAdminToken';
import { deriveAdminTokenStatus } from '@/utils/adminTokenState';
import { t } from '@/utils/i18n';
import VersionPopover from '@/components/common/VersionPopover';

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
  const token = useAdminToken();
  const { tokenPresent, tokenReady } = deriveAdminTokenStatus(token);

  if (!tokenPresent || !tokenReady) {
    return <Navigate to="/admin/login" replace />;
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>
              {t('admin.nav.title')}
            </Title>
            <Text type="secondary">{t('admin.nav.subtitle')}</Text>
          </div>
          <VersionPopover />
        </div>
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
