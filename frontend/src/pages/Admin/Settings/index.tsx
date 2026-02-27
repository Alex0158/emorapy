import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';
import { useAdminMe } from '@/hooks/useAdminMe';
import { adminApi } from '@/services/api/admin';
import type { AdminAdminUserItem } from '@/types/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

interface AdminUserFormValues {
  email: string;
  password: string;
  name: string;
  roleKey: 'super_admin' | 'ops' | 'marketing' | 'support';
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [editingAdmin, setEditingAdmin] = useState<AdminAdminUserItem | null>(null);
  const [adminEditForm] = Form.useForm();
  const [alertRulesForm] = Form.useForm<{ rules: string }>();
  const [featureFlagsForm] = Form.useForm<{ flags: string }>();

  const adminUsersQuery = useQuery({
    queryKey: ['admin', 'admin-users'],
    queryFn: () => adminApi.listAdminUsers({ limit: 100, offset: 0 }),
  });
  const configsQuery = useQuery({
    queryKey: ['admin', 'configs', 'settings'],
    queryFn: () => adminApi.listConfigs({ limit: 200, offset: 0 }),
  });
  const adminMeQuery = useAdminMe(true);
  const currentAdminId = adminMeQuery.data?.admin.id || '';

  useEffect(() => {
    const items = configsQuery.data?.items || [];
    const alertRuleConfig = items.find((item) => item.key === 'admin.alert.rules');
    const featureFlagsConfig = items.find((item) => item.key === 'feature.flags');
    alertRulesForm.setFieldsValue({
      rules: JSON.stringify(alertRuleConfig?.value || [], null, 2),
    });
    featureFlagsForm.setFieldsValue({
      flags: JSON.stringify(featureFlagsConfig?.value || {}, null, 2),
    });
  }, [configsQuery.data, alertRulesForm, featureFlagsForm]);

  const createAdminUserMutation = useMutation({
    mutationFn: (values: AdminUserFormValues) => adminApi.createAdminUser(values),
    onSuccess: () => {
      message.success(t('admin.settings.adminUsers.createSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'admin-users'] });
    },
    onError: () => {
      message.error(t('admin.settings.adminUsers.createFailed'));
    },
  });

  const updateAdminUserMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      name?: string;
      roleKey?: 'super_admin' | 'ops' | 'marketing' | 'support';
      isActive?: boolean;
      password?: string;
    }) =>
      adminApi.updateAdminUser(payload.id, {
        name: payload.name,
        roleKey: payload.roleKey,
        isActive: payload.isActive,
        password: payload.password,
      }),
    onSuccess: () => {
      message.success(t('admin.settings.adminUsers.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'admin-users'] });
      setEditingAdmin(null);
    },
    onError: () => {
      message.error(t('admin.settings.adminUsers.updateFailed'));
    },
  });
  const deleteAdminUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteAdminUser(id),
    onSuccess: () => {
      message.success('管理員已刪除');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'admin-users'] });
    },
    onError: () => message.error('刪除管理員失敗'),
  });

  const alertRulesMutation = useMutation({
    mutationFn: (rules: unknown[]) => adminApi.upsertAlertRules(rules),
    onSuccess: () => message.success(t('admin.settings.alerts.saveSuccess')),
    onError: () => message.error(t('admin.settings.alerts.saveFailed')),
  });
  const featureFlagsMutation = useMutation({
    mutationFn: (flags: Record<string, unknown>) => adminApi.setFeatureFlags(flags),
    onSuccess: () => message.success(t('admin.settings.flags.saveSuccess')),
    onError: () => message.error(t('admin.settings.flags.saveFailed')),
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          {t('admin.settings.heading')}
        </Title>
        <Text type="secondary">{t('admin.settings.subtitle')}</Text>
      </div>

      {(adminUsersQuery.error || configsQuery.error) && (
        <Alert showIcon type="error" title={t('admin.settings.loadFailed')} />
      )}

      <Card title={t('admin.settings.adminUsers.title')}>
        <Form<AdminUserFormValues> layout="inline" onFinish={(values) => createAdminUserMutation.mutate(values)}>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '請輸入 Email' },
              { type: 'email', message: 'Email 格式不正確' },
            ]}
          >
            <Input placeholder={t('admin.settings.adminUsers.email')} />
          </Form.Item>
          <Form.Item name="name" rules={[{ required: true }]}>
            <Input placeholder={t('admin.settings.adminUsers.name')} />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '請輸入密碼' },
              { min: 10, message: '密碼至少 10 碼' },
            ]}
          >
            <Input.Password placeholder={t('admin.settings.adminUsers.password')} />
          </Form.Item>
          <Form.Item name="roleKey" initialValue="ops" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'super_admin', value: 'super_admin' },
                { label: 'ops', value: 'ops' },
                { label: 'marketing', value: 'marketing' },
                { label: 'support', value: 'support' },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createAdminUserMutation.isPending}>
            {t('admin.settings.adminUsers.create')}
          </Button>
        </Form>

        <Table<AdminAdminUserItem>
          style={{ marginTop: 16 }}
          rowKey="id"
          loading={adminUsersQuery.isLoading}
          dataSource={adminUsersQuery.data?.items || []}
          columns={[
            { title: t('admin.settings.adminUsers.email'), dataIndex: 'email' },
            { title: t('admin.settings.adminUsers.name'), dataIndex: 'name' },
            { title: t('admin.settings.adminUsers.role'), render: (_, row) => row.role.key },
            {
              title: t('admin.settings.adminUsers.active'),
              render: (_, row) => (
                <Space>
                  <Popconfirm
                    title={row.is_active ? '確認停用此管理員？' : '確認啟用此管理員？'}
                    okText="確認"
                    cancelText="取消"
                    onConfirm={() => updateAdminUserMutation.mutate({ id: row.id, isActive: !row.is_active })}
                  >
                    <Switch checked={row.is_active} />
                  </Popconfirm>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingAdmin(row);
                      adminEditForm.setFieldsValue({
                        name: row.name,
                        roleKey: row.role.key,
                        isActive: row.is_active,
                        password: '',
                      });
                    }}
                  >
                    編輯
                  </Button>
                  <Popconfirm
                    title="確認刪除此管理員？"
                    description="此操作為軟刪除，且會寫入審計日誌。"
                    okText="確認"
                    cancelText="取消"
                    onConfirm={() => deleteAdminUserMutation.mutate(row.id)}
                    disabled={row.id === currentAdminId}
                  >
                    <Button
                      size="small"
                      danger
                      loading={deleteAdminUserMutation.isPending}
                      disabled={row.id === currentAdminId}
                    >
                      刪除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card title={t('admin.settings.alerts.title')}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">{t('admin.settings.alerts.subtitle')}</Text>
          <Form form={alertRulesForm} layout="vertical">
            <Form.Item name="rules" rules={[{ required: true, message: '請輸入合法 JSON 陣列' }]}>
              <Input.TextArea rows={8} placeholder='[{"key":"jobs.failure_rate","threshold":0.2}]' />
            </Form.Item>
            <Button
              loading={alertRulesMutation.isPending}
              onClick={async () => {
                const values = await alertRulesForm.validateFields();
                try {
                  const parsed = JSON.parse(values.rules);
                  if (!Array.isArray(parsed)) throw new Error('not-array');
                  alertRulesMutation.mutate(parsed);
                } catch {
                  message.error('告警規則必須為 JSON 陣列');
                }
              }}
            >
              {t('admin.settings.alerts.save')}
            </Button>
          </Form>
        </Space>
      </Card>

      <Card title={t('admin.settings.flags.title')}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">{t('admin.settings.flags.subtitle')}</Text>
          <Form form={featureFlagsForm} layout="vertical">
            <Form.Item name="flags" rules={[{ required: true, message: '請輸入合法 JSON Object' }]}>
              <Input.TextArea rows={8} placeholder='{"adminOpsBeta": true}' />
            </Form.Item>
            <Button
              loading={featureFlagsMutation.isPending}
              onClick={async () => {
                const values = await featureFlagsForm.validateFields();
                try {
                  const parsed = JSON.parse(values.flags);
                  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('not-object');
                  }
                  featureFlagsMutation.mutate(parsed as Record<string, unknown>);
                } catch {
                  message.error('Feature Flags 必須為 JSON Object');
                }
              }}
            >
              {t('admin.settings.flags.save')}
            </Button>
          </Form>
        </Space>
      </Card>
      <Modal
        title="編輯管理員"
        open={editingAdmin !== null}
        onCancel={() => setEditingAdmin(null)}
        onOk={async () => {
          if (!editingAdmin) return;
          const values = await adminEditForm.validateFields();
          updateAdminUserMutation.mutate({
            id: editingAdmin.id,
            name: values.name,
            roleKey: values.roleKey,
            isActive: values.isActive,
            password: values.password?.trim() ? values.password : undefined,
          });
        }}
        confirmLoading={updateAdminUserMutation.isPending}
      >
        <Form form={adminEditForm} layout="vertical">
          <Form.Item name="name" label="名稱" rules={[{ required: true, message: '請輸入名稱' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roleKey" label="角色" rules={[{ required: true, message: '請選擇角色' }]}>
            <Select
              options={[
                { label: 'super_admin', value: 'super_admin' },
                { label: 'ops', value: 'ops' },
                { label: 'marketing', value: 'marketing' },
                { label: 'support', value: 'support' },
              ]}
            />
          </Form.Item>
          <Form.Item name="isActive" label="啟用狀態" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="password"
            label="重設密碼（可選，至少10碼）"
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (!value || value.trim().length === 0) return;
                  if (value.length < 10) throw new Error('密碼至少 10 碼');
                },
              },
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
