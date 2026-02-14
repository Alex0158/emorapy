/**
 * 忘記密碼頁面
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  message,
  Card,
  Typography,
  Steps,
  InputNumber,
} from 'antd';
import {
  MailOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { resetPassword, confirmResetPassword } from '@/services/api/auth';
import BearJudge from '@/components/business/BearJudge';
import PublicRoute from '@/components/common/PublicRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import './ForgotPassword.less';

const { Title, Text } = Typography;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  // 發送重置密碼郵件
  const handleSendResetEmail = async (values: { email: string }) => {
    try {
      setLoading(true);
      await resetPassword(values.email);
      setEmail(values.email);
      setCountdown(300); // 5分鐘倒計時
      message.success(t('message.resetEmailSent'));
      setCurrentStep(1);

      // 倒計時
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.sendResetFail');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // 重新發送驗證碼
  const handleResendCode = () => {
    if (countdown > 0) {
      message.warning(t('message.waitCountdown').replace('{count}', String(countdown)));
      return;
    }
    handleSendResetEmail({ email });
  };

  // 驗證碼輸入處理
  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // 自動聚焦下一個輸入框
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  // 驗證驗證碼並設置新密碼
  const handleResetPassword = async (values: { password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error(t('message.passwordMismatch'));
      return;
    }

    const code = verificationCode.join('');
    if (code.length !== 6) {
      message.error(t('message.codeFull'));
      return;
    }

    try {
      setLoading(true);
      await confirmResetPassword(email, code, values.password);
      message.success(t('message.resetSuccess'));
      setCurrentStep(2);
      setTimeout(() => {
        navigate('/auth/login');
      }, 2000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.resetFail');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <PublicRoute>
      <SEO
        title={t('auth.forgot.title')}
        description={t('auth.forgot.description')}
        keywords={t('auth.forgot.keywords')}
      />
      <div className="auth-page forgot-password-page" role="main" aria-label={t('auth.forgot.pageLabel')}>
        <AnimatedWrapper animation="scale" delay={100}>
          <Card className="auth-card">
            <div className="auth-header" aria-labelledby="forgot-title">
              <BearJudge size="medium" animated />
              <Title level={2} id="forgot-title" className="auth-title">
                {t('auth.forgot.heading')}
              </Title>
              <Text type="secondary" className="auth-subtitle">
                {t('auth.forgot.subtitle')}
              </Text>
            </div>

            <Steps
              current={currentStep}
              className="reset-steps"
              items={[
                { title: t('auth.forgot.stepEmail') },
                { title: t('auth.forgot.stepVerify') },
                { title: t('auth.forgot.stepPassword') },
              ]}
              aria-label={t('auth.forgot.stepsLabel')}
            />

          {currentStep === 0 && (
            <Form
              form={form}
              name="forgot-password"
              onFinish={handleSendResetEmail}
              layout="vertical"
              size="large"
              className="auth-form"
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
                  prefix={<MailOutlined />}
                  placeholder={t('auth.forgot.emailPlaceholder')}
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading} className="auth-submit-button">
                  {t('auth.forgot.sendResetEmail')}
                </Button>
              </Form.Item>
            </Form>
          )}

          {currentStep === 1 && (
            <div className="verification-step">
              <div className="verification-info">
                <Text>{t('auth.register.codeSentTo')}</Text>
                <Text strong>{email}</Text>
              </div>

              <div className="code-input-group">
                {verificationCode.map((value, index) => (
                  <InputNumber
                    key={index}
                    id={`code-input-${index}`}
                    value={value}
                    onChange={(val) => handleCodeChange(index, val?.toString() || '')}
                    maxLength={1}
                    className="code-input"
                    controls={false}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !value && index > 0) {
                        const prevInput = document.getElementById(`code-input-${index - 1}`);
                        prevInput?.focus();
                      }
                    }}
                  />
                ))}
              </div>

              <div className="countdown-info">
                <Text type="secondary">
                  {t('auth.register.codeExpiry')} {formatCountdown(countdown)}
                </Text>
              </div>

              <Button
                type="link"
                onClick={handleResendCode}
                disabled={countdown > 0}
                className="resend-code-link"
              >
                {t('auth.register.resendCode')}
              </Button>

              <Button
                type="primary"
                block
                onClick={() => setCurrentStep(2)}
                disabled={verificationCode.join('').length !== 6}
                className="auth-submit-button"
                style={{ marginTop: 16 }}
              >
                {t('auth.register.verifyAndContinue')}
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <Form
              name="reset-password"
              onFinish={handleResetPassword}
              layout="vertical"
              size="large"
              className="auth-form"
            >
              <Form.Item
                name="password"
                label={t('auth.forgot.newPassword')}
                rules={[
                  { required: true, message: t('auth.forgot.newPasswordRequired') },
                  { min: 8, message: t('auth.register.passwordMin') },
                  {
                    pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
                    message: t('auth.register.passwordPattern'),
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('auth.forgot.newPasswordPlaceholder')}
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label={t('auth.forgot.confirmNewPassword')}
                dependencies={['password']}
                rules={[
                  { required: true, message: t('auth.forgot.confirmNewRequired') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('message.passwordMismatch')));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('auth.forgot.confirmNewPlaceholder')}
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading} className="auth-submit-button">
                  {t('auth.forgot.resetButton')}
                </Button>
              </Form.Item>
            </Form>
          )}

          {currentStep === 2 && (
            <div className="success-step">
              <CheckCircleOutlined className="success-icon" />
              <Title level={4}>{t('auth.forgot.successTitle')}</Title>
              <Text type="secondary">{t('auth.forgot.redirecting')}</Text>
            </div>
          )}

          <div className="auth-divider">
            <Text type="secondary">{t('auth.forgot.rememberPassword')}</Text>
          </div>

          <Button
            type="link"
            block
            onClick={() => navigate('/auth/login')}
            className="auth-switch-link"
          >
            {t('auth.forgot.backToLogin')}
          </Button>
        </Card>
        </AnimatedWrapper>
      </div>
    </PublicRoute>
  );
};

export default ForgotPassword;

