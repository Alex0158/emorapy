/**
 * 配對管理頁面
 */

import { useState, useEffect, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import {
  Card,
  Button,
  Typography,
  Space,
  Input,
  Alert,
  message,
  Spin,
  Form,
  InputNumber,
  Select,
  Divider,
} from 'antd';
import {
  CopyOutlined,
  CheckCircleOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { createPairing, joinPairing, getPairingStatus, cancelPairing } from '@/services/api/pairing';
import type { Pairing } from '@/services/api/pairing';
import {
  getRelationshipProfile,
  upsertRelationshipProfile,
  type RelationshipProfile,
  type RelationshipProfileInput,
} from '@/services/api/profile';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import ConfirmModal from '@/components/common/ConfirmModal';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import { usePsychProfileStore } from '@/store/psychProfileStore';
import { useInterviewStore } from '@/store/interviewStore';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { useNavigate } from 'react-router-dom';
import './Pairing.less';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface RelationshipFormValues {
  relationship_stage?: string;
  relationship_duration_days?: number | null;
  communication_frequency?: string;
  preferred_communication_methods?: string[];
  relationship_strengths?: string;
  relationship_challenges?: string;
  completion_percentage?: number | null;
}

const toOptionalTrimmed = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toOptionalStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .map((item) => toOptionalTrimmed(item))
    .filter((item): item is string => Boolean(item));
  return cleaned.length > 0 ? cleaned : undefined;
};

const toRelationshipFormValues = (
  profile: RelationshipProfile | null
): RelationshipFormValues => ({
  relationship_stage: toOptionalTrimmed(profile?.relationship_stage),
  relationship_duration_days: toOptionalNumber(profile?.relationship_duration_days),
  communication_frequency: toOptionalTrimmed(profile?.communication_frequency),
  preferred_communication_methods: toOptionalStringArray(profile?.preferred_communication_methods) ?? [],
  relationship_strengths: toOptionalTrimmed(profile?.relationship_strengths),
  relationship_challenges: toOptionalTrimmed(profile?.relationship_challenges),
  completion_percentage: toOptionalNumber(profile?.completion_percentage),
});

const buildRelationshipPayload = (
  values: RelationshipFormValues
): RelationshipProfileInput => {
  const payload: RelationshipProfileInput = {};

  const relationshipStage = toOptionalTrimmed(values.relationship_stage);
  const relationshipDurationDays = toOptionalNumber(values.relationship_duration_days);
  const communicationFrequency = toOptionalTrimmed(values.communication_frequency);
  const preferredCommunicationMethods = toOptionalStringArray(values.preferred_communication_methods);
  const relationshipStrengths = toOptionalTrimmed(values.relationship_strengths);
  const relationshipChallenges = toOptionalTrimmed(values.relationship_challenges);
  const completionPercentage = toOptionalNumber(values.completion_percentage);

  if (relationshipStage) payload.relationship_stage = relationshipStage;
  if (relationshipDurationDays !== undefined) payload.relationship_duration_days = relationshipDurationDays;
  if (communicationFrequency) payload.communication_frequency = communicationFrequency;
  if (preferredCommunicationMethods) {
    payload.preferred_communication_methods = preferredCommunicationMethods;
  }
  if (relationshipStrengths) payload.relationship_strengths = relationshipStrengths;
  if (relationshipChallenges) payload.relationship_challenges = relationshipChallenges;
  if (completionPercentage !== undefined) payload.completion_percentage = completionPercentage;

  return payload;
};

const ProfilePairing = () => {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, fetchProfile: fetchPsychProfile, giveConsent, consentLoading } = usePsychProfileStore();
  const { startSession, checkResume } = useInterviewStore();
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipSaving, setRelationshipSaving] = useState(false);
  const [relationshipProfile, setRelationshipProfile] = useState<RelationshipProfile | null>(null);
  const [relationshipForm] = Form.useForm<RelationshipFormValues>();

  const mountedRef = useMountedRef();
  const staleRef = useRef(false);
  const retryLockRef = useRef(false);
  const createLockRef = useRef(false);
  const joinLockRef = useRef(false);
  const cancelLockRef = useRef(false);
  const saveLockRef = useRef(false);
  const activePairingId = pairing?.status === 'active' ? pairing.id : null;

  useEffect(() => {
    staleRef.current = false;
    fetchPairingStatus();
    fetchPsychProfile();
    return () => { staleRef.current = true; };
  }, []);

  const fetchPairingStatus = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const pairingData = await getPairingStatus();
      if (staleRef.current) return;
      setPairing(pairingData);
    } catch (error: unknown) {
      if (staleRef.current) return;
      message.error(getErrorMessage(error, 'message.getPairingFail'));
      setPairing(null);
      setLoadError(true);
    } finally {
      if (!staleRef.current) setLoading(false);
    }
  };

  const handleRetry = () => {
    if (retryLockRef.current) return;
    retryLockRef.current = true;
    setLoadError(false);
    fetchPairingStatus().finally(() => {
      retryLockRef.current = false;
    });
  };

  const fetchRelationshipData = async (pairingId: string) => {
    setRelationshipLoading(true);
    try {
      const relationshipData = await getRelationshipProfile(pairingId);
      if (staleRef.current) return;
      setRelationshipProfile(relationshipData);
      relationshipForm.setFieldsValue(toRelationshipFormValues(relationshipData));
    } catch (error: unknown) {
      if (staleRef.current) return;
      message.error(getErrorMessage(error, 'message.relationshipProfileLoadFail'));
      setRelationshipProfile(null);
      relationshipForm.resetFields();
    } finally {
      if (!staleRef.current) setRelationshipLoading(false);
    }
  };

  const [creating, setCreating] = useState(false);
  const handleCreatePairing = async () => {
    if (createLockRef.current) return;
    createLockRef.current = true;
    setCreating(true);
    try {
      const newPairing = await createPairing();
      if (!mountedRef.current) return;
      setPairing(newPairing);
      message.success(t('message.createPairingSuccess'));
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'message.createPairingFail'));
    } finally {
      createLockRef.current = false;
      setCreating(false);
    }
  };

  const handleJoinPairing = async () => {
    if (!inviteCode.trim()) {
      message.warning(t('message.enterInviteCode'));
      return;
    }
    if (joinLockRef.current) return;
    joinLockRef.current = true;
    setJoining(true);
    try {
      const joinedPairing = await joinPairing(inviteCode.trim());
      if (!mountedRef.current) return;
      setPairing(joinedPairing);
      message.success(t('message.joinPairingSuccess'));
      setInviteCode('');
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'message.joinPairingFail'));
    } finally {
      joinLockRef.current = false;
      setJoining(false);
    }
  };

  const handleCopyCode = () => {
    if (pairing?.invite_code) {
      navigator.clipboard.writeText(pairing.invite_code);
      message.success(t('message.copyInviteSuccess'));
    }
  };

  const handleCancelPairing = async () => {
    setConfirmCancelOpen(false);
    if (cancelLockRef.current) return;
    cancelLockRef.current = true;
    setCancelling(true);
    try {
      const cancelled = await cancelPairing();
      if (!mountedRef.current) return;
      setPairing(cancelled);
      message.success(t('message.cancelPairingSuccess'));
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'message.cancelPairingFail'));
    } finally {
      cancelLockRef.current = false;
      setCancelling(false);
    }
  };

  const handleSaveRelationshipProfile = async (values: RelationshipFormValues) => {
    if (!activePairingId) return;
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setRelationshipSaving(true);
    try {
      const payload = buildRelationshipPayload(values);
      const savedProfile = await upsertRelationshipProfile(activePairingId, payload);
      if (staleRef.current || !mountedRef.current) return;
      setRelationshipProfile(savedProfile);
      relationshipForm.setFieldsValue(toRelationshipFormValues(savedProfile));
      message.success(t('message.relationshipProfileSaveSuccess'));
    } catch (error: unknown) {
      if (staleRef.current) return;
      message.error(getErrorMessage(error, 'message.relationshipProfileSaveFail'));
    } finally {
      if (!staleRef.current) {
        saveLockRef.current = false;
        setRelationshipSaving(false);
      }
    }
  };

  useEffect(() => {
    if (!activePairingId) {
      relationshipForm.resetFields();
      setRelationshipProfile(null);
      return;
    }
    void fetchRelationshipData(activePairingId);
  }, [activePairingId, relationshipForm]);

  if (loading) {
    return (
      <div className="profile-pairing-page">
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  const startInterviewFlow = async () => {
    if (!activePairingId) return;
    const resumeData = await checkResume();
    if (!mountedRef.current) return;
    if (resumeData.has_pending && resumeData.session_id) {
      navigate(`/interview/${resumeData.session_id}`);
      return;
    }
    const session = await startSession('onboarding');
    if (!mountedRef.current) return;
    navigate(`/interview/${session.id}`);
  };

  const handleTriggerAClick = async () => {
    if (!activePairingId) return;
    if (!profile?.consent_given) {
      setConsentOpen(true);
      return;
    }
    try {
      await startInterviewFlow();
    } catch (error: unknown) {
      if (mountedRef.current) {
        message.error(getErrorMessage(error, 'interview.startFail'));
      }
    }
  };

  const handleConsent = async () => {
    if (!activePairingId) {
      setConsentOpen(false);
      return;
    }
    try {
      await giveConsent();
      if (!mountedRef.current) return;
      setConsentOpen(false);
      await startInterviewFlow();
    } catch (error: unknown) {
      if (mountedRef.current) {
        message.error(getErrorMessage(error, 'interview.startFail'));
      }
    }
  };

  if (loadError) {
    return (
      <ProtectedRoute>
        <div className="profile-pairing-page" role="main" aria-label={t('pairing.pageLabel')}>
          <Alert
            title={t('message.getPairingFail')}
            type="error"
            showIcon
            action={
              <Space>
                <Button size="small" onClick={handleRetry}>{t('common.retry')}</Button>
                <Button size="small" type="primary" onClick={() => navigate('/profile/settings')}>
                  {t('pairing.goToSettings')}
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
        title={t('pairing.title')}
        description={t('pairing.description')}
      />
      <div className="profile-pairing-page" role="main" aria-label={t('pairing.pageLabel')}>
        {activePairingId && !profile?.consent_given && (
          <AnimatedWrapper animation="fade" delay={50}>
            <Alert
              title={t('trigger.bannerTitle')}
              description={t('trigger.bannerDesc')}
              type="info"
              showIcon
              action={
                <Button size="small" type="primary" onClick={handleTriggerAClick}>
                  {t('trigger.bannerOk')}
                </Button>
              }
              closable
              style={{ marginBottom: 16 }}
            />
          </AnimatedWrapper>
        )}

        <ConsentModal
          open={consentOpen}
          onConsent={handleConsent}
          onCancel={() => setConsentOpen(false)}
          loading={consentLoading}
        />

        <AnimatedWrapper animation="fade" delay={100}>
          <Title level={2} id="pairing-title">
            {t('pairing.heading')}
          </Title>
        </AnimatedWrapper>

        {pairing && pairing.status === 'active' ? (
          <AnimatedWrapper animation="slide" direction="up" delay={200}>
            <Card role="article" aria-labelledby="pairing-title">
            <Alert
              title={t('pairing.pairedTitle')}
              description={t('pairing.pairedDesc')}
              type="success"
              showIcon
            />
            <Space orientation="vertical" style={{ marginTop: 24, width: '100%' }}>
              <Text strong>{t('pairing.pairingInfo')}</Text>
              <Text>{t('pairing.pairingId')}{pairing.id}</Text>
              {pairing.user1 && <Text>{t('pairing.user1')}{pairing.user1.nickname || pairing.user1.id}</Text>}
              {pairing.user2 && <Text>{t('pairing.user2')}{pairing.user2.nickname || pairing.user2.id}</Text>}
              <Divider style={{ margin: '12px 0' }} />
              <Text strong>{t('pairing.relationshipTitle')}</Text>
              <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                {t('pairing.relationshipDesc')}
              </Paragraph>
              {relationshipProfile?.last_updated_at && (
                <Text type="secondary">
                  {t('pairing.relationshipLastUpdated', {
                    time: new Date(relationshipProfile.last_updated_at).toLocaleString(),
                  })}
                </Text>
              )}
              {relationshipLoading ? (
                <Spin size="small" />
              ) : (
                <Form<RelationshipFormValues>
                  form={relationshipForm}
                  layout="vertical"
                  onFinish={handleSaveRelationshipProfile}
                  style={{ width: '100%' }}
                >
                  <Form.Item
                    label={t('pairing.relationshipStage')}
                    name="relationship_stage"
                  >
                    <Select
                      allowClear
                      placeholder={t('pairing.relationshipStagePlaceholder')}
                      options={[
                        { value: 'newly_dating', label: t('pairing.relationshipStageNewlyDating') },
                        { value: 'stable', label: t('pairing.relationshipStageStable') },
                        { value: 'engaged', label: t('pairing.relationshipStageEngaged') },
                        { value: 'married', label: t('pairing.relationshipStageMarried') },
                        { value: 'separated', label: t('pairing.relationshipStageSeparated') },
                        { value: 'other', label: t('pairing.relationshipStageOther') },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t('pairing.relationshipDurationDays')}
                    name="relationship_duration_days"
                  >
                    <InputNumber
                      min={0}
                      max={36500}
                      style={{ width: '100%' }}
                      placeholder={t('pairing.relationshipDurationDaysPlaceholder')}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t('pairing.communicationFrequency')}
                    name="communication_frequency"
                  >
                    <Input placeholder={t('pairing.communicationFrequencyPlaceholder')} />
                  </Form.Item>

                  <Form.Item
                    label={t('pairing.preferredCommunicationMethods')}
                    name="preferred_communication_methods"
                  >
                    <Select
                      mode="tags"
                      tokenSeparators={[',']}
                      placeholder={t('pairing.preferredCommunicationMethodsPlaceholder')}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t('pairing.relationshipStrengths')}
                    name="relationship_strengths"
                  >
                    <TextArea
                      rows={3}
                      showCount
                      maxLength={1000}
                      placeholder={t('pairing.relationshipStrengthsPlaceholder')}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t('pairing.relationshipChallenges')}
                    name="relationship_challenges"
                  >
                    <TextArea
                      rows={3}
                      showCount
                      maxLength={1000}
                      placeholder={t('pairing.relationshipChallengesPlaceholder')}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t('pairing.completionPercentage')}
                    name="completion_percentage"
                    rules={[{ type: 'number', min: 0, max: 100 }]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      style={{ width: '100%' }}
                      placeholder={t('pairing.completionPercentagePlaceholder')}
                    />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" loading={relationshipSaving}>
                    {t('pairing.saveRelationshipProfile')}
                  </Button>
                </Form>
              )}
              <Button danger onClick={() => setConfirmCancelOpen(true)} loading={cancelling}>
                {t('pairing.cancelPairing')}
              </Button>
              <ConfirmModal
                open={confirmCancelOpen}
                onCancel={() => setConfirmCancelOpen(false)}
                onConfirm={handleCancelPairing}
                title={t('pairing.confirmCancelTitle')}
                type="danger"
                confirmText={t('pairing.cancelPairing')}
              >
                {t('pairing.confirmCancelDesc')}
              </ConfirmModal>
            </Space>
          </Card>
          </AnimatedWrapper>
        ) : pairing && pairing.status === 'pending' ? (
          <AnimatedWrapper animation="slide" direction="up" delay={200}>
            <Card>
            <Alert
              title={t('pairing.pendingTitle')}
              description={t('pairing.pendingDesc')}
              type="info"
              showIcon
            />
            <Space orientation="vertical" style={{ marginTop: 24, width: '100%' }}>
              <Text strong>{t('pairing.inviteCode')}</Text>
              <Space>
                <Input
                  value={pairing.invite_code}
                  readOnly
                  style={{ width: 200, fontFamily: 'monospace', fontSize: 18, textAlign: 'center' }}
                />
                <Button icon={<CopyOutlined />} onClick={handleCopyCode}>
                  {t('pairing.copy')}
                </Button>
              </Space>
              <Paragraph type="secondary">
                {t('pairing.inviteHint')}
              </Paragraph>
            </Space>
          </Card>
          </AnimatedWrapper>
        ) : (
          <AnimatedWrapper animation="slide" direction="up" delay={200}>
            <Card>
            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={4}>{t('pairing.createTitle')}</Title>
                <Paragraph>
                  {t('pairing.createDesc')}
                </Paragraph>
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={handleCreatePairing}
                  loading={creating}
                >
                  {t('pairing.createButton')}
                </Button>
              </div>

              <div style={{ borderTop: '1px solid #d9d9d9', paddingTop: 24 }}>
                <Title level={4}>{t('pairing.joinTitle')}</Title>
                <Paragraph>
                  {t('pairing.joinDesc')}
                </Paragraph>
                <Space>
                  <Input
                    placeholder={t('pairing.joinPlaceholder')}
                    value={inviteCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    style={{ width: 200, fontFamily: 'monospace', fontSize: 18, textAlign: 'center' }}
                  />
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleJoinPairing}
                    loading={joining}
                  >
                    {t('pairing.joinButton')}
                  </Button>
                </Space>
              </div>
            </Space>
          </Card>
          </AnimatedWrapper>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ProfilePairing;
