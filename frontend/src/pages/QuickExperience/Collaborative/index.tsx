/**
 * 協作聽證模式 — 同設備雙人輪流陳述
 */

import { useState, useCallback, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Steps, Input, message, Card, Alert } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { SwapOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { createCollaborativeCase } from '@/services/api/case';
import { sessionStorage, caseSessionMap } from '@/utils/storage';
import SEO from '@/components/common/SEO';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { MIN_STATEMENT_LENGTH, MIN_DEFENDANT_LENGTH } from '@/utils/constants';
import './index.less';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

type Phase = 'intro' | 'role_a' | 'handoff' | 'role_b' | 'submitting';

const CollaborativeCreate = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('intro');
  const [roleAText, setRoleAText] = useState('');
  const [roleBText, setRoleBText] = useState('');
  const [caseId, setCaseId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mountedRef = useMountedRef();
  const submitLockRef = useRef(false);

  const currentStep = phase === 'intro' ? 0 : phase === 'role_a' ? 0 : phase === 'handoff' ? 1 : phase === 'role_b' ? 2 : 3;

  const handleRoleASubmit = useCallback(async () => {
    if (roleAText.trim().length < MIN_STATEMENT_LENGTH) {
      message.warning(t('collaborative.minLengthWarning').replace('{count}', String(MIN_STATEMENT_LENGTH)));
      return;
    }
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await createCollaborativeCase(
        { plaintiff_statement: roleAText.trim() },
        sessionId ?? undefined
      );
      if (!mountedRef.current) return;
      setCaseId(result.case.id);
      setSessionId(result.session_id);
      sessionStorage.set(result.session_id);
      setPhase('handoff');
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const errorMessage = getErrorMessage(error, 'message.submitFail');
      message.error(errorMessage);
      setSubmitError(errorMessage);
    } finally {
      submitLockRef.current = false;
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [roleAText, sessionId, mountedRef]);

  const handleRoleBSubmit = useCallback(async () => {
    if (roleBText.trim().length < MIN_DEFENDANT_LENGTH) {
      message.warning(t('collaborative.minLengthWarning').replace('{count}', String(MIN_DEFENDANT_LENGTH)));
      return;
    }
    if (!caseId || !sessionId) {
      message.error(t('collaborative.caseMissing'));
      return;
    }
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitError(null);
    setIsSubmitting(true);
    setPhase('submitting');
    try {
      const result = await createCollaborativeCase(
        { case_id: caseId, defendant_statement: roleBText.trim() },
        sessionId
      );
      if (!mountedRef.current) return;
      caseSessionMap.set(result.case.id, result.session_id);
      message.success(t('collaborative.submitSuccess'));
      navigate(`/quick-experience/result/${result.case.id}`);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const errorMessage = getErrorMessage(error, 'message.submitFail');
      message.error(errorMessage);
      setSubmitError(errorMessage);
      setPhase('role_b');
    } finally {
      submitLockRef.current = false;
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [roleBText, caseId, sessionId, navigate, mountedRef]);

  const getStepIconColor = (stepIndex: number) =>
    currentStep >= stepIndex ? 'collaborative-page__stepper-icon--active-' + stepIndex : 'collaborative-page__stepper-icon--inactive';

  return (
    <>
      <SEO title={t('collaborative.seoTitle')} description={t('collaborative.seoDesc')} />
      <div className="collaborative-page">
        <div className="collaborative-page__container">
          <AnimatedWrapper animation="fade" delay={100}>
            <div className="collaborative-page__header">
              <MediatorAvatar size="medium" animated />
              <Title level={2} className="collaborative-page__header-title">{t('collaborative.title')}</Title>
              <Text className="collaborative-page__header-subtitle">{t('collaborative.subtitle')}</Text>
            </div>
          </AnimatedWrapper>

          <Steps
            current={currentStep}
            className="collaborative-page__stepper"
            items={[
              { title: <span className="collaborative-page__stepper-title">{t('collaborative.stepRoleA')}</span>, icon: <EditOutlined className={getStepIconColor(0)} /> },
              { title: <span className="collaborative-page__stepper-title">{t('collaborative.stepHandoff')}</span>, icon: <SwapOutlined className={getStepIconColor(1)} /> },
              { title: <span className="collaborative-page__stepper-title">{t('collaborative.stepRoleB')}</span>, icon: <EditOutlined className={getStepIconColor(2)} /> },
              { title: <span className="collaborative-page__stepper-title">{t('collaborative.stepSubmit')}</span>, icon: <CheckCircleOutlined className={getStepIconColor(3)} /> },
            ]}
          />

          <AnimatePresence mode="wait">
            {phase === 'intro' && (
              <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Card className="collaborative-page__panel collaborative-page__panel--intro">
                  <Paragraph className="collaborative-page__panel-intro-text">{t('collaborative.introText')}</Paragraph>
                  <ul className="collaborative-page__panel-intro-list">
                    <li><Text className="collaborative-page__role-a-label">{t('collaborative.roleALabel')}</Text>{t('collaborative.introRule1')}</li>
                    <li>{t('collaborative.introRule2Prefix')}<Text className="collaborative-page__role-b-label">{t('collaborative.roleBLabel')}</Text></li>
                    <li><Text className="collaborative-page__role-b-label">{t('collaborative.roleBLabel')}</Text>{t('collaborative.introRule3Suffix')}</li>
                    <li>{t('collaborative.introRule4')}</li>
                  </ul>
                  <Paragraph className="collaborative-page__panel-intro-tip">{t('collaborative.introTip')}</Paragraph>
                  <Button type="primary" size="large" block onClick={() => setPhase('role_a')} className="collaborative-page__btn-cta--role-a">
                    {t('collaborative.startBtn')}
                  </Button>
                </Card>
              </motion.div>
            )}

            {phase === 'role_a' && (
              <motion.div key="role_a" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <Card className="collaborative-page__panel collaborative-page__panel--role-a">
                  <Title level={4} className="collaborative-page__panel-role-a-title">{t('collaborative.roleATitle')}</Title>
                  <Text className="collaborative-page__panel-hint">{t('collaborative.roleAHint')}</Text>
                  {submitError && (
                    <Alert
                      type="error"
                      showIcon
                      className="collaborative-page__inline-error"
                      title={submitError}
                      action={
                        <Button size="small" onClick={() => void handleRoleASubmit()}>
                          {t('error.retry')}
                        </Button>
                      }
                    />
                  )}
                  <TextArea
                    value={roleAText}
                    onChange={e => {
                      if (submitError) setSubmitError(null);
                      setRoleAText(e.target.value);
                    }}
                    placeholder={t('collaborative.placeholder')}
                    autoSize={{ minRows: 8, maxRows: 16 }}
                    maxLength={2000}
                    showCount
                    className="collaborative-page__textarea collaborative-page__textarea--role-a"
                  />
                  <div className="collaborative-page__actions">
                    <Button onClick={() => setPhase('intro')} className="collaborative-page__btn-back">{t('collaborative.back')}</Button>
                    <Button
                      type="primary"
                      loading={isSubmitting}
                      disabled={roleAText.trim().length < MIN_STATEMENT_LENGTH}
                      onClick={handleRoleASubmit}
                      className="collaborative-page__btn-cta--role-a"
                    >
                      {t('collaborative.roleASubmit')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {phase === 'handoff' && (
              <motion.div key="handoff" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Card className="collaborative-page__panel collaborative-page__panel--handoff">
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ fontSize: 64, marginBottom: 24 }}
                  >
                    📱
                  </motion.div>
                  <Title level={3} className="collaborative-page__handoff-title">{t('collaborative.handoffTitle')}</Title>
                  <Paragraph className="collaborative-page__handoff-text">
                    {t('collaborative.handoffRecorded')}
                    <br />{t('collaborative.handoffPassDevice')}
                    <br /><br />
                    <Text className="collaborative-page__handoff-note">{t('collaborative.handoffNote')}</Text>
                  </Paragraph>
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => setPhase('role_b')}
                    className="collaborative-page__btn-cta--handoff"
                  >
                    {t('collaborative.roleBStart')}
                  </Button>
                </Card>
              </motion.div>
            )}

            {phase === 'role_b' && (
              <motion.div key="role_b" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
                <Card className="collaborative-page__panel collaborative-page__panel--role-b">
                  <Title level={4} className="collaborative-page__panel-role-b-title">{t('collaborative.roleBTitle')}</Title>
                  <Text className="collaborative-page__panel-hint">{t('collaborative.roleBHint')}</Text>
                  {submitError && (
                    <Alert
                      type="error"
                      showIcon
                      className="collaborative-page__inline-error"
                      title={submitError}
                      action={
                        <Button size="small" onClick={() => void handleRoleBSubmit()}>
                          {t('error.retry')}
                        </Button>
                      }
                    />
                  )}
                  <TextArea
                    value={roleBText}
                    onChange={e => {
                      if (submitError) setSubmitError(null);
                      setRoleBText(e.target.value);
                    }}
                    placeholder={t('collaborative.placeholder')}
                    autoSize={{ minRows: 8, maxRows: 16 }}
                    maxLength={2000}
                    showCount
                    className="collaborative-page__textarea collaborative-page__textarea--role-b"
                  />
                  <div className="collaborative-page__actions">
                    <Button
                      onClick={() => setPhase('handoff')}
                      disabled={isSubmitting}
                      className="collaborative-page__btn-back"
                    >
                      {t('collaborative.back')}
                    </Button>
                    <Button
                      type="primary"
                      size="large"
                      loading={isSubmitting}
                      disabled={roleBText.trim().length < MIN_DEFENDANT_LENGTH}
                      onClick={handleRoleBSubmit}
                      className="collaborative-page__btn-cta--submit"
                    >
                      {t('collaborative.submitBtn')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {phase === 'submitting' && (
              <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="collaborative-page__submitting">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ fontSize: 48, marginBottom: 24 }}
                  >
                    🤖
                  </motion.div>
                  <Text className="collaborative-page__submitting-text">{t('collaborative.submittingText')}</Text>
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
