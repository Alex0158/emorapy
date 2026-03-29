/**
 * 設置頁面
 */

import { useEffect, useState, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Switch, Button, Typography, message, Spin, Alert, Space } from 'antd';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { getProfile, updateProfile } from '@/services/api/user';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import './Settings.less';

const { Title } = Typography;

const ProfileSettings = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mountedRef = useMountedRef();
  const staleRef = useRef(false);
  const saveLockRef = useRef(false);
  const retryLockRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    const init = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const profile = await getProfile();
        if (staleRef.current) return;
        updateUser(profile);
        form.setFieldsValue({
          notification_enabled: profile.notification_enabled ?? true,
        });
      } catch (error: unknown) {
        if (staleRef.current) return;
        const msg = getErrorMessage(error, 'message.getProfileFail');
        message.error(msg);
        setLoadError(msg);
      } finally {
        if (!staleRef.current) setLoading(false);
      }
    };
    init();
    return () => { staleRef.current = true; };
  }, [form, updateUser]);

  const handleSubmit = async (values: { notification_enabled?: boolean }) => {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    try {
      const updated = await updateProfile({
        notification_enabled: values.notification_enabled,
      });
      if (!mountedRef.current) return;
      updateUser(updated);
      message.success(t('message.saveSuccess'));
    } catch (error: unknown) {
      if (mountedRef.current) message.error(getErrorMessage(error, 'message.saveFail'));
    } finally {
      saveLockRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="profile-settings-page">
          <Spin description={t('common.loading')} />
        </div>
      </ProtectedRoute>
    );
  }

  const handleRetry = () => {
    if (retryLockRef.current) return;
    retryLockRef.current = true;
    setLoadError(null);
    setLoading(true);
    getProfile()
      .then((p) => {
        if (staleRef.current) return;
        updateUser(p);
        form.setFieldsValue({ notification_enabled: p.notification_enabled ?? true });
      })
      .catch((error: unknown) => {
        if (staleRef.current) return;
        const msg = getErrorMessage(error, 'message.getProfileFail');
        message.error(msg);
        setLoadError(msg);
      })
      .finally(() => {
        retryLockRef.current = false;
        if (!staleRef.current) setLoading(false);
      });
  };

  if (loadError) {
    return (
      <ProtectedRoute>
        <div className="profile-settings-page">
          <Alert
            title={loadError}
            type="error"
            showIcon
            action={
              <Space>
                <Button size="small" onClick={handleRetry}>{t('common.retry')}</Button>
                <Button size="small" type="primary" onClick={() => navigate('/profile/index')}>
                  {t('settings.goToProfile')}
                </Button>
              </Space>
            }
          />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title={t('settings.title')}
        description={t('settings.description')}
      />
      <div className="profile-settings-page" role="main" aria-label={t('settings.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <Title level={2} id="settings-title">{t('settings.heading')}</Title>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
          <Card title={t('settings.notification')} role="article" aria-labelledby="settings-title">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              notification_enabled: true,
            }}
          >
            <Form.Item
              name="notification_enabled"
              label={t('settings.enableNotification')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                {t('settings.save')}
              </Button>
            </Form.Item>
          </Form>
          </Card>
        </AnimatedWrapper>
      </div>
    </ProtectedRoute>
  );
};

export default ProfileSettings;
