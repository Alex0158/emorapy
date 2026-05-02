import type { FormInstance } from 'antd';
import { Button, Card, Form, Input, Space, Typography, message } from 'antd';
import { t } from '@/utils/i18n';

const { Text } = Typography;

type JsonValueKind = 'array' | 'object';

interface JsonConfigCardProps {
  title: string;
  subtitle: string;
  form: FormInstance;
  fieldName: string;
  requiredMessage: string;
  placeholder: string;
  loading: boolean;
  valueKind: JsonValueKind;
  saveLabel: string;
  onSave: (value: unknown) => void;
}

function parseJsonByKind(raw: string, kind: JsonValueKind): unknown {
  const parsed = JSON.parse(raw);
  if (kind === 'array') {
    if (!Array.isArray(parsed)) throw new Error('not-array');
    return parsed;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('not-object');
  }
  return parsed;
}

export default function JsonConfigCard({
  title,
  subtitle,
  form,
  fieldName,
  requiredMessage,
  placeholder,
  loading,
  valueKind,
  saveLabel,
  onSave,
}: JsonConfigCardProps) {
  const handleSave = async () => {
    const values = await form.validateFields();
    const raw = String((values as Record<string, unknown>)[fieldName] ?? '');
    try {
      onSave(parseJsonByKind(raw, valueKind));
    } catch {
      message.error(requiredMessage);
    }
  };

  return (
    <Card title={title}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Text type="secondary">{subtitle}</Text>
        <Form form={form} layout="vertical">
          <Form.Item
            name={fieldName}
            rules={[
              {
                required: true,
                message: requiredMessage,
              },
            ]}
          >
            <Input.TextArea rows={8} placeholder={placeholder} />
          </Form.Item>
          <Button loading={loading} onClick={handleSave}>
            {saveLabel || t('common.save')}
          </Button>
        </Form>
      </Space>
    </Card>
  );
}
