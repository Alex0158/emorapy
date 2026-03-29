import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Drawer, Input, Popconfirm, Space, Table, Typography, message } from 'antd';
import { useState } from 'react';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { adminApi } from '@/services/api/admin';
import type { AdminAppUserItem } from '@/types/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

function isUserCurrentlyLocked(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false;
  const lockedUntilTime = new Date(lockedUntil).getTime();
  if (Number.isNaN(lockedUntilTime)) return false;
  return lockedUntilTime > Date.now();
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { hasPermission: canWriteUsers } = useAdminAccess(['users:write'], true);
  const [q, setQ] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pendingActionKey, setPendingActionKey] = useState<string>('');
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', q],
    queryFn: () => adminApi.listUsers({ q, limit: 50, offset: 0 }),
  });
  const detailQuery = useQuery({
    queryKey: ['admin', 'users', 'detail', selectedUserId],
    queryFn: () => adminApi.getUserDetail(selectedUserId),
    enabled: selectedUserId.length > 0,
  });
  const hasUserDetail = detailQuery.data?.user !== null && detailQuery.data?.user !== undefined;

  const statusMutation = useMutation({
    mutationFn: (payload: {
      userId: string;
      action: 'lock' | 'unlock' | 'deactivate' | 'activate';
      lockMinutes?: number;
    }) =>
      adminApi.updateUserStatus(payload.userId, {
        action: payload.action,
        lockMinutes: payload.lockMinutes,
      }),
    onSuccess: () => {
      message.success(t('admin.users.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        message.error(t('admin.ops.accessDenied'));
        return;
      }
      message.error(t('admin.users.updateFailed'));
    },
  });

  const handleStatusAction = (
    row: AdminAppUserItem,
    action: 'lock' | 'unlock' | 'deactivate' | 'activate',
    lockMinutes?: number
  ) => {
    const actionKey = `${row.id}:${action}`;
    setPendingActionKey(actionKey);
    statusMutation.mutate(
      {
        userId: row.id,
        action,
        lockMinutes,
      },
      {
        onSettled: () => {
          setPendingActionKey('');
        },
      }
    );
  };

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <Title level={3} className="admin-page__header-title">{t('admin.users.heading')}</Title>
        <Text type="secondary" className="admin-page__header-subtitle">{t('admin.users.subtitle')}</Text>
      </div>
      {usersQuery.error && (
        <Alert
          showIcon
          type="error"
          title={t('admin.users.loadFailed')}
          action={
            <Button
              size="small"
              loading={usersQuery.isFetching}
              onClick={() => void usersQuery.refetch()}
              data-testid="admin-users-load-retry"
            >
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {!canWriteUsers && <Alert showIcon type="warning" title={t('admin.users.writeDenied')} />}
      <Card className="admin-page__table-card">
        <div className="admin-page__content">
          <Input.Search value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('admin.users.search')} />
          <Table<AdminAppUserItem>
            rowKey="id"
            loading={usersQuery.isLoading}
            dataSource={usersQuery.data?.items || []}
            columns={[
              { title: t('admin.users.email'), dataIndex: 'email' },
              { title: t('admin.users.nickname'), dataIndex: 'nickname' },
              {
                title: t('admin.users.active'),
                render: (_, row) => (row.is_active ? t('admin.users.activeYes') : t('admin.users.activeNo')),
              },
              {
                title: t('admin.users.actions'),
                render: (_, row) => {
                  const isLocked = isUserCurrentlyLocked(row.locked_until ?? null);
                  return (
                    <Space>
                      <Button size="small" onClick={() => setSelectedUserId(row.id)}>
                        {t('admin.users.detail')}
                      </Button>
                      <Popconfirm
                        title={isLocked ? t('admin.users.confirmUnlock') : t('admin.users.confirmLock30m')}
                        description={t('admin.users.auditHint')}
                        okText={t('common.confirm')}
                        cancelText={t('common.cancel')}
                        onConfirm={() =>
                          handleStatusAction(row, isLocked ? 'unlock' : 'lock', 30)
                        }
                      >
                        <Button
                          size="small"
                          disabled={!canWriteUsers}
                          loading={pendingActionKey === `${row.id}:${isLocked ? 'unlock' : 'lock'}`}
                        >
                          {isLocked ? t('admin.users.unlock') : t('admin.users.lock30m')}
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title={row.is_active ? t('admin.users.confirmDeactivate') : t('admin.users.confirmActivate')}
                        description={t('admin.users.auditHint')}
                        okText={t('common.confirm')}
                        cancelText={t('common.cancel')}
                        onConfirm={() =>
                          handleStatusAction(row, row.is_active ? 'deactivate' : 'activate')
                        }
                      >
                        <Button
                          size="small"
                          disabled={!canWriteUsers}
                          loading={pendingActionKey === `${row.id}:${row.is_active ? 'deactivate' : 'activate'}`}
                        >
                          {row.is_active ? t('admin.users.deactivate') : t('admin.users.activate')}
                        </Button>
                      </Popconfirm>
                    </Space>
                  );
                },
              },
            ]}
          />
        </div>
      </Card>
      <Drawer
        open={selectedUserId.length > 0}
        title={t('admin.users.detail')}
        size="large"
        onClose={() => setSelectedUserId('')}
      >
        {detailQuery.isLoading && <Text type="secondary">{t('common.loading')}</Text>}
        {detailQuery.error && (
          <Alert
            showIcon
            type="error"
            title={t('admin.users.detailLoadFailed')}
            action={
              <Button
                size="small"
                loading={detailQuery.isFetching}
                onClick={() => void detailQuery.refetch()}
                data-testid="admin-users-detail-retry"
              >
                {t('common.retry')}
              </Button>
            }
          />
        )}
        {!detailQuery.isLoading && !detailQuery.error && !hasUserDetail && (
          <Text type="secondary">{t('common.noData')}</Text>
        )}
        {!detailQuery.isLoading && !detailQuery.error && hasUserDetail && (
          <pre>{JSON.stringify(detailQuery.data?.user, null, 2)}</pre>
        )}
      </Drawer>
    </div>
  );
}
