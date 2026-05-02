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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminMe } from '@/hooks/useAdminMe';
import { adminApi } from '@/services/api/admin';
import type {
  AdminAdminUserItem,
  AdminMediaProviderCatalogItem,
  AdminMediaProviderTestInput,
  AdminMediaProviderTestResult,
} from '@/types/admin';
import { t } from '@/utils/i18n';
import JsonConfigCard from './JsonConfigCard';
import MediaProviderSettingsCard from './MediaProviderSettingsCard';
import type { AdminUserFormValues, MediaProviderFormValues } from './types';

const { Title, Text } = Typography;

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [editingAdmin, setEditingAdmin] = useState<AdminAdminUserItem | null>(null);
  const [pendingAdminActionKey, setPendingAdminActionKey] = useState('');
  const [adminEditForm] = Form.useForm();
  const [alertRulesForm] = Form.useForm<{ rules: string }>();
  const [featureFlagsForm] = Form.useForm<{ flags: string }>();
  const [mediaProviderForm] = Form.useForm<MediaProviderFormValues>();
  const [selectedMediaProviderKey, setSelectedMediaProviderKey] = useState('');
  const [mediaProviderTestResult, setMediaProviderTestResult] =
    useState<AdminMediaProviderTestResult | null>(null);

  const adminUsersQuery = useQuery({
    queryKey: ['admin', 'admin-users'],
    queryFn: () => adminApi.listAdminUsers({ limit: 100, offset: 0 }),
  });
  const configsQuery = useQuery({
    queryKey: ['admin', 'configs', 'settings'],
    queryFn: () => adminApi.listConfigs({ limit: 100, offset: 0 }),
  });
  const mediaProvidersQuery = useQuery({
    queryKey: ['admin', 'media-providers'],
    queryFn: () => adminApi.listMediaProviders(),
  });
  const adminMeQuery = useAdminMe(true);
  const currentAdminId = adminMeQuery.data?.admin.id || '';

  const mediaProviderCatalog: AdminMediaProviderCatalogItem[] =
    mediaProvidersQuery.data?.items || [];
  const selectedMediaProvider = useMemo(
    () => mediaProviderCatalog.find((provider) => provider.providerKey === selectedMediaProviderKey),
    [mediaProviderCatalog, selectedMediaProviderKey]
  );

  useEffect(() => {
    if (!selectedMediaProviderKey && mediaProviderCatalog.length > 0) {
      setSelectedMediaProviderKey(mediaProviderCatalog[0].providerKey);
      return;
    }
    if (selectedMediaProviderKey && !mediaProviderCatalog.some((provider) => provider.providerKey === selectedMediaProviderKey)) {
      setSelectedMediaProviderKey(mediaProviderCatalog[0]?.providerKey || '');
    }
  }, [mediaProviderCatalog, selectedMediaProviderKey]);

  const mediaConfigItems = useMemo(
    () => configsQuery.data?.items || [],
    [configsQuery.data]
  );

  const getMediaProviderConfigValue = useCallback((providerKey: string): Record<string, unknown> | undefined => {
    const configItem = mediaConfigItems.find((item) => item.key === `media.provider.${providerKey}`);
    if (!configItem || typeof configItem.value !== 'object' || configItem.value === null || Array.isArray(configItem.value)) {
      return undefined;
    }
    return configItem.value as Record<string, unknown>;
  }, [mediaConfigItems]);

  useEffect(() => {
    if (!selectedMediaProvider || !selectedMediaProvider.providerType) return;
    const providerConfig = getMediaProviderConfigValue(selectedMediaProvider.providerKey) || {};
    mediaProviderForm.setFieldsValue({
      providerKey: selectedMediaProvider.providerKey,
      apiKey: '',
      baseUrl:
        (typeof providerConfig.baseUrl === 'string' && providerConfig.baseUrl)
        || (typeof providerConfig.base_url === 'string' && providerConfig.base_url)
        || selectedMediaProvider.defaultBaseUrl
        || undefined,
      timeoutMs:
        typeof providerConfig.timeoutMs === 'number'
          ? providerConfig.timeoutMs
          : typeof providerConfig.timeout_ms === 'number'
            ? providerConfig.timeout_ms
            : 12000,
      model:
        typeof providerConfig.model === 'string' && providerConfig.model
          ? providerConfig.model
          : selectedMediaProvider.defaultModel,
      sourceImageUrl:
        typeof providerConfig.sourceImageUrl === 'string'
          ? providerConfig.sourceImageUrl
          : '',
      count:
        selectedMediaProvider.providerType === 'image'
          ? typeof providerConfig.count === 'number' && providerConfig.count > 0
            ? providerConfig.count
            : 1
          : undefined,
      durationSeconds:
        selectedMediaProvider.providerType === 'video'
          ? typeof providerConfig.durationSeconds === 'number' && providerConfig.durationSeconds > 0
            ? providerConfig.durationSeconds
            : 5
          : undefined,
      prompt:
        selectedMediaProvider.providerType === 'image'
          ? 'A calm neutral composition'
          : 'A cinematic short clip',
    });
  }, [selectedMediaProvider, mediaProviderForm, getMediaProviderConfigValue]);

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

  const mediaProviderSaveMutation = useMutation({
    mutationFn: ({
      providerKey,
      value,
    }: {
      providerKey: string;
      value: Record<string, unknown>;
    }) => adminApi.upsertConfig({
      key: `media.provider.${providerKey}`,
      value,
      isRuntime: true,
      isSensitive: true,
    }),
    onSuccess: () => {
      message.success(t('admin.settings.mediaProviders.saveSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'configs', 'settings'] });
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      if (err?.code === 'FORBIDDEN') {
        message.error(t('admin.ops.accessDenied'));
        return;
      }
      message.error(t('admin.settings.mediaProviders.saveFailed'));
    },
  });

  const mediaProviderTestMutation = useMutation({
    mutationFn: ({
      providerKey,
      payload,
    }: {
      providerKey: string;
      payload: AdminMediaProviderTestInput;
    }) => adminApi.testMediaProvider(providerKey, payload),
    onSuccess: (result) => {
      setMediaProviderTestResult(result);
      message.success(t('admin.settings.mediaProviders.testSuccess'));
    },
    onError: (error: unknown) => {
      const err = error as { code?: string } | null;
      setMediaProviderTestResult(null);
      if (err?.code === 'FORBIDDEN') {
        message.error(t('admin.ops.accessDenied'));
        return;
      }
      message.error(t('admin.settings.mediaProviders.testFailed'));
    },
  });

  const handleSaveMediaProvider = async () => {
    if (!selectedMediaProvider) return;
    const values = await mediaProviderForm.validateFields();
    const currentConfig = getMediaProviderConfigValue(selectedMediaProvider.providerKey) || {};
    const updatedConfig: Record<string, unknown> = { ...currentConfig };
    if (typeof values.apiKey === 'string' && values.apiKey.trim()) {
      updatedConfig.apiKey = values.apiKey.trim();
    }
    if (typeof values.baseUrl === 'string' && values.baseUrl.trim()) {
      updatedConfig.baseUrl = values.baseUrl.trim();
    }
    if (typeof values.timeoutMs === 'number' && Number.isFinite(values.timeoutMs)) {
      updatedConfig.timeoutMs = values.timeoutMs;
    }
    if (typeof values.model === 'string' && values.model.trim()) {
      updatedConfig.model = values.model.trim();
    }
    if (
      selectedMediaProvider.providerType === 'video'
      && typeof values.sourceImageUrl === 'string'
      && values.sourceImageUrl.trim()
    ) {
      updatedConfig.sourceImageUrl = values.sourceImageUrl.trim();
    }
    if (!updatedConfig.apiKey && !currentConfig.apiKey) {
      message.error(t('admin.settings.mediaProviders.apiKeyRequired'));
      return;
    }

    mediaProviderSaveMutation.mutate({
      providerKey: selectedMediaProvider.providerKey,
      value: updatedConfig,
    });
  };

  const handleTestMediaProvider = async () => {
    if (!selectedMediaProvider) return;
    const values = await mediaProviderForm.validateFields();
    const payload: AdminMediaProviderTestInput = {
      apiKey:
        typeof values.apiKey === 'string' && values.apiKey.trim()
          ? values.apiKey.trim()
          : undefined,
      baseUrl:
        typeof values.baseUrl === 'string' && values.baseUrl.trim()
          ? values.baseUrl.trim()
          : undefined,
      timeoutMs:
        typeof values.timeoutMs === 'number' && Number.isFinite(values.timeoutMs)
          ? values.timeoutMs
          : undefined,
      model:
        typeof values.model === 'string' && values.model.trim()
          ? values.model.trim()
          : undefined,
      prompt:
        typeof values.prompt === 'string' && values.prompt.trim()
          ? values.prompt.trim()
          : undefined,
    };

    if (selectedMediaProvider.providerType === 'image') {
      if (typeof values.count === 'number' && Number.isFinite(values.count)) {
        payload.count = Math.max(1, Math.floor(values.count));
      }
    } else if (selectedMediaProvider.providerType === 'video') {
      if (typeof values.durationSeconds === 'number' && Number.isFinite(values.durationSeconds)) {
        payload.durationSeconds = Math.max(1, Math.floor(values.durationSeconds));
      }
      if (typeof values.sourceImageUrl === 'string' && values.sourceImageUrl.trim()) {
        payload.sourceImageUrl = values.sourceImageUrl.trim();
      }
    }

    mediaProviderTestMutation.mutate({
      providerKey: selectedMediaProvider.providerKey,
      payload,
    });
  };

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

      <MediaProviderSettingsCard
        form={mediaProviderForm}
        catalog={mediaProviderCatalog}
        selectedProvider={selectedMediaProvider}
        selectedProviderKey={selectedMediaProviderKey}
        testResult={mediaProviderTestResult}
        saveLoading={mediaProviderSaveMutation.isPending}
        testLoading={mediaProviderTestMutation.isPending}
        onProviderChange={(value) => {
          setSelectedMediaProviderKey(value);
          setMediaProviderTestResult(null);
        }}
        onSave={handleSaveMediaProvider}
        onTest={handleTestMediaProvider}
        getConfigValue={getMediaProviderConfigValue}
      />

      <Card title={t('admin.settings.adminUsers.title')}>
        <Form<AdminUserFormValues>
          layout="inline"
          onFinish={(values) => createAdminUserMutation.mutate(values)}
        >
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
              {
                min: 10,
                message: t('admin.settings.adminUsers.passwordMinLength'),
              },
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
          <Button
            type="primary"
            htmlType="submit"
            loading={createAdminUserMutation.isPending}
          >
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
            {
              title: t('admin.settings.adminUsers.role'),
              render: (_, row) => row.role.key,
            },
            {
              title: t('admin.settings.adminUsers.active'),
              render: (_, row) => (
                <Space>
                  <Popconfirm
                    title={
                      row.is_active
                        ? t('admin.settings.adminUsers.confirmDeactivate')
                        : t('admin.settings.adminUsers.confirmActivate')
                    }
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
                    <Switch
                      checked={row.is_active}
                      loading={pendingAdminActionKey === `${row.id}:toggle`}
                    />
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
                      deleteAdminUserMutation.mutate(row.id, {
                        onSettled: () => setPendingAdminActionKey(''),
                      });
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

      <JsonConfigCard
        title={t('admin.settings.alerts.title')}
        subtitle={t('admin.settings.alerts.subtitle')}
        form={alertRulesForm}
        fieldName="rules"
        requiredMessage={t('admin.settings.alerts.rulesJsonArrayRequired')}
        placeholder='[{"key":"jobs.failure_rate","threshold":0.2}]'
        loading={alertRulesMutation.isPending}
        valueKind="array"
        saveLabel={t('admin.settings.alerts.save')}
        onSave={(value) => alertRulesMutation.mutate(value as unknown[])}
      />

      <JsonConfigCard
        title={t('admin.settings.flags.title')}
        subtitle={t('admin.settings.flags.subtitle')}
        form={featureFlagsForm}
        fieldName="flags"
        requiredMessage={t('admin.settings.flags.flagsJsonObjectRequired')}
        placeholder='{"adminOpsBeta": true}'
        loading={featureFlagsMutation.isPending}
        valueKind="object"
        saveLabel={t('admin.settings.flags.save')}
        onSave={(value) => featureFlagsMutation.mutate(value as Record<string, unknown>)}
      />
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
          <Form.Item
            name="name"
            label={t('admin.settings.adminUsers.nameLabel')}
            rules={[
              {
                required: true,
                message: t('admin.settings.adminUsers.nameRequired'),
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="roleKey"
            label={t('admin.settings.adminUsers.roleLabel')}
            rules={[
              {
                required: true,
                message: t('admin.settings.adminUsers.roleRequired'),
              },
            ]}
          >
            <Select
              options={[
                { label: 'super_admin', value: 'super_admin' },
                { label: 'ops', value: 'ops' },
                { label: 'marketing', value: 'marketing' },
                { label: 'support', value: 'support' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="isActive"
            label={t('admin.settings.adminUsers.activeLabel')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('admin.settings.adminUsers.resetPasswordLabel')}
            rules={[
              {
                validator: async (_, value: string | undefined) => {
                  if (!value || value.trim().length === 0) return;
                  if (value.length < 10) {
                    throw new Error(t('admin.settings.adminUsers.passwordMinLength'));
                  }
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
