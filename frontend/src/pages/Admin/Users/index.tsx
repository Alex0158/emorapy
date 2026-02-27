import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Drawer, Input, Popconfirm, Space, Table, Typography, message } from 'antd';
import { useState } from 'react';
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
  const [q, setQ] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', q],
    queryFn: () => adminApi.listUsers({ q, limit: 50, offset: 0 }),
  });
  const detailQuery = useQuery({
    queryKey: ['admin', 'users', 'detail', selectedUserId],
    queryFn: () => adminApi.getUserDetail(selectedUserId),
    enabled: selectedUserId.length > 0,
  });

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
    onError: () => {
      message.error(t('admin.users.updateFailed'));
    },
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          {t('admin.users.heading')}
        </Title>
        <Text type="secondary">{t('admin.users.subtitle')}</Text>
      </div>
      {usersQuery.error && <Alert showIcon type="error" title={t('admin.users.loadFailed')} />}
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
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
                render: (_, row) => (row.is_active ? 'Y' : 'N'),
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
                        title={isLocked ? '確認解除鎖定？' : '確認鎖定 30 分鐘？'}
                        description="此操作會寫入審計日誌。"
                        okText="確認"
                        cancelText="取消"
                        onConfirm={() =>
                          statusMutation.mutate({
                            userId: row.id,
                            action: isLocked ? 'unlock' : 'lock',
                            lockMinutes: 30,
                          })
                        }
                      >
                        <Button size="small" loading={statusMutation.isPending}>
                          {isLocked ? '解除鎖定' : '鎖定30分鐘'}
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title={row.is_active ? '確認停用此用戶？' : '確認啟用此用戶？'}
                        description="此操作會寫入審計日誌。"
                        okText="確認"
                        cancelText="取消"
                        onConfirm={() =>
                          statusMutation.mutate({
                            userId: row.id,
                            action: row.is_active ? 'deactivate' : 'activate',
                          })
                        }
                      >
                        <Button size="small" loading={statusMutation.isPending}>
                          {row.is_active ? t('admin.users.deactivate') : t('admin.users.activate')}
                        </Button>
                      </Popconfirm>
                    </Space>
                  );
                },
              },
            ]}
          />
        </Space>
      </Card>
      <Drawer
        open={selectedUserId.length > 0}
        title={t('admin.users.detail')}
        width={640}
        onClose={() => setSelectedUserId('')}
      >
        <pre>{JSON.stringify(detailQuery.data?.user || {}, null, 2)}</pre>
      </Drawer>
    </Space>
  );
}
