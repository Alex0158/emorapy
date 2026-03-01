import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Descriptions, Space, Spin, Typography } from 'antd';
import { adminApi } from '@/services/api/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

export default function AdminHealthPage() {
  const healthQuery = useQuery({
    queryKey: ['admin', 'health', 'detailed'],
    queryFn: adminApi.getHealthDetailed,
    refetchInterval: 30000,
  });

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          {t('admin.health.heading')}
        </Title>
        <Text type="secondary">{t('admin.health.subtitle')}</Text>
      </div>
      {healthQuery.error && <Alert showIcon type="error" title={t('admin.health.loadFailed')} />}
      <Card>
        {healthQuery.isLoading || !healthQuery.data ? (
          <Spin />
        ) : (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label={t('admin.health.status')}>
              {healthQuery.data.status}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.health.timestamp')}>
              {healthQuery.data.timestamp}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.health.cronStarted')}>
              {healthQuery.data.cronStarted ? 'Y' : 'N'}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.health.activeJobCount')}>
              {healthQuery.data.activeJobCount}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.health.adminCount')}>
              {healthQuery.data.adminCount}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.health.userCount')}>
              {healthQuery.data.userCount}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.health.env')}>
              <pre style={{ margin: 0 }}>{JSON.stringify(healthQuery.data.env, null, 2)}</pre>
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.health.performance')}>
              <pre style={{ margin: 0 }}>{JSON.stringify(healthQuery.data.performance, null, 2)}</pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </Space>
  );
}
