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
      message.success('登錄成功！');
      navigate(from, { replace: true });
    } catch (error: any) {
      const msg = error?.message || '登錄失敗，請檢查郵箱和密碼';
      // 未完成郵箱驗證：主動提示並重發驗證碼
      if (msg.includes('郵箱驗證')) {
        message.warning('帳號尚未完成郵箱驗證，已為您重發驗證碼，請查收郵件後再嘗試登錄');
        try {
          await sendVerificationCode(values.email, 'verify_email');
        } catch {
          message.error('驗證郵件重發失敗，請在註冊頁重新嘗試');
        }
      } else {
        message.error(msg);
      }
    }
  };

  return (
    <PublicRoute>
      <SEO
        title="登錄 - 熊媽媽法庭"
        description="登錄您的帳號，使用完整功能"
        keywords="登錄,用戶登錄"
      />
      <div className="auth-page login-page" role="main" aria-label="登錄頁面">
        <AnimatedWrapper animation="scale" delay={100}>
          <Card className="auth-card">
            <div className="auth-header" aria-labelledby="auth-title">
              <BearJudge size="medium" animated />
              <Title level={2} id="auth-title" className="auth-title">
                歡迎回來
              </Title>
              <Text type="secondary" className="auth-subtitle">
                登錄以繼續
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
              aria-label="登錄表單"
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
                prefix={<UserOutlined />}
                placeholder="請輸入郵箱地址"
                autoComplete="email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="密碼"
              rules={[{ required: true, message: '請輸入密碼' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="請輸入密碼"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}>
                  記住我（7天免登錄）
                </Checkbox>
                <Button type="link" onClick={() => navigate('/auth/forgot-password')} className="forgot-password-link">
                  忘記密碼？
                </Button>
              </Space>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={isLoading} className="auth-submit-button">
                登錄
              </Button>
            </Form.Item>
          </Form>

          <div className="auth-divider">
            <Text type="secondary">還沒有帳號？</Text>
          </div>

          <Button
            type="link"
            block
            onClick={() => navigate('/auth/register')}
            className="auth-switch-link"
          >
            立即註冊
          </Button>
        </Card>
        </AnimatedWrapper>
      </div>
    </PublicRoute>
  );
};

export default Login;
