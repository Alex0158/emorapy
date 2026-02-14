/**
 * 設置頁面
 */

import { useEffect, useState } from 'react';
import { Card, Form, Switch, Button, Typography, message, Spin } from 'antd';
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
   const { user, updateUser } = useAuthStore();
   const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const profile = await getProfile();
        updateUser(profile);
        form.setFieldsValue({
          notification_enabled: profile.notification_enabled ?? true,
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : t('message.getProfileFail');
        message.error(msg);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [form, updateUser]);

  const handleSubmit = async (values: { notification_enabled?: boolean }) => {
    try {
      setLoading(true);
      const updated = await updateProfile({
        notification_enabled: values.notification_enabled,
      });
      updateUser(updated);
      message.success(t('message.saveSuccess'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.saveFail');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !user) {
    return (
      <ProtectedRoute>
        <div className="profile-settings-page">
          <Spin tip={t('common.loading')} />
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
              <Button type="primary" htmlType="submit">
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
