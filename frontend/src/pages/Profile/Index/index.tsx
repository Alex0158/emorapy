/**
 * 個人資料頁面
 */

import { useState, useEffect, useRef } from 'react';
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
  Tag,
  Progress,
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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const navigate = useNavigate();
  const { profile: psychProfile, fetchProfile: fetchPsychProfile, giveConsent, consentLoading } = usePsychProfileStore();
  const { startSession, checkResume } = useInterviewStore();

  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    fetchProfile();
    fetchPsychProfile();
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅 mount 時拉取一次
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const profile = await getProfile();
      if (staleRef.current) return;
      form.setFieldsValue(profile);
      updateUser(profile);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const err = error as { message?: string };
      message.error(err?.message || t('message.getProfileIndexFail'));
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleSubmit = async (values: Parameters<typeof updateProfile>[0]) => {
    setSaving(true);
    try {
      const updatedUser = await updateProfile(values);
      updateUser(updatedUser);
      message.success(t('message.profileUpdateSuccess'));
    } catch (error: unknown) {
      const err = error as { message?: string };
      message.error(err?.message || t('message.updateFail'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-index-page">
        <Spin size="large" description={t('common.loading')} />
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
                          Authorization: `Bearer ${(() => { try { return localStorage.getItem('token') || window.sessionStorage.getItem('token') || ''; } catch { return ''; } })()}`,
                        },
                      });
                      const json = await resp.json().catch(() => null);
                      if (!resp.ok || !json?.success) {
                        throw new Error(json?.error?.message || t('message.avatarUploadFail'));
                      }
                      updateUser(json.data?.user);
                      message.success(t('message.avatarSuccess'));
                    } catch (err: unknown) {
                      const msg = (err as { message?: string })?.message || t('message.avatarUploadFail');
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

        {/* 我的故事卡片 — v2.0 心理畫像 */}
        <AnimatedWrapper animation="slide" direction="up" delay={300} trigger="intersection">
          <Card
            title={t('psychProfile.myStory')}
            extra={
              psychProfile?.consent_given ? (
                <Button
                  type="link"
                  onClick={async () => {
                    try {
                      const resumeData = await checkResume();
                      if (resumeData.has_pending && resumeData.session_id) {
                        navigate(`/interview/${resumeData.session_id}`);
                        return;
                      }
                      const session = await startSession('organic');
                      navigate(`/interview/${session.id}`);
                    } catch {
                      message.error(t('interview.startFail'));
                    }
                  }}
                >
                  {t('psychProfile.continueChat')}
                </Button>
              ) : null
            }
            style={{ marginTop: 24 }}
          >
            {!psychProfile?.consent_given ? (
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <Paragraph>{t('psychProfile.intro')}</Paragraph>
                <Button type="primary" onClick={() => setConsentOpen(true)}>
                  {t('psychProfile.chatForFive')}
                </Button>
              </Space>
            ) : (
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <RichnessRing score={psychProfile.richness_score || 0} size={80} />
                  <div style={{ flex: 1 }}>
                    <Text strong>{t('psychProfile.exploredDomains')}</Text>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {psychProfile.narratives?.filter(n => n.is_latest && n.completeness > 0).map(n => (
                        <Tag key={n.domain} color="blue">
                          {getDomainLabel(n.domain as PsychDomain)}
                        </Tag>
                      ))}
                      {(!psychProfile.narratives || psychProfile.narratives.filter(n => n.is_latest && n.completeness > 0).length === 0) && (
                        <Text type="secondary">{t('psychProfile.noExplored')}</Text>
                      )}
                    </div>
                  </div>
                </div>
                {psychProfile.insights && psychProfile.insights.filter(i => i.is_active).length > 0 && (
                  <div>
                    <Text type="secondary">{t('psychProfile.keyInsights')}</Text>
                    <div style={{ marginTop: 8 }}>
                      {psychProfile.insights.filter(i => i.is_active).slice(0, 5).map(i => (
                        <div key={i.id} style={{ marginBottom: 4 }}>
                          <Text>{i.key}：{i.value}</Text>
                          <Progress
                            percent={Math.round(i.confidence * 100)}
                            size="small"
                            showInfo={false}
                            style={{ width: 80, display: 'inline-block', marginLeft: 8 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button
                  type="link"
                  onClick={() => navigate('/profile/my-story')}
                  style={{ padding: 0 }}
                >
                  {t('psychProfile.manageMyData')}
                </Button>
              </Space>
            )}
          </Card>
        </AnimatedWrapper>

        <ConsentModal
          open={consentOpen}
          onConsent={async () => {
            try {
              await giveConsent();
              setConsentOpen(false);
              const resumeData = await checkResume();
              if (resumeData.has_pending && resumeData.session_id) {
                navigate(`/interview/${resumeData.session_id}`);
                return;
              }
              const session = await startSession('onboarding');
              navigate(`/interview/${session.id}`);
            } catch {
              message.error(t('interview.startFail'));
            }
          }}
          onCancel={() => setConsentOpen(false)}
          loading={consentLoading}
        />
      </div>
    </ProtectedRoute>
  );
};

export default ProfileIndex;
