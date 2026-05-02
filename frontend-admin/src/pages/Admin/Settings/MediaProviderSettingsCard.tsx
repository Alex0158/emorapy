import type { FormInstance } from 'antd';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import type {
  AdminMediaProviderCatalogItem,
  AdminMediaProviderTestResult,
} from '@/types/admin';
import { t } from '@/utils/i18n';
import type { MediaProviderFormValues } from './types';

const { Text } = Typography;

interface MediaProviderSettingsCardProps {
  form: FormInstance<MediaProviderFormValues>;
  catalog: AdminMediaProviderCatalogItem[];
  selectedProvider?: AdminMediaProviderCatalogItem;
  selectedProviderKey: string;
  testResult: AdminMediaProviderTestResult | null;
  saveLoading: boolean;
  testLoading: boolean;
  onProviderChange: (providerKey: string) => void;
  onSave: () => void | Promise<void>;
  onTest: () => void | Promise<void>;
  getConfigValue: (providerKey: string) => Record<string, unknown> | undefined;
}

function renderCurrentProviderState(
  provider: AdminMediaProviderCatalogItem,
  getConfigValue: (providerKey: string) => Record<string, unknown> | undefined
) {
  const isConfigured = Boolean(getConfigValue(provider.providerKey)?.apiKey);
  return (
    <Space direction="vertical" size={4}>
      <Space>
        <Tag color={provider.providerType === 'image' ? 'blue' : 'purple'}>
          {provider.providerType}
        </Tag>
        <Text>{t('admin.settings.mediaProviders.defaultModel')}</Text>
        <Text code>{provider.defaultModel || '-'}</Text>
        <Text>
          {isConfigured
            ? t('admin.settings.mediaProviders.configured')
            : t('admin.settings.mediaProviders.notConfigured')}
        </Text>
      </Space>
      <Text type="secondary">{provider.description || ''}</Text>
    </Space>
  );
}

export default function MediaProviderSettingsCard({
  form,
  catalog,
  selectedProvider,
  selectedProviderKey,
  testResult,
  saveLoading,
  testLoading,
  onProviderChange,
  onSave,
  onTest,
  getConfigValue,
}: MediaProviderSettingsCardProps) {
  return (
    <Card title={t('admin.settings.mediaProviders.title')}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Text type="secondary">{t('admin.settings.mediaProviders.subtitle')}</Text>
        <Form form={form} layout="vertical">
          <Form.Item
            name="providerKey"
            label={t('admin.settings.mediaProviders.provider')}
            rules={[
              {
                required: true,
                message: t('admin.settings.mediaProviders.selectProviderRequired'),
              },
            ]}
          >
            <Select
              placeholder={t('admin.settings.mediaProviders.selectProvider')}
              value={selectedProviderKey}
              onChange={onProviderChange}
              options={catalog.map((provider) => ({
                label: `${provider.displayName} (${provider.providerType})`,
                value: provider.providerKey,
              }))}
            />
          </Form.Item>

          {selectedProvider && (
            <>
              {renderCurrentProviderState(selectedProvider, getConfigValue)}
              <Form.Item
                name="apiKey"
                label={
                  selectedProvider.secretLabel ||
                  t('admin.settings.mediaProviders.apiKey')
                }
                extra={t('admin.settings.mediaProviders.apiKeyHelp')}
              >
                <Input.Password placeholder="sk-..." />
              </Form.Item>
              <Form.Item name="baseUrl" label={t('admin.settings.mediaProviders.baseUrl')}>
                <Input placeholder={selectedProvider.defaultBaseUrl || ''} />
              </Form.Item>
              <Form.Item
                name="timeoutMs"
                label={t('admin.settings.mediaProviders.timeoutMs')}
              >
                <InputNumber min={500} max={120000} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="model" label={t('admin.settings.mediaProviders.model')}>
                <Input placeholder={selectedProvider.defaultModel || ''} />
              </Form.Item>
              {selectedProvider.providerType === 'video' && (
                <Form.Item
                  name="sourceImageUrl"
                  label={t('admin.settings.mediaProviders.sourceImage')}
                  extra={t('admin.settings.mediaProviders.sourceImageHelp')}
                >
                  <Input placeholder="https://your-domain.example/image.jpg" />
                </Form.Item>
              )}
              {selectedProvider.providerType === 'image' ? (
                <Form.Item
                  name="count"
                  label={t('admin.settings.mediaProviders.count')}
                >
                  <InputNumber min={1} max={20} style={{ width: '100%' }} />
                </Form.Item>
              ) : (
                <Form.Item
                  name="durationSeconds"
                  label={t('admin.settings.mediaProviders.duration')}
                >
                  <InputNumber min={1} max={240} style={{ width: '100%' }} />
                </Form.Item>
              )}
              <Form.Item
                name="prompt"
                label={t('admin.settings.mediaProviders.prompt')}
                extra={t('admin.settings.mediaProviders.promptHelp')}
              >
                <Input.TextArea rows={3} />
              </Form.Item>
              <Space>
                <Button type="primary" loading={saveLoading} onClick={onSave}>
                  {t('admin.settings.mediaProviders.save')}
                </Button>
                <Button loading={testLoading} onClick={onTest}>
                  {t('admin.settings.mediaProviders.test')}
                </Button>
              </Space>
            </>
          )}
        </Form>

        {testResult && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.message}
              description={`${t('admin.settings.mediaProviders.latency')}: ${testResult.latencyMs}ms`}
              showIcon
            />
            {testResult.detail !== undefined && (
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  maxHeight: 180,
                  overflow: 'auto',
                }}
                translate="no"
              >
                {JSON.stringify(testResult.detail, null, 2)}
              </pre>
            )}
          </Space>
        )}
      </Space>
    </Card>
  );
}
