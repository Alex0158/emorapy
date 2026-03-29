import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Input, Space, Statistic, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import dayjs from 'dayjs';
import { adminApi } from '@/services/api/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

export default function AdminReportsPage() {
  const [metricsInput, setMetricsInput] = useState(t('admin.reports.metricsPlaceholder'));
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
  const costQuery = useQuery({
    queryKey: ['admin', 'reports', 'costs'],
    queryFn: adminApi.getReportCosts,
  });

  const runCustomReport = () => {
    const metrics = metricsInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    customMutation.mutate(metrics);
  };

  const getProviderTagLabel = (provider: 'redis' | 'railway' | 'openai', status?: string) => {
    const providerLabel = t(`admin.reports.provider.${provider}`);
    const resolvedStatus = (() => {
      if (!status) return t('admin.reports.status.unknown');
      const maybeTranslated = t(`admin.reports.status.${status}`);
      return maybeTranslated === `admin.reports.status.${status}` ? status : maybeTranslated;
    })();
    return `${providerLabel}: ${resolvedStatus}`;
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
    <div className="admin-page">
      <div className="admin-page__header">
        <Title level={3} className="admin-page__header-title">{t('admin.reports.heading')}</Title>
        <Text type="secondary" className="admin-page__header-subtitle">{t('admin.reports.subtitle')}</Text>
      </div>
      {(overviewQuery.error || funnelQuery.error || costQuery.error) && (
        <Alert
          showIcon
          type="error"
          title={t('admin.reports.loadFailed')}
          action={
            <Button
              size="small"
              loading={overviewQuery.isFetching || funnelQuery.isFetching || costQuery.isFetching}
              onClick={() => {
                void overviewQuery.refetch();
                void funnelQuery.refetch();
                void costQuery.refetch();
              }}
              data-testid="admin-reports-load-retry"
            >
              {t('common.retry')}
            </Button>
          }
        />
      )}
      <div className="admin-page__content">
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
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Input
            value={metricsInput}
            onChange={(event) => setMetricsInput(event.target.value)}
            placeholder={t('admin.reports.metricsPlaceholder')}
          />
          <Button onClick={runCustomReport} loading={customMutation.isPending}>
            {t('admin.reports.runCustom')}
          </Button>
          <pre style={{ margin: 0 }}>{JSON.stringify(customMutation.data?.metrics || {}, null, 2)}</pre>
        </Space>
      </Card>
      <Card title={t('admin.reports.costs')}>
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          {costQuery.data?.partial ? (
            <Alert
              showIcon
              type="warning"
              title={t('admin.reports.costsPartial')}
              description={(costQuery.data.reasons || []).join('；') || '-'}
            />
          ) : null}
          <Space wrap size="large">
            <Statistic
              title={t('admin.reports.redisMemoryMb')}
              value={costQuery.data?.summary.redisMemoryMb || 0}
              suffix="MB"
              precision={2}
            />
            <Statistic
              title={t('admin.reports.railwayEgress24h')}
              value={costQuery.data?.summary.railwayEgressGb24h || 0}
              suffix="GB"
              precision={3}
            />
            <Statistic
              title={t('admin.reports.openaiCost24h')}
              value={costQuery.data?.summary.openaiCostUsd24h || 0}
              prefix="$"
              precision={4}
            />
            <Statistic
              title={t('admin.reports.openaiCost7d')}
              value={costQuery.data?.summary.openaiCostUsd7d || 0}
              prefix="$"
              precision={4}
            />
          </Space>
          <Space wrap>
            <Tag>{getProviderTagLabel('redis', costQuery.data?.redis.status)}</Tag>
            <Tag>{getProviderTagLabel('railway', costQuery.data?.railway.status)}</Tag>
            <Tag>{getProviderTagLabel('openai', costQuery.data?.openai.status)}</Tag>
          </Space>
          <pre style={{ margin: 0 }}>
            {JSON.stringify(
              {
                railwayDailyEgressGb: costQuery.data?.railway.dailyEgressGb || [],
                openaiDailyCostUsd: costQuery.data?.openai.dailyCostUsd || [],
                openaiTokens24h: {
                  input: costQuery.data?.summary.openaiInputTokens24h || 0,
                  output: costQuery.data?.summary.openaiOutputTokens24h || 0,
                },
              },
              null,
              2
            )}
          </pre>
        </Space>
      </Card>
      </div>
    </div>
  );
}
