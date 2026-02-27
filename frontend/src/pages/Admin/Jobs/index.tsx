import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Space, Table, Typography, message } from 'antd';
import type { AdminJobListItem } from '@/types/admin';
import { adminApi } from '@/services/api/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

export default function AdminJobsPage() {
  const queryClient = useQueryClient();
  const jobsQuery = useQuery({
    queryKey: ['admin', 'jobs', 'list'],
    queryFn: adminApi.listJobs,
  });
  const triggerMutation = useMutation({
    mutationFn: (jobKey: string) => adminApi.triggerJob(jobKey),
    onSuccess: () => {
      message.success(t('admin.jobs.triggerSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
    onError: () => {
      message.error(t('admin.jobs.triggerFailed'));
    },
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          {t('admin.jobs.heading')}
        </Title>
        <Text type="secondary">{t('admin.jobs.subtitle')}</Text>
      </div>
      {jobsQuery.error && <Alert showIcon type="error" title={t('admin.jobs.loadFailed')} />}
      <Card>
        <Table<AdminJobListItem>
          rowKey="key"
          loading={jobsQuery.isLoading}
          dataSource={jobsQuery.data?.jobs || []}
          pagination={false}
          columns={[
            { title: t('admin.jobs.key'), dataIndex: 'key' },
            { title: t('admin.jobs.schedule'), dataIndex: 'schedule' },
            {
              title: t('admin.jobs.latestStatus'),
              render: (_, row) => row.latestRun?.status || '-',
            },
            {
              title: t('admin.jobs.latestAt'),
              render: (_, row) => row.latestRun?.started_at || '-',
            },
            {
              title: t('admin.jobs.actions'),
              render: (_, row) => (
                <Button
                  loading={triggerMutation.isPending}
                  onClick={() => triggerMutation.mutate(row.key)}
                >
                  {t('admin.jobs.trigger')}
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
