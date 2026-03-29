import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Table, Typography, message } from 'antd';
import type { AdminJobListItem } from '@/types/admin';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { adminApi } from '@/services/api/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

export default function AdminJobsPage() {
  const queryClient = useQueryClient();
  const { hasPermission: canExecuteJobs } = useAdminAccess(['ops:execute'], true);
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
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        message.error(t('admin.ops.accessDenied'));
        return;
      }
      message.error(t('admin.jobs.triggerFailed'));
    },
  });

  const getJobStatusLabel = (status?: string) => {
    if (!status) return t('common.na');
    const translated = t(`admin.jobs.status.${status}`);
    return translated === `admin.jobs.status.${status}` ? status : translated;
  };

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <Title level={3} className="admin-page__header-title">{t('admin.jobs.heading')}</Title>
        <Text type="secondary" className="admin-page__header-subtitle">{t('admin.jobs.subtitle')}</Text>
      </div>
      {jobsQuery.error && (
        <Alert
          showIcon
          type="error"
          title={t('admin.jobs.loadFailed')}
          action={
            <Button
              size="small"
              loading={jobsQuery.isFetching}
              onClick={() => void jobsQuery.refetch()}
              data-testid="admin-jobs-load-retry"
            >
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {!canExecuteJobs && <Alert showIcon type="warning" title={t('admin.jobs.executeDenied')} />}
      <Card className="admin-page__table-card">
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
              render: (_, row) => getJobStatusLabel(row.latestRun?.status),
            },
            {
              title: t('admin.jobs.latestAt'),
              render: (_, row) => row.latestRun?.started_at || t('common.na'),
            },
            {
              title: t('admin.jobs.actions'),
              render: (_, row) => (
                <Button
                  loading={triggerMutation.isPending}
                  disabled={!canExecuteJobs}
                  onClick={() => triggerMutation.mutate(row.key)}
                >
                  {t('admin.jobs.trigger')}
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
