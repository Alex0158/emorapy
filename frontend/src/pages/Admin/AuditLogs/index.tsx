import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, DatePicker, Input, Space, Table, Typography, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useState } from 'react';
import { adminApi } from '@/services/api/admin';
import type { AdminAuditLogItem } from '@/types/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

export default function AdminAuditLogsPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState<Dayjs | null>(null);
  const [to, setTo] = useState<Dayjs | null>(null);
  const query = useQuery({
    queryKey: ['admin', 'audit-logs', entityType, action, from?.toISOString(), to?.toISOString()],
    queryFn: () =>
      adminApi.listAuditLogs({
        entityType: entityType || undefined,
        action: action || undefined,
        from: from?.toISOString(),
        to: to?.toISOString(),
        limit: 100,
        offset: 0,
      }),
  });

  const downloadCsv = async () => {
    try {
      const blob = await adminApi.downloadAuditLogsCsv({
        entityType: entityType || undefined,
        action: action || undefined,
        from: from?.toISOString(),
        to: to?.toISOString(),
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-audit-logs-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(t('admin.audit.exportFailed'));
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <Title level={3} className="admin-page__header-title">{t('admin.audit.heading')}</Title>
        <Text type="secondary" className="admin-page__header-subtitle">{t('admin.audit.subtitle')}</Text>
      </div>
      {query.error && (
        <Alert
          showIcon
          type="error"
          title={t('admin.audit.loadFailed')}
          action={
            <Button
              size="small"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
              data-testid="admin-audit-load-retry"
            >
              {t('common.retry')}
            </Button>
          }
        />
      )}
      <div className="admin-page__content">
      <Card>
        <Space wrap>
          <Input placeholder={t('admin.audit.entityType')} value={entityType} onChange={(event) => setEntityType(event.target.value)} />
          <Input placeholder={t('admin.audit.action')} value={action} onChange={(event) => setAction(event.target.value)} />
          <DatePicker
            showTime
            value={from}
            placeholder={t('admin.audit.from')}
            onChange={(value) => setFrom(value)}
          />
          <DatePicker
            showTime
            value={to}
            placeholder={t('admin.audit.to')}
            onChange={(value) => setTo(value)}
          />
          <Button onClick={downloadCsv}>{t('admin.audit.exportCsv')}</Button>
        </Space>
      </Card>
      <Card>
        <Table<AdminAuditLogItem>
          rowKey="id"
          loading={query.isLoading}
          dataSource={query.data?.items || []}
          columns={[
            { title: t('admin.audit.createdAt'), dataIndex: 'created_at' },
            { title: t('admin.audit.actor'), dataIndex: 'actor_id' },
            { title: t('admin.audit.entityType'), dataIndex: 'entity_type' },
            { title: t('admin.audit.action'), dataIndex: 'action' },
            {
              title: t('admin.audit.detail'),
              render: (_, row) => <pre style={{ margin: 0 }}>{JSON.stringify(row.detail)}</pre>,
            },
          ]}
        />
      </Card>
      </div>
    </div>
  );
}
