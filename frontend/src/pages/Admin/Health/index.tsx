import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Spin, Typography } from 'antd';
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
    <div className="admin-page">
      <div className="admin-page__header">
        <Title level={3} className="admin-page__header-title">{t('admin.health.heading')}</Title>
        <Text type="secondary" className="admin-page__header-subtitle">{t('admin.health.subtitle')}</Text>
      </div>
      {healthQuery.error && (
        <Alert
          showIcon
          type="error"
          title={t('admin.health.loadFailed')}
          action={
            <Button size="small" loading={healthQuery.isFetching} onClick={() => healthQuery.refetch()} data-testid="admin-health-load-retry">
              {t('common.retry')}
            </Button>
          }
        />
      )}
      <Card className="admin-page__table-card">
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
              {healthQuery.data.cronStarted ? t('common.yesShort') : t('common.noShort')}
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
    </div>
  );
}
