/**
 * 登錄頁面
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Checkbox, message, Card, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { sendVerificationCode } from '@/services/api/auth';
import BearJudge from '@/components/business/BearJudge';
import PublicRoute from '@/components/common/PublicRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import './Login.less';

const { Title, Text } = Typography;

interface LocationState {
  from?: { pathname: string };
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  const [form] = Form.useForm();
  const [rememberMe, setRememberMe] = useState(false);

  const state = location.state as LocationState | null;
  const from = state?.from?.pathname || '/';

  const handleSubmit = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password);
      message.success(t('message.loginSuccess'));
      navigate(from, { replace: true });
    } catch (error: unknown) {
      const err = error && typeof error === 'object' ? (error as { code?: string; message?: string }) : null;
      const code = err?.code;
      const msg = err?.message ?? (error instanceof Error ? error.message : t('message.loginFail'));
      const msgStr = typeof msg === 'string' ? msg : t('message.loginFail');
      // 未完成郵箱驗證：主動提示並重發驗證碼（依後端 code 或訊息內容判斷）
      if (code === 'EMAIL_NOT_VERIFIED' || msgStr.includes('郵箱驗證')) {
        message.warning(t('message.emailNotVerified'));
        try {
          await sendVerificationCode(values.email, 'verify_email');
        } catch {
          message.error(t('message.resendVerifyFail'));
        }
      } else {
        message.error(msgStr);
      }
    }
  };

  return (
    <PublicRoute>
      <SEO
        title={t('auth.login.title')}
        description={t('auth.login.description')}
        keywords={t('auth.login.keywords')}
      />
      <div className="auth-page login-page" role="main" aria-label={t('auth.login.pageLabel')}>
        <AnimatedWrapper animation="scale" delay={100}>
          <Card className="auth-card">
            <div className="auth-header" aria-labelledby="auth-title">
              <BearJudge size="medium" animated />
              <Title level={2} id="auth-title" className="auth-title">
                {t('auth.login.welcome')}
              </Title>
              <Text type="secondary" className="auth-subtitle">
                {t('auth.login.subtitle')}
              </Text>
            </div>

            <Form
              form={form}
              name="login"
              onFinish={handleSubmit}
              autoComplete="off"
              layout="vertical"
              size="large"
              className="auth-form"
              aria-label={t('auth.login.formLabel')}
            >
            <Form.Item
              name="email"
              label={t('auth.login.email')}
              rules={[
                { required: true, message: t('auth.login.emailRequired') },
                { type: 'email', message: t('auth.login.emailInvalid') },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('auth.login.emailRequired')}
                autoComplete="email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={t('auth.login.password')}
              rules={[{ required: true, message: t('auth.login.passwordRequired') }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('auth.login.passwordRequired')}
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}>
                  {t('auth.login.rememberMe')}
                </Checkbox>
                <Button type="link" onClick={() => navigate('/auth/forgot-password')} className="forgot-password-link">
                  {t('auth.login.forgotPassword')}
                </Button>
              </Space>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={isLoading} className="auth-submit-button">
                {t('auth.login.submit')}
              </Button>
            </Form.Item>
          </Form>

          <div className="auth-divider">
            <Text type="secondary">{t('auth.login.noAccount')}</Text>
          </div>

          <Button
            type="link"
            block
            onClick={() => navigate('/auth/register')}
            className="auth-switch-link"
          >
            {t('auth.login.registerNow')}
          </Button>
        </Card>
        </AnimatedWrapper>
      </div>
    </PublicRoute>
  );
};

export default Login;
