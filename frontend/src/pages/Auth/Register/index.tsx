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
      message.error('請先輸入郵箱地址');
      return;
    }

    try {
      await sendVerificationCode(emailValue, 'register');
      setEmail(emailValue);
      setCountdown(300); // 5分鐘倒計時
      message.success('驗證碼已發送到您的郵箱，請查收');
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
      message.error(error.message || '發送驗證碼失敗');
    }
  };

  // 重新發送驗證碼
  const handleResendCode = () => {
    if (countdown > 0) {
      message.warning(`請等待 ${countdown} 秒後再試`);
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
      message.error('請輸入完整的6位驗證碼');
      return;
    }

    try {
      const verified = await verifyEmail(email, code, 'register');
      if (verified) {
        message.success('驗證成功！');
        setCurrentStep(2);
      } else {
        message.error('驗證碼錯誤，請重新輸入');
        setVerificationCode(['', '', '', '', '', '']);
      }
    } catch (error: any) {
      message.error(error.message || '驗證失敗');
    }
  };

  // 提交註冊
  const handleSubmit = async (values: { password: string; confirmPassword: string; nickname?: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error('兩次輸入的密碼不一致');
      return;
    }

    try {
      await register(email, values.password, values.nickname);
      message.success('註冊成功！');
      setCurrentStep(3);
      setTimeout(() => {
        navigate('/profile/pairing');
      }, 3000);
    } catch (error: any) {
      message.error(error.message || '註冊失敗');
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
        title="註冊 - 熊媽媽法庭"
        description="加入熊媽媽法庭，開始你的溫暖之旅"
        keywords="註冊,用戶註冊"
      />
      <div className="auth-page register-page" role="main" aria-label="註冊頁面">
        <AnimatedWrapper animation="scale" delay={100}>
          <Card className="auth-card">
          <div className="auth-header">
            <BearJudge size="medium" animated />
            <Title level={2} className="auth-title">
              加入熊媽媽法庭
            </Title>
            <Text type="secondary" className="auth-subtitle">
              開始你的溫暖之旅
            </Text>
          </div>

          <Steps
            current={currentStep}
            className="register-steps"
            items={[
              { title: '填寫郵箱' },
              { title: '驗證碼驗證' },
              { title: '設置密碼' },
              { title: '完成註冊' },
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
                label="郵箱地址"
                rules={[
                  { required: true, message: '請輸入郵箱地址' },
                  { type: 'email', message: '請輸入有效的郵箱地址' },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="請輸入郵箱地址"
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item name="nickname" label="暱稱（可選）">
                <Input
                  prefix={<UserOutlined />}
                  placeholder="請輸入暱稱（2-20字符）"
                  maxLength={20}
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={isLoading} className="auth-submit-button">
                  發送驗證碼
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
                onClick={handleVerifyCode}
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
              name="register-password"
              onFinish={handleSubmit}
              layout="vertical"
              size="large"
              className="auth-form"
            >
              <Form.Item
                name="password"
                label="設置密碼"
                rules={[
                  { required: true, message: '請輸入密碼' },
                  { min: 8, message: '密碼至少8位' },
                  {
                    pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
                    message: '密碼必須包含字母和數字',
                  },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="請輸入密碼（至少8位，包含字母和數字）"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="確認密碼"
                dependencies={['password']}
                rules={[
                  { required: true, message: '請再次輸入密碼' },
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
                  placeholder="請再次輸入密碼"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={isLoading} className="auth-submit-button">
                  完成註冊
                </Button>
              </Form.Item>
            </Form>
          )}

          {currentStep === 3 && (
            <div className="success-step">
              <CheckCircleOutlined className="success-icon" />
              <Title level={3}>註冊成功！</Title>
              <Text type="secondary">歡迎加入熊媽媽法庭</Text>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                現在你可以使用完整功能了
              </Text>
              <Space style={{ marginTop: 24 }}>
                <Button type="primary" onClick={() => navigate('/profile/pairing')}>
                  開始配對
                </Button>
                <Button onClick={() => navigate('/')}>稍後再說</Button>
              </Space>
            </div>
          )}

          <div className="auth-divider">
            <Text type="secondary">已有帳號？</Text>
          </div>

          <Button
            type="link"
            block
            onClick={() => navigate('/auth/login')}
            className="auth-switch-link"
          >
            立即登錄
          </Button>
        </Card>
        </AnimatedWrapper>
      </div>
    </PublicRoute>
  );
};

export default Register;
