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
  const [pendingAdminActionKey, setPendingAdminActionKey] = useState('');
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
  const roleOptions: Array<{ label: string; value: AdminUserFormValues['roleKey'] }> = [
    { label: t('admin.settings.role.super_admin'), value: 'super_admin' },
    { label: t('admin.settings.role.ops'), value: 'ops' },
    { label: t('admin.settings.role.marketing'), value: 'marketing' },
    { label: t('admin.settings.role.support'), value: 'support' },
  ];

  const getRoleLabel = (roleKey?: string) => {
    if (!roleKey) return t('common.na');
    const translated = t(`admin.settings.role.${roleKey}`);
    return translated === `admin.settings.role.${roleKey}` ? roleKey : translated;
  };

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
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        message.error(t('admin.ops.accessDenied'));
        return;
      }
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
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        message.error(t('admin.ops.accessDenied'));
        return;
      }
      message.error(t('admin.settings.adminUsers.updateFailed'));
    },
  });
  const deleteAdminUserMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteAdminUser(id),
    onSuccess: () => {
      message.success(t('admin.settings.adminUsers.deleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'admin-users'] });
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        message.error(t('admin.ops.accessDenied'));
        return;
      }
      message.error(t('admin.settings.adminUsers.deleteFailed'));
    },
  });

  const alertRulesMutation = useMutation({
    mutationFn: (rules: unknown[]) => adminApi.upsertAlertRules(rules),
    onSuccess: () => message.success(t('admin.settings.alerts.saveSuccess')),
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        message.error(t('admin.ops.accessDenied'));
        return;
      }
      message.error(t('admin.settings.alerts.saveFailed'));
    },
  });
  const featureFlagsMutation = useMutation({
    mutationFn: (flags: Record<string, unknown>) => adminApi.setFeatureFlags(flags),
    onSuccess: () => message.success(t('admin.settings.flags.saveSuccess')),
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        message.error(t('admin.ops.accessDenied'));
        return;
      }
      message.error(t('admin.settings.flags.saveFailed'));
    },
  });

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
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
              { required: true, message: t('admin.settings.adminUsers.emailRequired') },
              { type: 'email', message: t('admin.settings.adminUsers.emailInvalid') },
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
              { required: true, message: t('admin.settings.adminUsers.passwordRequired') },
              { min: 10, message: t('admin.settings.adminUsers.passwordMinLength') },
            ]}
          >
            <Input.Password placeholder={t('admin.settings.adminUsers.password')} />
          </Form.Item>
          <Form.Item name="roleKey" initialValue="ops" rules={[{ required: true }]}>
            <Select options={roleOptions} />
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
            { title: t('admin.settings.adminUsers.role'), render: (_, row) => getRoleLabel(row.role.key) },
            {
              title: t('admin.settings.adminUsers.active'),
              render: (_, row) => (
                <Space>
                  <Popconfirm
                    title={row.is_active ? t('admin.settings.adminUsers.confirmDeactivate') : t('admin.settings.adminUsers.confirmActivate')}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    onConfirm={() => {
                      setPendingAdminActionKey(`${row.id}:toggle`);
                      updateAdminUserMutation.mutate(
                        { id: row.id, isActive: !row.is_active },
                        { onSettled: () => setPendingAdminActionKey('') }
                      );
                    }}
                  >
                    <Switch checked={row.is_active} loading={pendingAdminActionKey === `${row.id}:toggle`} />
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
                    {t('admin.settings.adminUsers.edit')}
                  </Button>
                  <Popconfirm
                    title={t('admin.settings.adminUsers.confirmDelete')}
                    description={t('admin.settings.adminUsers.deleteAuditHint')}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    onConfirm={() => {
                      setPendingAdminActionKey(`${row.id}:delete`);
                      deleteAdminUserMutation.mutate(row.id, { onSettled: () => setPendingAdminActionKey('') });
                    }}
                    disabled={row.id === currentAdminId}
                  >
                    <Button
                      size="small"
                      danger
                      loading={pendingAdminActionKey === `${row.id}:delete`}
                      disabled={row.id === currentAdminId}
                    >
                      {t('admin.settings.adminUsers.delete')}
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card title={t('admin.settings.alerts.title')}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Text type="secondary">{t('admin.settings.alerts.subtitle')}</Text>
          <Form form={alertRulesForm} layout="vertical">
            <Form.Item name="rules" rules={[{ required: true, message: t('admin.settings.alerts.rulesJsonArrayRequired') }]}>
              <Input.TextArea rows={8} placeholder={t('admin.settings.alerts.rulesPlaceholder')} />
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
                  message.error(t('admin.settings.alerts.rulesJsonArrayRequired'));
                }
              }}
            >
              {t('admin.settings.alerts.save')}
            </Button>
          </Form>
        </Space>
      </Card>

      <Card title={t('admin.settings.flags.title')}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Text type="secondary">{t('admin.settings.flags.subtitle')}</Text>
          <Form form={featureFlagsForm} layout="vertical">
            <Form.Item name="flags" rules={[{ required: true, message: t('admin.settings.flags.flagsJsonObjectRequired') }]}>
              <Input.TextArea rows={8} placeholder={t('admin.settings.flags.placeholder')} />
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
                  message.error(t('admin.settings.flags.flagsJsonObjectRequired'));
                }
              }}
            >
              {t('admin.settings.flags.save')}
            </Button>
          </Form>
        </Space>
      </Card>
      <Modal
        title={t('admin.settings.adminUsers.editTitle')}
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
          <Form.Item name="name" label={t('admin.settings.adminUsers.nameLabel')} rules={[{ required: true, message: t('admin.settings.adminUsers.nameRequired') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roleKey" label={t('admin.settings.adminUsers.roleLabel')} rules={[{ required: true, message: t('admin.settings.adminUsers.roleRequired') }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="isActive" label={t('admin.settings.adminUsers.activeLabel')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('admin.settings.adminUsers.resetPasswordLabel')}
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (!value || value.trim().length === 0) return;
                  if (value.length < 10) throw new Error(t('admin.settings.adminUsers.passwordMinLength'));
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
