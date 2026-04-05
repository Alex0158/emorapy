import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Input,
  InputNumber,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { useState } from 'react';
import dayjs from 'dayjs';
import { adminApi } from '@/services/api/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

export default function AdminReportsPage() {
  const [metricsInput, setMetricsInput] = useState('dau,mau,judgment_failed');
  const [aiStreamDays, setAIStreamDays] = useState(7);
  const [aiStreamSource, setAIStreamSource] = useState<'live' | 'archive' | 'all'>('all');
  const [aiStreamStatus, setAIStreamStatus] = useState<string | undefined>(undefined);
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
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
  const aiStreamOverviewQuery = useQuery({
    queryKey: ['admin', 'reports', 'ai-streams', aiStreamDays],
    queryFn: () => adminApi.getReportAIStreams({ days: aiStreamDays, limit: 10 }),
  });
  const aiStreamSessionsQuery = useQuery({
    queryKey: ['admin', 'reports', 'ai-streams', 'sessions', aiStreamDays, aiStreamSource, aiStreamStatus],
    queryFn: () => adminApi.listReportAIStreamSessions({
      days: aiStreamDays,
      source: aiStreamSource,
      status: aiStreamStatus,
      limit: 20,
      offset: 0,
    }),
  });
  const aiStreamDetailQuery = useQuery({
    queryKey: ['admin', 'reports', 'ai-streams', 'detail', selectedStreamId, aiStreamSource],
    queryFn: () => adminApi.getReportAIStreamDetail(selectedStreamId, {
      source: aiStreamSource,
      eventLimit: 100,
    }),
    enabled: Boolean(selectedStreamId),
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
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          {t('admin.reports.heading')}
        </Title>
        <Text type="secondary">{t('admin.reports.subtitle')}</Text>
      </div>
      {(overviewQuery.error || funnelQuery.error || costQuery.error || aiStreamOverviewQuery.error || aiStreamSessionsQuery.error || aiStreamDetailQuery.error) && (
        <Alert showIcon type="error" title={t('admin.reports.loadFailed')} />
      )}
      <Card title={t('admin.reports.overview')}>
        <Space wrap size="large">
          <Statistic title={t('admin.reports.users')} value={overviewQuery.data?.totals.users || 0} />
          <Statistic title={t('admin.reports.cases')} value={overviewQuery.data?.totals.cases || 0} />
          <Statistic
            title={t('admin.reports.judgments')}
            value={overviewQuery.data?.totals.judgments || 0}
          />
          <Statistic
            title={t('admin.reports.pairingRate')}
            value={overviewQuery.data?.conversion.pairingRate || 0}
            precision={4}
          />
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
            placeholder="dau,mau,judgment_failed"
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
            <Tag>{`Redis: ${costQuery.data?.redis.status || 'unknown'}`}</Tag>
            <Tag>{`Railway: ${costQuery.data?.railway.status || 'unknown'}`}</Tag>
            <Tag>{`OpenAI: ${costQuery.data?.openai.status || 'unknown'}`}</Tag>
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
      <Card title={t('admin.reports.aiStreams')}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap>
            <InputNumber
              min={1}
              max={90}
              value={aiStreamDays}
              onChange={(value) => setAIStreamDays(Number(value || 7))}
              addonBefore={t('admin.reports.aiStreamsWindowDays')}
            />
            <Select
              style={{ minWidth: 180 }}
              value={aiStreamSource}
              onChange={(value) => setAIStreamSource(value)}
              options={[
                { value: 'all', label: t('admin.reports.aiStreamsSourceAll') },
                { value: 'live', label: t('admin.reports.aiStreamsSourceLive') },
                { value: 'archive', label: t('admin.reports.aiStreamsSourceArchive') },
              ]}
            />
            <Select
              allowClear
              style={{ minWidth: 180 }}
              placeholder={t('admin.reports.aiStreamsStatusFilter')}
              value={aiStreamStatus}
              onChange={(value) => setAIStreamStatus(value)}
              options={[
                'created',
                'queued',
                'started',
                'streaming',
                'completed',
                'persisted',
                'failed',
                'cancelled',
              ].map((status) => ({ value: status, label: status }))}
            />
          </Space>

          <Space wrap size="large">
            <Statistic title={t('admin.reports.aiStreamsTotalSessions')} value={aiStreamOverviewQuery.data?.totals.totalSessions || 0} />
            <Statistic title={t('admin.reports.aiStreamsRecentSessions')} value={aiStreamOverviewQuery.data?.totals.recentSessions || 0} />
            <Statistic title={t('admin.reports.aiStreamsRecentEvents')} value={aiStreamOverviewQuery.data?.totals.recentEvents || 0} />
            <Statistic title={t('admin.reports.aiStreamsActiveSessions')} value={aiStreamOverviewQuery.data?.totals.activeSessions || 0} />
            <Statistic title={t('admin.reports.aiStreamsArchivedSessions')} value={aiStreamOverviewQuery.data?.totals.archivedSessions || 0} />
            <Statistic title={t('admin.reports.aiStreamsArchivedEvents')} value={aiStreamOverviewQuery.data?.totals.archivedEvents || 0} />
          </Space>

          <Descriptions bordered size="small" column={2} title={t('admin.reports.aiStreamsRetention')}>
            <Descriptions.Item label={t('admin.reports.aiStreamsBackendMode')}>
              {aiStreamOverviewQuery.data?.retentionPolicy.backendMode || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.reports.aiStreamsArchiveEnabled')}>
              {String(aiStreamOverviewQuery.data?.retentionPolicy.archiveEnabled ?? false)}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.reports.aiStreamsSessionRetention')}>
              {aiStreamOverviewQuery.data?.retentionPolicy.sessionRetentionDays || 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.reports.aiStreamsEventRetention')}>
              {aiStreamOverviewQuery.data?.retentionPolicy.eventRetentionDays || 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.reports.aiStreamsArchiveBatchSize')}>
              {aiStreamOverviewQuery.data?.retentionPolicy.archiveBatchSize || 0}
            </Descriptions.Item>
          </Descriptions>

          <Space wrap>
            {(aiStreamOverviewQuery.data?.byStatus || []).map((item) => (
              <Tag key={`status-${item.status}`}>{`${item.status}: ${item.count}`}</Tag>
            ))}
          </Space>
          <Space wrap>
            {(aiStreamOverviewQuery.data?.byScopeType || []).map((item) => (
              <Tag key={`scope-${item.scopeType}`}>{`${item.scopeType}: ${item.count}`}</Tag>
            ))}
          </Space>
          <Space wrap>
            {(aiStreamOverviewQuery.data?.byBackendMode || []).map((item) => (
              <Tag key={`backend-${item.backendMode}`}>{`${item.backendMode}: ${item.count}`}</Tag>
            ))}
          </Space>

          <Table
            rowKey="streamId"
            size="small"
            pagination={false}
            dataSource={aiStreamSessionsQuery.data?.items || []}
            onRow={(record) => ({
              onClick: () => setSelectedStreamId(record.streamId),
            })}
            columns={[
              {
                title: t('admin.reports.aiStreamsColStream'),
                dataIndex: 'streamId',
                render: (value: string, record) => (
                  <Button type="link" onClick={() => setSelectedStreamId(record.streamId)}>
                    {value}
                  </Button>
                ),
              },
              { title: t('admin.reports.aiStreamsColScope'), render: (_, record) => `${record.scopeType}:${record.scopeId}` },
              { title: t('admin.reports.aiStreamsColStatus'), dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
              { title: t('admin.reports.aiStreamsColSource'), dataIndex: 'source' },
              { title: t('admin.reports.aiStreamsColSeq'), dataIndex: 'lastSeq' },
              { title: t('admin.reports.aiStreamsColUpdatedAt'), dataIndex: 'updatedAt', render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss') },
            ]}
          />

          <Divider style={{ margin: 0 }} />

          {selectedStreamId ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Title level={5} style={{ margin: 0 }}>
                {t('admin.reports.aiStreamsDetail')}
              </Title>
              {aiStreamDetailQuery.data ? (
                <>
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label={t('admin.reports.aiStreamsColStream')}>
                      {aiStreamDetailQuery.data.session.streamId}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.reports.aiStreamsColSource')}>
                      {aiStreamDetailQuery.data.source}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.reports.aiStreamsColScope')}>
                      {`${aiStreamDetailQuery.data.session.scopeType}:${aiStreamDetailQuery.data.session.scopeId}`}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.reports.aiStreamsColStatus')}>
                      {aiStreamDetailQuery.data.session.status}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.reports.aiStreamsColSeq')}>
                      {aiStreamDetailQuery.data.session.lastSeq}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.reports.aiStreamsBackendMode')}>
                      {aiStreamDetailQuery.data.session.backendMode || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.reports.aiStreamsMessageId')}>
                      {aiStreamDetailQuery.data.session.messageId || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.reports.aiStreamsUpdatedAt')}>
                      {dayjs(aiStreamDetailQuery.data.session.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                  </Descriptions>
                  <Card size="small" title={t('admin.reports.aiStreamsTextSnapshot')}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{aiStreamDetailQuery.data.session.text || '-'}</pre>
                  </Card>
                  <Card size="small" title={t('admin.reports.aiStreamsEvents')}>
                    <pre style={{ margin: 0, maxHeight: 360, overflow: 'auto' }}>
                      {JSON.stringify(aiStreamDetailQuery.data.events, null, 2)}
                    </pre>
                  </Card>
                </>
              ) : (
                <Text type="secondary">{t('admin.reports.aiStreamsPickStream')}</Text>
              )}
            </Space>
          ) : (
            <Text type="secondary">{t('admin.reports.aiStreamsPickStream')}</Text>
          )}
        </Space>
      </Card>
    </Space>
  );
}
