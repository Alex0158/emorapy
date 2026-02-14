/**
 * 註冊頁面
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
  Space,
  InputNumber,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { sendVerificationCode, verifyEmail } from '@/services/api/auth';
import BearJudge from '@/components/business/BearJudge';
import PublicRoute from '@/components/common/PublicRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import './Register.less';

const { Title, Text } = Typography;

const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);

  // 發送驗證碼
  const handleSendCode = async () => {
    const emailValue = form.getFieldValue('email');
    if (!emailValue) {
      message.error(t('message.emailFirst'));
      return;
    }

    try {
      await sendVerificationCode(emailValue, 'register');
      setEmail(emailValue);
      setCountdown(300); // 5分鐘倒計時
      message.success(t('message.codeSent'));
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
      const msg = error instanceof Error ? error.message : t('message.sendCodeFail');
      message.error(msg);
    }
  };

  // 重新發送驗證碼
  const handleResendCode = () => {
    if (countdown > 0) {
      message.warning(t('message.waitCountdown').replace('{count}', String(countdown)));
      return;
    }
    handleSendCode();
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

  // 驗證驗證碼
  const handleVerifyCode = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
      message.error(t('message.codeFull'));
      return;
    }

    try {
      const verified = await verifyEmail(email, code, 'register');
      if (verified) {
        message.success(t('message.verifySuccess'));
        setCurrentStep(2);
      } else {
        message.error(t('message.codeError'));
        setVerificationCode(['', '', '', '', '', '']);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.verifyFail');
      message.error(msg);
    }
  };

  // 提交註冊
  const handleSubmit = async (values: { password: string; confirmPassword: string; nickname?: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error(t('message.passwordMismatch'));
      return;
    }

    try {
      await register(email, values.password, values.nickname);
      message.success(t('message.registerSuccess'));
      setCurrentStep(3);
      setTimeout(() => {
        navigate('/profile/pairing');
      }, 3000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.registerFail');
      message.error(msg);
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
        title={t('auth.register.title')}
        description={t('auth.register.description')}
        keywords={t('auth.register.keywords')}
      />
      <div className="auth-page register-page" role="main" aria-label={t('auth.register.pageLabel')}>
        <AnimatedWrapper animation="scale" delay={100}>
          <Card className="auth-card">
          <div className="auth-header">
            <BearJudge size="medium" animated />
            <Title level={2} className="auth-title">
              {t('auth.register.welcome')}
            </Title>
            <Text type="secondary" className="auth-subtitle">
              {t('auth.register.subtitle')}
            </Text>
          </div>

          <Steps
            current={currentStep}
            className="register-steps"
            items={[
              { title: t('auth.register.stepEmail') },
              { title: t('auth.register.stepVerify') },
              { title: t('auth.register.stepPassword') },
              { title: t('auth.register.stepDone') },
            ]}
          />

          {currentStep === 0 && (
            <Form
              form={form}
              name="register-email"
              onFinish={handleSendCode}
              layout="vertical"
              size="large"
              className="auth-form"
            >
              <Form.Item
                name="email"
                label={t('auth.register.email')}
                rules={[
                  { required: true, message: t('auth.register.emailRequired') },
                  { type: 'email', message: t('auth.register.emailInvalid') },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder={t('auth.register.emailPlaceholder')}
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item name="nickname" label={t('auth.register.nickname')}>
                <Input
                  prefix={<UserOutlined />}
                  placeholder={t('auth.register.nicknamePlaceholder')}
                  maxLength={20}
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={isLoading} className="auth-submit-button">
                  {t('auth.register.sendCode')}
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
                onClick={handleVerifyCode}
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
              name="register-password"
              onFinish={handleSubmit}
              layout="vertical"
              size="large"
              className="auth-form"
            >
              <Form.Item
                name="password"
                label={t('auth.register.setPassword')}
                rules={[
                  { required: true, message: t('auth.login.passwordRequired') },
                  { min: 8, message: t('auth.register.passwordMin') },
                  {
                    pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
                    message: t('auth.register.passwordPattern'),
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('auth.register.passwordPlaceholder')}
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label={t('auth.register.confirmPassword')}
                dependencies={['password']}
                rules={[
                  { required: true, message: t('auth.register.confirmRequired') },
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
                  placeholder={t('auth.register.confirmPlaceholder')}
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={isLoading} className="auth-submit-button">
                  {t('auth.register.finishRegister')}
                </Button>
              </Form.Item>
            </Form>
          )}

          {currentStep === 3 && (
            <div className="success-step">
              <CheckCircleOutlined className="success-icon" />
              <Title level={3}>{t('auth.register.successTitle')}</Title>
              <Text type="secondary">{t('auth.register.welcomeText')}</Text>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {t('auth.register.readyToUse')}
              </Text>
              <Space style={{ marginTop: 24 }}>
                <Button type="primary" onClick={() => navigate('/profile/pairing')}>
                  {t('auth.register.startPairing')}
                </Button>
                <Button onClick={() => navigate('/')}>{t('register.action.later')}</Button>
              </Space>
            </div>
          )}

          <div className="auth-divider">
            <Text type="secondary">{t('auth.register.hasAccount')}</Text>
          </div>

          <Button
            type="link"
            block
            onClick={() => navigate('/auth/login')}
            className="auth-switch-link"
          >
            {t('auth.register.loginNow')}
          </Button>
        </Card>
        </AnimatedWrapper>
      </div>
    </PublicRoute>
  );
};

export default Register;
