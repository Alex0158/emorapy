/**
 * 快速體驗 - 判決結果頁面（極致美學版）
 */

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Alert, message, Space, Button } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { LockOutlined, RetweetOutlined, BulbOutlined } from '@ant-design/icons';
import { useJudgmentStore } from '@/store/judgmentStore';
import { getJudgmentByCaseId } from '@/services/api/judgment';
import { getCase, uploadEvidence } from '@/services/api/case';
import { getContentList, type ContentItem } from '@/services/api/content';
import type { Judgment } from '@/types/judgment';
import { usePolling } from '@/hooks/usePolling';
import { POLLING_INTERVAL } from '@/utils/constants';
import { useSessionStore } from '@/store/sessionStore';
import { sessionStorage, caseSessionMap } from '@/utils/storage';
import SEO from '@/components/common/SEO';
import { logger } from '@/utils/logger';
import { t, getLocale } from '@/utils/i18n';
import './Result.less';

import ResultHeader from './components/ResultHeader';
import SummarySection from './components/SummarySection';
import ResponsibilitySection from './components/ResponsibilitySection';
import JudgmentSection from './components/JudgmentSection';
import EvidenceUploadSection from './components/EvidenceUploadSection';
import RegisterPromptSection from './components/RegisterPromptSection';

const { Text } = Typography;

const AIAnalyzingAnimation = ({ tips }: { tips?: ContentItem[] }) => {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!tips || tips.length === 0) return;
    const timer = setInterval(() => {
      setTipIndex(prev => (prev + 1) % tips.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [tips]);

  const currentTip = tips && tips.length > 0 ? tips[tipIndex] : null;

  return (
    <div className="ai-analyzing-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360],
          filter: ['hue-rotate(0deg)', 'hue-rotate(90deg)', 'hue-rotate(0deg)']
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        style={{
          width: 80, height: 80, margin: '0 auto 30px', borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #0EA5E9, #FF7043, #0EA5E9)',
          boxShadow: '0 0 30px rgba(14, 165, 233, 0.5)'
        }}
      />
      <motion.h2
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ color: '#fff', fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}
      >
        {t('quickResult.analyzingTitle')}
      </motion.h2>
      <Text style={{ color: '#94A3B8', fontSize: '16px', display: 'block', marginBottom: 32 }}>
        {t('quickResult.analyzingSubtitle')}
      </Text>

      {currentTip && (
        <AnimatePresence mode="wait">
          <motion.div
            key={tipIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            style={{
              maxWidth: 480, margin: '0 auto', padding: '20px 24px',
              background: 'rgba(255,255,255,0.06)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <BulbOutlined style={{ color: '#FBBF24', fontSize: 16 }} />
              <Text strong style={{ color: '#FBBF24', fontSize: 13 }}>{currentTip.title}</Text>
            </div>
            <Text style={{ color: '#CBD5E1', fontSize: 14, lineHeight: 1.7, display: 'block', textAlign: 'left' }}>
              {currentTip.content}
            </Text>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

const QuickExperienceResult = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoading, error } = useJudgmentStore();
  const mountedRef = useMountedRef();

  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(true);
  const [judgmentError, setJudgmentError] = useState<string | null>(null);
  const [judgmentErrorCode, setJudgmentErrorCode] = useState<string | null>(null);
  const [caseStatus, setCaseStatus] = useState<string | null>(null);
  const [judgmentFailureReason, setJudgmentFailureReason] = useState<string | null>(null);
  const [evidenceUploadStatus, setEvidenceUploadStatus] = useState<'success' | 'failed' | 'pending' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [tips, setTips] = useState<ContentItem[]>([]);
  const { session } = useSessionStore();
  const pollingEverStartedRef = useRef(false);
  const stopPollingRef = useRef<(() => void) | null>(null);

  const loadTips = useCallback(async () => {
    try {
      const locale = getLocale();
      const lang = locale.startsWith('en') ? 'en' : 'zh';
      const items = await getContentList({ type: 'tip', language: lang, limit: 10 });
      if (mountedRef.current && items && items.length > 0) setTips(items);
    } catch { /* tips are non-critical */ }
  }, [mountedRef]);

  useEffect(() => { loadTips(); }, [loadTips]);

  const caseSessionId = id ? caseSessionMap.get(id) || sessionStorage.get() || session?.session_id : null;

  const fetchJudgment = async (): Promise<Judgment | null> => {
    if (!id) {
      if (mountedRef.current) {
        message.error(t('message.caseIdMissing'));
        navigate('/quick-experience/create');
      }
      return null;
    }

    try {
      const judgmentData = await getJudgmentByCaseId(id, caseSessionId ?? undefined);
      if (!mountedRef.current) return judgmentData;
      if (judgmentData) {
        setJudgment(judgmentData);
        return judgmentData;
      }
      return null;
    } catch (error: unknown) {
      if (!mountedRef.current) return null;
      const err = error as { code?: string; message?: string };
      if (err.code === 'JUDGMENT_PENDING' || err.code === 'HTTP_404' || err.code === 'JUDGMENT_NOT_FOUND') {
        return null;
      }
      if (err.code === 'JUDGMENT_FAILED') {
        setJudgmentErrorCode('JUDGMENT_FAILED');
        setJudgmentError(err.message ?? t('message.judgmentRetryHint'));
        stopPollingRef.current?.();
        return null;
      }
      if (err.code === 'SESSION_EXPIRED' || err.code === 'SESSION_ID_REQUIRED' || err.code === 'INVALID_SESSION_ID') {
        setJudgmentErrorCode(err.code as string);
        setJudgmentError(err.message ?? t('error.session.expiredHint'));
        return null;
      }
      logger.error('Failed to fetch judgment', error);
      setJudgmentErrorCode(err.code ?? 'UNKNOWN');
      setJudgmentError(err.message ?? t('message.getJudgmentFail'));
      return null;
    }
  };

  const responsibilityRatioMemo = useMemo(() =>
    judgment ? (judgment.responsibility_ratio ?? { plaintiff: judgment.plaintiff_ratio, defendant: judgment.defendant_ratio })
             : { plaintiff: 0, defendant: 0 },
    [judgment]
  );

  const { startPolling, stopPolling, isPolling } = usePolling(
    fetchJudgment,
    POLLING_INTERVAL,
    (data) => data !== null,
    { maxAttempts: 30, maxDuration: 5 * 60 * 1000, exponentialBackoff: true, initialInterval: POLLING_INTERVAL, maxInterval: 30 * 1000 }
  );
  stopPollingRef.current = stopPolling;

  const fetchCase = async () => {
    const caseId = id as string;
    try {
      const case_ = await getCase(caseId, caseSessionId ?? undefined);
      const status = case_.status;
      setCaseStatus(status);
      if (status === 'judgment_failed' && case_.judgment_failure_reason) {
        setJudgmentFailureReason(case_.judgment_failure_reason);
      }

      const canUploadEvidence = ['draft', 'submitted', 'in_progress'].includes(status);
      if (!canUploadEvidence) {
        setEvidenceUploadStatus(null);
        localStorage.removeItem(`pending_evidence_${caseId}`);
        return case_;
      }

      if (case_.evidences && Array.isArray(case_.evidences) && case_.evidences.length > 0) {
        setEvidenceUploadStatus('success');
      } else if (localStorage.getItem(`pending_evidence_${caseId}`)) {
        setEvidenceUploadStatus('pending');
      } else {
        setEvidenceUploadStatus(null);
      }
      return case_;
    } catch (error) {
      const err = error as { code?: string };
      if (err?.code === 'NOT_FOUND' || err?.code === 'HTTP_404') {
        caseSessionMap.remove(caseId);
        message.warning(t('message.caseNotFoundOrExpired'));
        navigate('/quick-experience/create', { replace: true });
        return null;
      }
      logger.error('Failed to fetch case', error);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (id) fetchCase().then(c => {
      if (cancelled) return;
      if (c?.status === 'judgment_failed') {
        setJudgmentErrorCode('JUDGMENT_FAILED');
        setJudgmentError(t('message.judgmentRetryHint'));
        stopPolling();
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stopPolling]);

  const handleRetryJudgment = async () => {
    const caseId = id as string;
    setJudgmentError(null); setJudgmentErrorCode(null); setJudgmentFailureReason(null); setJudgment(null);
    try {
      const { generateJudgment } = await import('@/services/api/judgment');
      await generateJudgment(caseId, caseSessionId ?? undefined);
      if (!mountedRef.current) return;
      message.success(t('message.judgmentRegenSuccess'));
      startPolling();
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const msg = (error as { message?: string })?.message || t('message.retryFail');
      message.error(msg);
      setJudgmentError(msg);
    }
  };

  const handleEvidenceUpload = async (fileList: File[]) => {
    const caseId = id as string;
    const filesToUpload = fileList.filter((file) => file instanceof File);
    if (filesToUpload.length === 0) return message.warning(t('message.selectFile'));

    setIsUploading(true); setEvidenceUploadStatus('pending');
    try {
      const sessionIdToUse = caseSessionId || sessionStorage.get() || session?.session_id;
      if (!sessionIdToUse) {
        if (mountedRef.current) {
          message.error(t('message.sessionIdMissing'));
          setEvidenceUploadStatus('failed');
          setIsUploading(false);
        }
        return;
      }
      await uploadEvidence(caseId, filesToUpload, sessionIdToUse);
      if (!mountedRef.current) return;
      message.success(t('message.evidenceUploadSuccess'));
      setEvidenceUploadStatus('success');
      localStorage.removeItem(`pending_evidence_${caseId}`);
      await fetchCase();
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      message.error((error as { message?: string })?.message || t('message.evidenceUploadFail'));
      setEvidenceUploadStatus('failed');
      try { localStorage.setItem(`pending_evidence_${caseId}`, 'true'); } catch { /* noop */ }
    } finally {
      if (mountedRef.current) setIsUploading(false);
    }
  };

  useEffect(() => {
    setJudgment(null);
    setJudgmentError(null);
    setJudgmentErrorCode(null);
    setJudgmentFailureReason(null);
    setCaseStatus(null);
    setEvidenceUploadStatus(null);
    pollingEverStartedRef.current = false;
    fetchJudgment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (!judgment && id && !judgmentError && caseStatus !== 'judgment_failed') {
      pollingEverStartedRef.current = true;
      startPolling();
    } else stopPolling();
    return () => stopPolling();
  }, [judgment, id, judgmentError, caseStatus, startPolling, stopPolling]);

  if (isLoading && !judgment) return <div className="loading-container"><AIAnalyzingAnimation tips={tips} /></div>;

  if (error && !judgment) return (
    <div className="error-container">
      <Alert title={t('error.fetch.title')} description={error} type="error" showIcon />
      <button className="action-button primary" onClick={() => navigate('/quick-experience/create')} style={{marginTop: 24}}>
        {t('error.back')}
      </button>
    </div>
  );

  if (judgmentError !== null || caseStatus === 'judgment_failed') {
    const isSessionExpired = ['SESSION_EXPIRED', 'SESSION_ID_REQUIRED', 'INVALID_SESSION_ID'].includes(judgmentErrorCode!);
    const isJudgmentFailed = judgmentErrorCode === 'JUDGMENT_FAILED' || caseStatus === 'judgment_failed';
    return (
      <div className="error-container">
        <Alert
          title={isSessionExpired ? t('error.session.title') : isJudgmentFailed ? t('error.judgment.title') : t('error.fetch.title')}
          description={isJudgmentFailed && judgmentFailureReason ? `${t('error.judgment.failureReasonPrefix')}${judgmentFailureReason}` : judgmentError || (isSessionExpired ? t('error.session.expiredHint') : t('message.retryOrLater'))}
          type="error"
          showIcon
          action={
            isSessionExpired ? <Button type="primary" onClick={() => navigate('/quick-experience/create')}>{t('result.restart')}</Button>
            : isJudgmentFailed ? <Button type="primary" onClick={handleRetryJudgment}>{t('error.retry')}</Button>
            : <Button type="primary" onClick={() => { setJudgmentError(null); setJudgmentErrorCode(null); pollingEverStartedRef.current = true; startPolling(); }}>{t('error.retry')}</Button>
          }
        />
        <button className="action-button secondary" onClick={() => navigate('/quick-experience/create')} style={{marginTop: 24}}>
          {t('error.back')}
        </button>
      </div>
    );
  }

  if (!judgment) {
    const isTimeout = pollingEverStartedRef.current && !isPolling;
    return (
      <div className="loading-container">
        {isTimeout ? (
          <Alert
            title={t('pending.long.message')}
            description={t('pending.long.desc')}
            type="warning"
            showIcon
            action={
              <Space>
                <Button type="primary" onClick={() => { pollingEverStartedRef.current = true; startPolling(); }}>{t('pending.long.action.wait')}</Button>
                <Button onClick={handleRetryJudgment}>{t('pending.long.action.regen')}</Button>
              </Space>
            }
          />
        ) : <AIAnalyzingAnimation tips={tips} />}
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('result.title')}
        description={`${t('responsibility.title')}: ${t('quickCreate.roleA')} ${responsibilityRatioMemo.plaintiff}%, ${t('quickCreate.roleB')} ${responsibilityRatioMemo.defendant}%`}
        keywords={t('result.keywords')}
      />
      <div className="quick-experience-result">
        <a href="#judgment-section" className="skip-link">{t('result.skipToJudgment')}</a>
        
        <ResultHeader />
        <SummarySection summary={judgment.summary} />
        <ResponsibilitySection ratio={responsibilityRatioMemo} />
        {judgment.judgment_content && <JudgmentSection content={judgment.judgment_content} />}

        <EvidenceUploadSection status={evidenceUploadStatus} caseId={id as string} isUploading={isUploading} onUploadFiles={handleEvidenceUpload} />

        <section className="actions-section">
          <div className="container">
            <div className="primary-actions">
              <button className="action-button primary" onClick={() => navigate('/auth/register')}>
                <LockOutlined style={{ marginRight: 8 }} /> {t('register.action.now')}
              </button>
              <button className="action-button secondary" onClick={() => navigate('/quick-experience/create')}>
                <RetweetOutlined style={{ marginRight: 8 }} /> {t('quickCreate.recoveredCase.startNew')}
              </button>
            </div>
          </div>
        </section>

        <RegisterPromptSection show={showRegisterPrompt} onRegister={() => navigate('/auth/register')} onClose={() => setShowRegisterPrompt(false)} />
      </div>
    </>
  );
};

export default QuickExperienceResult;
