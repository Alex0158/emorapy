import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Input, Space, Statistic, Typography, message } from 'antd';
import { useState } from 'react';
import dayjs from 'dayjs';
import { adminApi } from '@/services/api/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

export default function AdminReportsPage() {
  const [metricsInput, setMetricsInput] = useState('dau,mau,judgment_failed');
  const overviewQuery = useQuery({
    queryKey: ['admin', 'reports', 'overview'],
    queryFn: adminApi.getReportOverview,
  });
  const funnelQuery = useQuery({
    queryKey: ['admin', 'reports', 'funnel'],
    queryFn: adminApi.getReportFunnel,
  });
  const customMutation = useMutation({
    mutationFn: (metrics: string[]) => adminApi.getCustomReport(metrics),
  });

  const runCustomReport = () => {
    const metrics = metricsInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    customMutation.mutate(metrics);
  };

  const exportOverviewCsv = async () => {
    try {
      const blob = await adminApi.downloadReportOverviewCsv();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-overview-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(t('admin.reports.loadFailed'));
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          {t('admin.reports.heading')}
        </Title>
        <Text type="secondary">{t('admin.reports.subtitle')}</Text>
      </div>
      {(overviewQuery.error || funnelQuery.error) && <Alert showIcon type="error" title={t('admin.reports.loadFailed')} />}
      <Card title={t('admin.reports.overview')}>
        <Space wrap size="large">
          <Statistic title={t('admin.reports.users')} value={overviewQuery.data?.totals.users || 0} />
          <Statistic title={t('admin.reports.cases')} value={overviewQuery.data?.totals.cases || 0} />
          <Statistic title={t('admin.reports.judgments')} value={overviewQuery.data?.totals.judgments || 0} />
          <Statistic title={t('admin.reports.pairingRate')} value={overviewQuery.data?.conversion.pairingRate || 0} precision={4} />
        </Space>
        <Button style={{ marginTop: 12 }} onClick={exportOverviewCsv}>
          {t('admin.reports.exportCsv')}
        </Button>
      </Card>
      <Card title={t('admin.reports.funnel')}>
        <pre style={{ margin: 0 }}>{JSON.stringify(funnelQuery.data?.stages || [], null, 2)}</pre>
      </Card>
      <Card title={t('admin.reports.custom')}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            value={metricsInput}
            onChange={(event) => setMetricsInput(event.target.value)}
            placeholder="dau,mau,judgment_failed"
          />
          <Button onClick={runCustomReport} loading={customMutation.isPending}>
            {t('admin.reports.runCustom')}
          </Button>
          <pre style={{ margin: 0 }}>{JSON.stringify(customMutation.data?.metrics || {}, null, 2)}</pre>
        </Space>
      </Card>
    </Space>
  );
}
