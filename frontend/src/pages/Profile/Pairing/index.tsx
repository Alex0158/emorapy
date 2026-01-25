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
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import './Pairing.less';

const { Title, Text, Paragraph } = Typography;

const ProfilePairing = () => {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchPairingStatus();
  }, []);

  const fetchPairingStatus = async () => {
    setLoading(true);
    try {
      const pairingData = await getPairingStatus();
      setPairing(pairingData);
    } catch (error) {
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
      message.success('配對邀請已創建');
    } catch (error: any) {
      message.error(error.message || '創建配對失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPairing = async () => {
    if (!inviteCode.trim()) {
      message.warning('請輸入邀請碼');
      return;
    }
    setJoining(true);
    try {
      const joinedPairing = await joinPairing(inviteCode.trim());
      setPairing(joinedPairing);
      message.success('配對成功！');
      setInviteCode('');
    } catch (error: any) {
      message.error(error.message || '加入配對失敗');
    } finally {
      setJoining(false);
    }
  };

  const handleCopyCode = () => {
    if (pairing?.invite_code) {
      navigator.clipboard.writeText(pairing.invite_code);
      message.success('邀請碼已複製');
    }
  };

  const handleCancelPairing = async () => {
    setCancelling(true);
    try {
      const cancelled = await cancelPairing();
      setPairing(cancelled);
      message.success('配對已解除');
    } catch (error: any) {
      message.error(error.message || '解除配對失敗');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-pairing-page">
        <Spin size="large" tip="加載中..." />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SEO
        title="配對管理 - 熊媽媽法庭"
        description="管理您的配對關係"
      />
      <div className="profile-pairing-page" role="main" aria-label="配對管理頁面">
        <AnimatedWrapper animation="fade" delay={100}>
          <Title level={2} id="pairing-title">
            配對管理
          </Title>
        </AnimatedWrapper>

        {pairing && pairing.status === 'active' ? (
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card role="article" aria-labelledby="pairing-title">
            <Alert
              message="配對成功"
              description="您已成功配對，可以開始創建案件了。"
              type="success"
              showIcon
            />
            <Space direction="vertical" style={{ marginTop: 24, width: '100%' }}>
              <Text strong>配對信息：</Text>
              <Text>配對ID：{pairing.id}</Text>
              {pairing.user1 && <Text>用戶1：{pairing.user1.nickname || pairing.user1.id}</Text>}
              {pairing.user2 && <Text>用戶2：{pairing.user2.nickname || pairing.user2.id}</Text>}
              <Button danger onClick={handleCancelPairing} loading={cancelling}>
                解除配對
              </Button>
            </Space>
          </Card>
          </AnimatedWrapper>
        ) : pairing && pairing.status === 'pending' ? (
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card>
            <Alert
              message="等待配對"
              description="已創建配對邀請，等待對方加入。"
              type="info"
              showIcon
            />
            <Space direction="vertical" style={{ marginTop: 24, width: '100%' }}>
              <Text strong>邀請碼：</Text>
              <Space>
                <Input
                  value={pairing.invite_code}
                  readOnly
                  style={{ width: 200, fontFamily: 'monospace', fontSize: 18, textAlign: 'center' }}
                />
                <Button icon={<CopyOutlined />} onClick={handleCopyCode}>
                  複製
                </Button>
              </Space>
              <Paragraph type="secondary">
                請將此邀請碼分享給您的伴侶，讓對方在配對頁面輸入此邀請碼即可完成配對。
              </Paragraph>
            </Space>
          </Card>
          </AnimatedWrapper>
        ) : (
          <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
            <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={4}>創建配對邀請</Title>
                <Paragraph>
                  創建配對邀請，生成邀請碼分享給您的伴侶。
                </Paragraph>
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={handleCreatePairing}
                  loading={loading}
                >
                  創建配對邀請
                </Button>
              </div>

              <div style={{ borderTop: '1px solid #d9d9d9', paddingTop: 24 }}>
                <Title level={4}>加入配對</Title>
                <Paragraph>
                  如果您收到了邀請碼，請在此輸入以加入配對。
                </Paragraph>
                <Space>
                  <Input
                    placeholder="請輸入6位邀請碼"
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
                    加入配對
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
