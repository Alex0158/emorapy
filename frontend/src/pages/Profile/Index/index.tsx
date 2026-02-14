/**
 * 個人資料頁面
 */

import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Upload,
  Avatar,
  Space,
  message,
  Spin,
} from 'antd';
import {
  UserOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { getProfile, updateProfile } from '@/services/api/user';
import { useAuthStore } from '@/store/authStore';
import { MAX_FILE_SIZE } from '@/utils/constants';
import { formatFileSize } from '@/utils/format';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import './Index.less';

const { Title, Text } = Typography;

const ProfileIndex = () => {
  const [form] = Form.useForm();
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅 mount 時拉取一次
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const profile = await getProfile();
      form.setFieldsValue(profile);
      updateUser(profile);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.getProfileIndexFail');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: Parameters<typeof updateProfile>[0]) => {
    setSaving(true);
    try {
      const updatedUser = await updateProfile(values);
      updateUser(updatedUser);
      message.success(t('message.profileUpdateSuccess'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.updateFail');
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-index-page">
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title={t('profileIndex.title')}
        description={t('profileIndex.description')}
      />
      <div className="profile-index-page" role="main" aria-label={t('profileIndex.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <Title level={2} id="profile-title">
            {t('profileIndex.heading')}
          </Title>
        </AnimatedWrapper>

        <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
          <Card role="article" aria-labelledby="profile-title">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              aria-label={t('profileIndex.formLabel')}
            >
            <Form.Item label={t('profileIndex.avatarLabel')}>
              <Space>
                <Avatar
                  src={user?.avatar_url}
                  icon={<UserOutlined />}
                  size={64}
                />
                <Upload
                  name="avatar"
                  listType="text"
                  showUploadList={false}
                  beforeUpload={async (file) => {
                    if (!file.type.startsWith('image/')) {
                      message.error(t('message.avatarOnlyImage'));
                      return Upload.LIST_IGNORE;
                    }
                    if (file.size > MAX_FILE_SIZE) {
                      message.error(t('message.avatarSizeLimit').replace('{size}', formatFileSize(MAX_FILE_SIZE)));
                      return Upload.LIST_IGNORE;
                    }
                    setUploading(true);
                    try {
                      const formData = new FormData();
                      formData.append('avatar', file);
                      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL.replace('/api/v1','')}/api/v1/user/avatar`, {
                        method: 'POST',
                        body: formData,
                        headers: {
                          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                        },
                      });
                      const json = await resp.json();
                      if (!resp.ok || !json.success) {
                        throw new Error(json.error?.message || t('message.avatarUploadFail'));
                      }
                      updateUser(json.data.user);
                      message.success(t('message.avatarSuccess'));
                    } catch (err: unknown) {
                      const msg = err instanceof Error ? err.message : t('message.avatarUploadFail');
                      message.error(msg);
                    } finally {
                      setUploading(false);
                    }
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />} loading={uploading}>{t('profileIndex.uploadAvatar')}</Button>
                </Upload>
                <Text type="secondary" style={{ display: 'block' }}>
                  {t('profileIndex.avatarHint')}
                </Text>
              </Space>
            </Form.Item>

            <Form.Item
              name="nickname"
              label={t('profileIndex.nicknameLabel')}
            >
              <Input placeholder={t('profileIndex.nicknamePlaceholder')} maxLength={20} />
            </Form.Item>

            <Form.Item
              name="email"
              label={t('profileIndex.emailLabel')}
            >
              <Input disabled />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                aria-label={t('profileIndex.saveAria')}
              >
                {t('profileIndex.save')}
              </Button>
            </Form.Item>
          </Form>
          </Card>
        </AnimatedWrapper>
      </div>
    </ProtectedRoute>
  );
};

export default ProfileIndex;
