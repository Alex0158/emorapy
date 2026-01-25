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
      message.success('重置密碼郵件已發送到您的郵箱，請查收');
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
    } catch (error: any) {
      message.error(error.message || '發送重置郵件失敗');
    } finally {
      setLoading(false);
    }
  };

  // 重新發送驗證碼
  const handleResendCode = () => {
    if (countdown > 0) {
      message.warning(`請等待 ${countdown} 秒後再試`);
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
      message.error('兩次輸入的密碼不一致');
      return;
    }

    const code = verificationCode.join('');
    if (code.length !== 6) {
      message.error('請輸入完整的6位驗證碼');
      return;
    }

    try {
      setLoading(true);
      await confirmResetPassword(email, code, values.password);
      message.success('密碼重置成功！');
      setCurrentStep(2);
      setTimeout(() => {
        navigate('/auth/login');
      }, 2000);
    } catch (error: any) {
      message.error(error.message || '重置密碼失敗');
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
        title="忘記密碼 - 熊媽媽法庭"
        description="重置您的帳號密碼"
        keywords="忘記密碼,重置密碼"
      />
      <div className="auth-page forgot-password-page" role="main" aria-label="忘記密碼頁面">
        <AnimatedWrapper animation="scale" delay={100}>
          <Card className="auth-card">
            <div className="auth-header" aria-labelledby="forgot-title">
              <BearJudge size="medium" animated />
              <Title level={2} id="forgot-title" className="auth-title">
                忘記密碼
              </Title>
              <Text type="secondary" className="auth-subtitle">
                重置您的帳號密碼
              </Text>
            </div>

            <Steps
              current={currentStep}
              className="reset-steps"
              items={[
                { title: '輸入郵箱' },
                { title: '驗證碼驗證' },
                { title: '設置新密碼' },
              ]}
              aria-label="重置密碼步驟"
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
                label="郵箱地址"
                rules={[
                  { required: true, message: '請輸入郵箱地址' },
                  { type: 'email', message: '請輸入有效的郵箱地址' },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="請輸入註冊時使用的郵箱地址"
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading} className="auth-submit-button">
                  發送重置郵件
                </Button>
              </Form.Item>
            </Form>
          )}

          {currentStep === 1 && (
            <div className="verification-step">
              <div className="verification-info">
                <Text>驗證碼已發送到：</Text>
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
                  驗證碼有效期：5分鐘，還剩 {formatCountdown(countdown)}
                </Text>
              </div>

              <Button
                type="link"
                onClick={handleResendCode}
                disabled={countdown > 0}
                className="resend-code-link"
              >
                沒有收到？重新發送
              </Button>

              <Button
                type="primary"
                block
                onClick={() => setCurrentStep(2)}
                disabled={verificationCode.join('').length !== 6}
                className="auth-submit-button"
                style={{ marginTop: 16 }}
              >
                驗證並繼續
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
                label="新密碼"
                rules={[
                  { required: true, message: '請輸入新密碼' },
                  { min: 8, message: '密碼至少8位' },
                  {
                    pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
                    message: '密碼必須包含字母和數字',
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="請輸入新密碼（至少8位，包含字母和數字）"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="確認新密碼"
                dependencies={['password']}
                rules={[
                  { required: true, message: '請再次輸入新密碼' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('兩次輸入的密碼不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="請再次輸入新密碼"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading} className="auth-submit-button">
                  重置密碼
                </Button>
              </Form.Item>
            </Form>
          )}

          {currentStep === 2 && (
            <div className="success-step">
              <CheckCircleOutlined className="success-icon" />
              <Title level={4}>密碼重置成功！</Title>
              <Text type="secondary">正在跳轉到登錄頁面...</Text>
            </div>
          )}

          <div className="auth-divider">
            <Text type="secondary">記起密碼了？</Text>
          </div>

          <Button
            type="link"
            block
            onClick={() => navigate('/auth/login')}
            className="auth-switch-link"
          >
            返回登錄
          </Button>
        </Card>
        </AnimatedWrapper>
      </div>
    </PublicRoute>
  );
};

export default ForgotPassword;

