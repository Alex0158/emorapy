/**
 * 配對管理頁面
 */

import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Input,
  Alert,
  message,
  Spin,
} from 'antd';
import {
  CopyOutlined,
  CheckCircleOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { createPairing, joinPairing, getPairingStatus, cancelPairing } from '@/services/api/pairing';
import type { Pairing } from '@/services/api/pairing';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import ConfirmModal from '@/components/common/ConfirmModal';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import './Pairing.less';

const { Title, Text, Paragraph } = Typography;

const ProfilePairing = () => {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  useEffect(() => {
    fetchPairingStatus();
  }, []);

  const fetchPairingStatus = async () => {
    setLoading(true);
    try {
      const pairingData = await getPairingStatus();
      setPairing(pairingData);
    } catch {
      setPairing(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePairing = async () => {
    setLoading(true);
    try {
      const newPairing = await createPairing();
      setPairing(newPairing);
      message.success(t('message.createPairingSuccess'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.createPairingFail');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPairing = async () => {
    if (!inviteCode.trim()) {
      message.warning(t('message.enterInviteCode'));
      return;
    }
    setJoining(true);
    try {
      const joinedPairing = await joinPairing(inviteCode.trim());
      setPairing(joinedPairing);
      message.success(t('message.joinPairingSuccess'));
      setInviteCode('');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.joinPairingFail');
      message.error(msg);
    } finally {
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
    setCancelling(true);
    try {
      const cancelled = await cancelPairing();
      setPairing(cancelled);
      message.success(t('message.cancelPairingSuccess'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.cancelPairingFail');
      message.error(msg);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-pairing-page">
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title={t('pairing.title')}
        description={t('pairing.description')}
      />
      <div className="profile-pairing-page" role="main" aria-label={t('pairing.pageLabel')}>
        <AnimatedWrapper animation="fade" delay={100}>
          <Title level={2} id="pairing-title">
            {t('pairing.heading')}
          </Title>
        </AnimatedWrapper>

        {pairing && pairing.status === 'active' ? (
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card role="article" aria-labelledby="pairing-title">
            <Alert
              message={t('pairing.pairedTitle')}
              description={t('pairing.pairedDesc')}
              type="success"
              showIcon
            />
            <Space direction="vertical" style={{ marginTop: 24, width: '100%' }}>
              <Text strong>{t('pairing.pairingInfo')}</Text>
              <Text>{t('pairing.pairingId')}{pairing.id}</Text>
              {pairing.user1 && <Text>{t('pairing.user1')}{pairing.user1.nickname || pairing.user1.id}</Text>}
              {pairing.user2 && <Text>{t('pairing.user2')}{pairing.user2.nickname || pairing.user2.id}</Text>}
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
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card>
            <Alert
              message={t('pairing.pendingTitle')}
              description={t('pairing.pendingDesc')}
              type="info"
              showIcon
            />
            <Space direction="vertical" style={{ marginTop: 24, width: '100%' }}>
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
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={4}>{t('pairing.createTitle')}</Title>
                <Paragraph>
                  {t('pairing.createDesc')}
                </Paragraph>
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={handleCreatePairing}
                  loading={loading}
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
