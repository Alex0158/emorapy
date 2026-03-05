import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import SEO from '@/components/common/SEO';
import { useAdminSession } from '@/hooks/useAdminSession';
import { useAdminToken } from '@/hooks/useAdminToken';
import { deriveAdminTokenStatus } from '@/utils/adminTokenState';
import { t } from '@/utils/i18n';

const { Title, Text } = Typography;

interface FormValues {
  email: string;
  password: string;
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const token = useAdminToken();
  const tokenState = deriveAdminTokenStatus(token);
  const { loginMutation } = useAdminSession();

  if (tokenState.tokenReady) {
    return <Navigate to="/admin/ops/jobs" replace />;
  }

  const onFinish = async (values: FormValues) => {
    try {
      await loginMutation.mutateAsync(values);
      message.success(t('admin.login.success'));
      navigate('/admin/ops/jobs', { replace: true });
    } catch {
      message.error(t('admin.login.failed'));
    }
  };

  return (
    <>
      <SEO title={t('admin.login.title')} description={t('admin.login.subtitle')} />
      <div style={{ maxWidth: 520, margin: '40px auto 0' }}>
        <Card>
          <Title level={2}>{t('admin.login.heading')}</Title>
          <Text type="secondary">{t('admin.login.subtitle')}</Text>
          {tokenState.tokenFormatInvalid && (
            <Alert
              style={{ marginTop: 16 }}
              showIcon
              type="warning"
              title={t('admin.login.invalidHint')}
            />
          )}
          <Form<FormValues>
            layout="vertical"
            style={{ marginTop: 16 }}
            onFinish={onFinish}
          >
            <Form.Item
              label={t('admin.login.email')}
              name="email"
              rules={[
                { required: true, message: t('admin.login.emailRequired') },
                { type: 'email', message: t('admin.login.emailInvalid') },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label={t('admin.login.password')}
              name="password"
              rules={[{ required: true, message: t('admin.login.passwordRequired') }]}
            >
              <Input.Password />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loginMutation.isPending}
              block
            >
              {t('admin.login.submit')}
            </Button>
          </Form>
        </Card>
      </div>
    </>
  );
}
