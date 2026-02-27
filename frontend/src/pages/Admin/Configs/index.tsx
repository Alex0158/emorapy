import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Space, Switch, Table, Typography, message } from 'antd';
import { adminApi } from '@/services/api/admin';
import type { AdminConfigItem } from '@/types/admin';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

interface ConfigFormValues {
  key: string;
  value: string;
  description?: string;
  isRuntime?: boolean;
  isSensitive?: boolean;
}

export default function AdminConfigsPage() {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    queryKey: ['admin', 'configs'],
    queryFn: () => adminApi.listConfigs({ limit: 200, offset: 0 }),
  });
  const runtimeQuery = useQuery({
    queryKey: ['admin', 'runtime', 'interview'],
    queryFn: adminApi.getInterviewRuntimeConfig,
  });
  const upsertMutation = useMutation({
    mutationFn: (values: ConfigFormValues) =>
      adminApi.upsertConfig({
        key: values.key,
        value: JSON.parse(values.value),
        description: values.description,
        isRuntime: values.isRuntime,
        isSensitive: values.isSensitive,
      }),
    onSuccess: () => {
      message.success(t('admin.configs.saveSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'runtime', 'interview'] });
    },
    onError: () => {
      message.error(t('admin.configs.saveFailed'));
    },
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          {t('admin.configs.heading')}
        </Title>
        <Text type="secondary">{t('admin.configs.subtitle')}</Text>
      </div>
      {(listQuery.error || runtimeQuery.error) && <Alert showIcon type="error" title={t('admin.configs.loadFailed')} />}
      <Card title={t('admin.configs.runtime')}>
        <pre style={{ margin: 0 }}>{JSON.stringify(runtimeQuery.data?.runtime || {}, null, 2)}</pre>
      </Card>
      <Card title={t('admin.configs.upsert')}>
        <Form<ConfigFormValues> layout="vertical" onFinish={(values) => upsertMutation.mutate(values)}>
          <Form.Item label={t('admin.configs.key')} name="key" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label={t('admin.configs.valueJson')}
            name="value"
            rules={[{ required: true, message: t('admin.configs.valueRequired') }]}
            initialValue="{}"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label={t('admin.configs.description')} name="description">
            <Input />
          </Form.Item>
          <Space>
            <Form.Item label={t('admin.configs.isRuntime')} name="isRuntime" valuePropName="checked" initialValue>
              <Switch />
            </Form.Item>
            <Form.Item label={t('admin.configs.isSensitive')} name="isSensitive" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Button type="primary" htmlType="submit" loading={upsertMutation.isPending}>
            {t('admin.configs.save')}
          </Button>
        </Form>
      </Card>
      <Card title={t('admin.configs.list')}>
        <Table<AdminConfigItem>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={listQuery.data?.items || []}
          columns={[
            { title: t('admin.configs.key'), dataIndex: 'key' },
            {
              title: t('admin.configs.value'),
              render: (_, row) => <pre style={{ margin: 0 }}>{JSON.stringify(row.value)}</pre>,
            },
            { title: t('admin.configs.updatedAt'), dataIndex: 'updated_at' },
          ]}
        />
      </Card>
    </Space>
  );
}
