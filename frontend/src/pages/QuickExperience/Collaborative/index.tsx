/**
 * 協作聽證模式 — 同設備雙人輪流陳述
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Steps as AntdSteps, Input, message, Card } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { SwapOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { createCollaborativeCase } from '@/services/api/case';
import { sessionStorage, caseSessionMap } from '@/utils/storage';
import SEO from '@/components/common/SEO';
import BearJudge from '@/components/business/BearJudge';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';
import { MIN_STATEMENT_LENGTH, MIN_DEFENDANT_LENGTH } from '@/utils/constants';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const Steps = process.env.NODE_ENV === 'test'
  ? (({ current }: { current: number }) => <div data-testid="steps-mock">step-{current}</div>)
  : AntdSteps;

type Phase = 'intro' | 'role_a' | 'handoff' | 'role_b' | 'submitting';

const CollaborativeCreate = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('intro');
  const [roleAText, setRoleAText] = useState('');
  const [roleBText, setRoleBText] = useState('');
  const [caseId, setCaseId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = phase === 'intro' ? 0 : phase === 'role_a' ? 0 : phase === 'handoff' ? 1 : phase === 'role_b' ? 2 : 3;

  const handleRoleASubmit = useCallback(async () => {
    if (roleAText.trim().length < MIN_STATEMENT_LENGTH) {
      message.warning(t('collaborative.minLengthWarning').replace('{count}', String(MIN_STATEMENT_LENGTH)));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createCollaborativeCase(
        { plaintiff_statement: roleAText.trim() },
        sessionId ?? undefined
      );
      setCaseId(result.case.id);
      setSessionId(result.session_id);
      sessionStorage.set(result.session_id);
      setPhase('handoff');
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.submitFail');
      message.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [roleAText, sessionId]);

  const handleRoleBSubmit = useCallback(async () => {
    if (roleBText.trim().length < MIN_DEFENDANT_LENGTH) {
      message.warning(t('collaborative.minLengthWarning').replace('{count}', String(MIN_DEFENDANT_LENGTH)));
      return;
    }
    if (!caseId || !sessionId) {
      message.error(t('collaborative.caseMissing'));
      return;
    }
    setIsSubmitting(true);
    setPhase('submitting');
    try {
      const result = await createCollaborativeCase(
        { case_id: caseId, defendant_statement: roleBText.trim() },
        sessionId
      );
      caseSessionMap.set(result.case.id, result.session_id);
      message.success(t('collaborative.submitSuccess'));
      navigate(`/quick-experience/result/${result.case.id}`);
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message || t('message.submitFail');
      message.error(msg);
      setPhase('role_b');
    } finally {
      setIsSubmitting(false);
    }
  }, [roleBText, caseId, sessionId, navigate]);

  return (
    <>
      <SEO title={t('collaborative.seoTitle')} description={t('collaborative.seoDesc')} />
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)', padding: '40px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <AnimatedWrapper animation="fade" delay={100}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <BearJudge size="medium" animated />
              <Title level={2} style={{ color: '#fff', marginTop: 16 }}>{t('collaborative.title')}</Title>
              <Text style={{ color: '#94A3B8', fontSize: 16 }}>
                {t('collaborative.subtitle')}
              </Text>
            </div>
          </AnimatedWrapper>

          <Steps
            current={currentStep}
            style={{ marginBottom: 32 }}
            items={[
              { title: <span style={{ color: '#CBD5E1' }}>{t('collaborative.stepRoleA')}</span>, icon: <EditOutlined style={{ color: currentStep >= 0 ? '#FF8E5E' : '#475569' }} /> },
              { title: <span style={{ color: '#CBD5E1' }}>{t('collaborative.stepHandoff')}</span>, icon: <SwapOutlined style={{ color: currentStep >= 1 ? '#FBBF24' : '#475569' }} /> },
              { title: <span style={{ color: '#CBD5E1' }}>{t('collaborative.stepRoleB')}</span>, icon: <EditOutlined style={{ color: currentStep >= 2 ? '#5BB1D2' : '#475569' }} /> },
              { title: <span style={{ color: '#CBD5E1' }}>{t('collaborative.stepSubmit')}</span>, icon: <CheckCircleOutlined style={{ color: currentStep >= 3 ? '#4ADE80' : '#475569' }} /> },
            ]}
          />

          <AnimatePresence mode="wait">
            {phase === 'intro' && (
              <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Card style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16 }}>
                  <Paragraph style={{ color: '#CBD5E1', fontSize: 15, lineHeight: 1.8, marginBottom: 24 }}>
                    {t('collaborative.introText')}
                  </Paragraph>
                  <ul style={{ color: '#94A3B8', lineHeight: 2.2, paddingLeft: 20, marginBottom: 24 }}>
                    <li><Text style={{ color: '#FF8E5E' }}>{t('collaborative.roleALabel')}</Text>{t('collaborative.introRule1')}</li>
                    <li>{t('collaborative.introRule2Prefix')}<Text style={{ color: '#5BB1D2' }}>{t('collaborative.roleBLabel')}</Text></li>
                    <li><Text style={{ color: '#5BB1D2' }}>{t('collaborative.roleBLabel')}</Text>{t('collaborative.introRule3Suffix')}</li>
                    <li>{t('collaborative.introRule4')}</li>
                  </ul>
                  <Paragraph style={{ color: '#FBBF24', fontSize: 14 }}>
                    {t('collaborative.introTip')}
                  </Paragraph>
                  <Button type="primary" size="large" block onClick={() => setPhase('role_a')} style={{ marginTop: 16, height: 48, borderRadius: 12, background: '#FF8E5E', borderColor: '#FF8E5E' }}>
                    {t('collaborative.startBtn')}
                  </Button>
                </Card>
              </motion.div>
            )}

            {phase === 'role_a' && (
              <motion.div key="role_a" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <Card style={{ background: 'rgba(255,142,94,0.08)', border: '1px solid rgba(255,142,94,0.3)', borderRadius: 16 }}>
                  <Title level={4} style={{ color: '#FF8E5E', marginBottom: 8 }}>
                    {t('collaborative.roleATitle')}
                  </Title>
                  <Text style={{ color: '#94A3B8', display: 'block', marginBottom: 16 }}>
                    {t('collaborative.roleAHint')}
                  </Text>
                  <TextArea
                    value={roleAText}
                    onChange={e => setRoleAText(e.target.value)}
                    placeholder={t('collaborative.placeholder')}
                    autoSize={{ minRows: 8, maxRows: 16 }}
                    maxLength={2000}
                    showCount
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,142,94,0.2)', color: '#E2E8F0', borderRadius: 8 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                    <Button onClick={() => setPhase('intro')} style={{ color: '#94A3B8' }}>{t('collaborative.back')}</Button>
                    <Button
                      type="primary"
                      loading={isSubmitting}
                      disabled={roleAText.trim().length < MIN_STATEMENT_LENGTH}
                      onClick={handleRoleASubmit}
                      style={{ background: '#FF8E5E', borderColor: '#FF8E5E' }}
                    >
                      {t('collaborative.roleASubmit')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {phase === 'handoff' && (
              <motion.div key="handoff" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Card style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 16, textAlign: 'center', padding: '40px 24px' }}>
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ fontSize: 64, marginBottom: 24 }}
                  >
                    📱
                  </motion.div>
                  <Title level={3} style={{ color: '#FBBF24', marginBottom: 12 }}>
                    {t('collaborative.handoffTitle')}
                  </Title>
                  <Paragraph style={{ color: '#CBD5E1', fontSize: 15, lineHeight: 1.7 }}>
                    {t('collaborative.handoffRecorded')}
                    <br />{t('collaborative.handoffPassDevice')}
                    <br /><br />
                    <Text style={{ color: '#94A3B8' }}>{t('collaborative.handoffNote')}</Text>
                  </Paragraph>
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => setPhase('role_b')}
                    style={{ marginTop: 24, height: 48, borderRadius: 12, background: '#5BB1D2', borderColor: '#5BB1D2', minWidth: 200 }}
                  >
                    {t('collaborative.roleBStart')}
                  </Button>
                </Card>
              </motion.div>
            )}

            {phase === 'role_b' && (
              <motion.div key="role_b" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <Card style={{ background: 'rgba(91,177,210,0.08)', border: '1px solid rgba(91,177,210,0.3)', borderRadius: 16 }}>
                  <Title level={4} style={{ color: '#5BB1D2', marginBottom: 8 }}>
                    {t('collaborative.roleBTitle')}
                  </Title>
                  <Text style={{ color: '#94A3B8', display: 'block', marginBottom: 16 }}>
                    {t('collaborative.roleBHint')}
                  </Text>
                  <TextArea
                    value={roleBText}
                    onChange={e => setRoleBText(e.target.value)}
                    placeholder={t('collaborative.placeholder')}
                    autoSize={{ minRows: 8, maxRows: 16 }}
                    maxLength={2000}
                    showCount
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(91,177,210,0.2)', color: '#E2E8F0', borderRadius: 8 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <Button
                      type="primary"
                      size="large"
                      loading={isSubmitting}
                      disabled={roleBText.trim().length < MIN_DEFENDANT_LENGTH}
                      onClick={handleRoleBSubmit}
                      style={{ background: '#4ADE80', borderColor: '#4ADE80', color: '#0F172A' }}
                    >
                      {t('collaborative.submitBtn')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {phase === 'submitting' && (
              <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ fontSize: 48, marginBottom: 24 }}
                  >
                    🐻
                  </motion.div>
                  <Text style={{ color: '#CBD5E1', fontSize: 16 }}>{t('collaborative.submittingText')}</Text>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

export default CollaborativeCreate;
