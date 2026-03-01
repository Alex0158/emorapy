/**
 * 設置頁面
 */

import { useEffect, useState, useRef } from 'react';
import { Card, Form, Switch, Button, Typography, message, Spin, Alert } from 'antd';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { getProfile, updateProfile } from '@/services/api/user';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/utils/i18n';
import './Settings.less';

const { Title } = Typography;

const ProfileSettings = () => {
  const [form] = Form.useForm();
  const { updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    const init = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const profile = await getProfile();
        if (staleRef.current) return;
        updateUser(profile);
        form.setFieldsValue({
          notification_enabled: profile.notification_enabled ?? true,
        });
      } catch (error: unknown) {
        if (staleRef.current) return;
        const msg = (error as { message?: string })?.message || t('message.getProfileFail');
        message.error(msg);
        setLoadError(true);
      } finally {
        if (!staleRef.current) setLoading(false);
      }
    };
    init();
    return () => { staleRef.current = true; };
  }, [form, updateUser]);

  const handleSubmit = async (values: { notification_enabled?: boolean }) => {
    setSaving(true);
    try {
      const updated = await updateProfile({
        notification_enabled: values.notification_enabled,
      });
      updateUser(updated);
      message.success(t('message.saveSuccess'));
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.saveFail');
      message.error(msg);
    } finally {
      setSaving(false);
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

  if (loadError) {
    return (
      <ProtectedRoute>
        <div className="profile-settings-page">
          <Alert
            title={t('message.getProfileFail')}
            type="error"
            showIcon
            action={<Button size="small" onClick={() => { setLoadError(false); setLoading(true); getProfile().then(p => { updateUser(p); form.setFieldsValue({ notification_enabled: p.notification_enabled ?? true }); }).catch(() => setLoadError(true)).finally(() => setLoading(false)); }}>{t('common.retry')}</Button>}
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
