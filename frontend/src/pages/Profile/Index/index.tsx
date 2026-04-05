/**
 * 個人資料頁面
 */

import { useState, useEffect, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import {
  Alert,
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
  Tag,
  Progress,
} from 'antd';
import {
  UserOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { getProfile, updateProfile, uploadAvatar } from '@/services/api/user';
import { useAuthStore } from '@/store/authStore';
import { MAX_FILE_SIZE } from '@/utils/constants';
import { formatFileSize } from '@/utils/format';
import { getErrorMessage } from '@/utils/apiError';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import RichnessRing from '@/components/business/Interview/RichnessRing';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import { usePsychProfileStore } from '@/store/psychProfileStore';
import { useInterviewStore } from '@/store/interviewStore';
import { useNavigate } from 'react-router-dom';
import { getDomainLabel } from '@/types/interview';
import type { PsychDomain } from '@/types/interview';
import { t } from '@/utils/i18n';
import './Index.less';

const { Title, Text, Paragraph } = Typography;

const ProfileIndex = () => {
  const [form] = Form.useForm();
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const navigate = useNavigate();
  const { profile: psychProfile, fetchProfile: fetchPsychProfile, giveConsent, consentLoading } = usePsychProfileStore();
  const { startSession, checkResume } = useInterviewStore();

  const mountedRef = useMountedRef();
  const staleRef = useRef(false);
  const fetchLockRef = useRef(false);
  const continueLockRef = useRef(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    fetchProfile();
    fetchPsychProfile();
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅 mount 時拉取一次
  }, []);

  const fetchProfile = async () => {
    if (fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getProfile();
      if (staleRef.current) return;
      form.setFieldsValue(profile);
      updateUser(profile);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = getErrorMessage(error, 'message.getProfileIndexFail');
      message.error(msg);
      setLoadError(msg);
    } finally {
      fetchLockRef.current = false;
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleSubmit = async (values: Parameters<typeof updateProfile>[0]) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSaving(true);
    try {
      const updatedUser = await updateProfile(values);
      if (!mountedRef.current) return;
      updateUser(updatedUser);
      message.success(t('message.profileUpdateSuccess'));
    } catch (error: unknown) {
      if (mountedRef.current) {
        message.error(getErrorMessage(error, 'message.updateFail'));
      }
    } finally {
      submitLockRef.current = false;
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <SEO
          title={t('profileIndex.title')}
          description={t('profileIndex.description')}
        />
        <div
          className="profile-index-page profile-index-page--loading"
          role="status"
          aria-busy="true"
          aria-live="polite"
          aria-label={t('common.loading')}
        >
          <Spin size="large" description={t('common.loading')} />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title={t('profileIndex.title')}
        description={t('profileIndex.description')}
      />
      <div className="profile-index-page" role="main" aria-label={t('profileIndex.pageLabel')}>
        <div className="profile-index-page__hero">
          <AnimatedWrapper animation="fade" delay={100}>
            <Title level={2} id="profile-title" className="font-heading font-bold m-0 text-3xl">
              {t('profileIndex.heading')}
            </Title>
          </AnimatedWrapper>
        </div>

        <div className="profile-index-page__container">
          {loadError ? (
            <Alert
              type="error"
              showIcon
              title={loadError}
              action={
                <Space>
                  <Button size="small" loading={loading} onClick={() => fetchProfile()} data-testid="profile-index-load-retry">
                    {t('common.retry')}
                  </Button>
                  <Button size="small" onClick={() => navigate(-1)}>
                    {t('common.back')}
                  </Button>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card role="article" aria-labelledby="profile-title" className="glassmorphism-2 border-none shadow-sm rounded-3xl mb-8">
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                aria-label={t('profileIndex.formLabel')}
                className="pt-4"
              >
              <Form.Item label={t('profileIndex.avatarLabel')}>
                <Space size="large">
                  <Avatar
                    src={user?.avatar_url}
                    icon={<UserOutlined />}
                    size={80}
                    className="shadow-sm"
                  />
                  <div>
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
                          const updatedUser = await uploadAvatar(formData);
                          if (!mountedRef.current) return;
                          updateUser(updatedUser);
                          message.success(t('message.avatarSuccess'));
                        } catch (err: unknown) {
                          if (mountedRef.current) {
                            message.error(getErrorMessage(err, 'message.avatarUploadFail'));
                          }
                        } finally {
                          if (mountedRef.current) {
                            setUploading(false);
                          }
                        }
                        return false;
                      }}
                    >
                      <Button icon={<UploadOutlined />} loading={uploading} shape="round">{t('profileIndex.uploadAvatar')}</Button>
                    </Upload>
                    <Text type="secondary" className="block mt-2 text-sm">
                      {t('profileIndex.avatarHint')}
                    </Text>
                  </div>
                </Space>
              </Form.Item>

              <Form.Item
                name="nickname"
                label={t('profileIndex.nicknameLabel')}
              >
                <Input placeholder={t('profileIndex.nicknamePlaceholder')} maxLength={20} size="large" className="rounded-xl" />
              </Form.Item>

              <Form.Item
                name="email"
                label={t('profileIndex.emailLabel')}
              >
                <Input disabled size="large" className="rounded-xl bg-gray-50" />
              </Form.Item>

              <Form.Item className="mb-0 mt-8 text-center">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                  size="large"
                  shape="round"
                  className="px-8 shadow-md hover:shadow-lg"
                  aria-label={t('profileIndex.saveAria')}
                >
                  {t('profileIndex.save')}
                </Button>
              </Form.Item>
            </Form>
            </Card>
          </AnimatedWrapper>

          {/* 我的故事卡片 — v2.0 心理畫像 */}
          <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
            <Card
              title={<span className="font-heading text-xl">{t('psychProfile.myStory')}</span>}
              className="glassmorphism-2 border-none shadow-sm rounded-3xl"
              extra={
                psychProfile?.consent_given ? (
                  <Button
                    type="link"
                    className="font-semibold"
                    onClick={async () => {
                      if (continueLockRef.current) return;
                      continueLockRef.current = true;
                      try {
                        const resumeData = await checkResume();
                        if (!mountedRef.current) return;
                        if (resumeData.has_pending && resumeData.session_id) {
                          navigate(`/interview/${resumeData.session_id}`);
                          return;
                        }
                        const session = await startSession('organic');
                        if (!mountedRef.current) return;
                        navigate(`/interview/${session.id}`);
                      } catch (error: unknown) {
                        if (mountedRef.current) {
                          message.error(getErrorMessage(error, 'interview.startFail'));
                        }
                      } finally {
                        continueLockRef.current = false;
                      }
                    }}
                  >
                    {t('psychProfile.continueChat')}
                  </Button>
                ) : null
              }
            >
              {!psychProfile?.consent_given ? (
                <div className="text-center py-8">
                  <Paragraph className="text-lg text-gray-600 mb-6">{t('psychProfile.intro')}</Paragraph>
                  <Button type="primary" size="large" shape="round" onClick={() => setConsentOpen(true)} className="shadow-md hover:shadow-lg">
                    {t('psychProfile.chatForFive')}
                  </Button>
                </div>
              ) : (
                <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                  <div className="flex items-center gap-6 bg-white/50 p-6 rounded-2xl">
                    <RichnessRing score={psychProfile.richness_score || 0} size={100} />
                    <div className="flex-1">
                      <Text strong className="text-lg block mb-3">{t('psychProfile.exploredDomains')}</Text>
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(psychProfile.narratives) ? psychProfile.narratives.filter(n => n.is_latest && n.completeness > 0) : []).map(n => (
                          <Tag key={n.domain} color="blue" className="rounded-full px-3 py-1 text-sm border-blue-200 bg-blue-50 text-blue-600">
                            {getDomainLabel(n.domain as PsychDomain)}
                          </Tag>
                        ))}
                        {(!Array.isArray(psychProfile.narratives) || psychProfile.narratives.filter(n => n.is_latest && n.completeness > 0).length === 0) && (
                          <Text type="secondary">{t('psychProfile.noExplored')}</Text>
                        )}
                      </div>
                    </div>
                  </div>
                  {Array.isArray(psychProfile.insights) && psychProfile.insights.filter(i => i.is_active).length > 0 && (
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                      <Text type="secondary" className="block mb-4 font-semibold">{t('psychProfile.keyInsights')}</Text>
                      <div className="space-y-3">
                        {psychProfile.insights.filter(i => i.is_active).slice(0, 5).map(i => (
                          <div key={i.id} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm">
                            <Text className="text-gray-700"><span className="font-semibold text-gray-900">{i.key}</span>：{i.value}</Text>
                            <Progress
                              percent={Math.round(i.confidence * 100)}
                              size="small"
                              showInfo={false}
                              className="profile-index-progress w-20 m-0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-center pt-2">
                    <Button
                      type="link"
                      onClick={() => navigate('/profile/my-story')}
                      className="font-semibold text-gray-500 hover:text-primary"
                    >
                      {t('psychProfile.manageMyData')}
                    </Button>
                  </div>
                </Space>
              )}
            </Card>
          </AnimatedWrapper>

          <ConsentModal
            open={consentOpen}
            onConsent={async () => {
              try {
                await giveConsent();
                if (!mountedRef.current) return;
                setConsentOpen(false);
                const resumeData = await checkResume();
                if (!mountedRef.current) return;
                if (resumeData.has_pending && resumeData.session_id) {
                  navigate(`/interview/${resumeData.session_id}`);
                  return;
                }
                const session = await startSession('onboarding');
                if (!mountedRef.current) return;
                navigate(`/interview/${session.id}`);
              } catch (error: unknown) {
                if (mountedRef.current) {
                  message.error(getErrorMessage(error, 'interview.startFail'));
                }
              }
            }}
            onCancel={() => setConsentOpen(false)}
            loading={consentLoading}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ProfileIndex;
