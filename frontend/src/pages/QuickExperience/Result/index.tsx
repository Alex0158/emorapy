/**
 * 快速體驗 - 判決結果頁面（優化版）
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Spin, Alert, message, Button, Space } from 'antd';
import {
} from '@ant-design/icons';
import { useJudgmentStore } from '@/store/judgmentStore';
import { getJudgmentByCaseId } from '@/services/api/judgment';
import { getCase, uploadEvidence } from '@/services/api/case';
import type { Judgment } from '@/types/judgment';
import Skeleton from '@/components/common/Skeleton';
import { usePolling } from '@/hooks/usePolling';
import { POLLING_INTERVAL } from '@/utils/constants';
import { useSessionStore } from '@/store/sessionStore';
import { sessionStorage, caseSessionMap } from '@/utils/storage';
import SEO from '@/components/common/SEO';
import { logger } from '@/utils/logger';
import { t } from '@/utils/i18n';
import './Result.less';
import ResultHeader from './components/ResultHeader';
import SummarySection from './components/SummarySection';
import ResponsibilitySection from './components/ResponsibilitySection';
import JudgmentSection from './components/JudgmentSection';
import EvidenceUploadSection from './components/EvidenceUploadSection';
import ActionsSection from './components/ActionsSection';
import RegisterPromptSection from './components/RegisterPromptSection';

const { Text } = Typography;

const QuickExperienceResult = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoading, error } = useJudgmentStore();

  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(true);
  const [judgmentError, setJudgmentError] = useState<string | null>(null);
  const [judgmentErrorCode, setJudgmentErrorCode] = useState<string | null>(null);
  const [caseStatus, setCaseStatus] = useState<string | null>(null);
  const [judgmentFailureReason, setJudgmentFailureReason] = useState<string | null>(null);
  const [evidenceUploadStatus, setEvidenceUploadStatus] = useState<'success' | 'failed' | 'pending' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { session, refreshSession } = useSessionStore();
  const pollingEverStartedRef = useRef(false);
  const stopPollingRef = useRef<(() => void) | null>(null);

  // 案件對應的 Session ID（支援多案件回訪，避免 session 覆寫導致舊案件無法訪問）
  const caseSessionId = id
    ? caseSessionMap.get(id) || sessionStorage.get() || session?.session_id
    : null;

  // 獲取判決（支持輪詢）
  const fetchJudgment = async (): Promise<Judgment | null> => {
    if (!id) {
      message.error(t('message.caseIdMissing'));
      navigate('/quick-experience/create');
      return null;
    }

    try {
      const judgmentData = await getJudgmentByCaseId(id, caseSessionId ?? undefined);
      if (judgmentData) {
        setJudgment(judgmentData);
        return judgmentData;
      }
      return null;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      // 判決尚未生成：視為正常pending，繼續輪詢（不輸出錯誤）
      if (err.code === 'JUDGMENT_PENDING' || err.code === 'HTTP_404' || err.code === 'JUDGMENT_NOT_FOUND') {
        return null;
      }
      // 判決生成失敗：立即停止輪詢並顯示重試（避免重複 409）
      if (err.code === 'JUDGMENT_FAILED') {
        setJudgmentErrorCode('JUDGMENT_FAILED');
        setJudgmentError(err.message ?? t('message.judgmentRetryHint'));
        stopPollingRef.current?.();
        return null;
      }

      // Session 過期/缺失：提示重新開始（不應導向登入）
      if (
        err.code === 'SESSION_EXPIRED' ||
        err.code === 'SESSION_ID_REQUIRED' ||
        err.code === 'INVALID_SESSION_ID'
      ) {
        try {
          await refreshSession(true);
        } catch {
          // 靜默失敗，仍提示用戶重新開始
        }
        setJudgmentErrorCode(err.code ?? '');
        setJudgmentError(err.message ?? t('error.session.expiredHint'));
        return null;
      }

      // 其他錯誤：提示並停止輪詢（避免無意義輪詢）
      logger.error('Failed to fetch judgment', error);
      setJudgmentErrorCode(err.code ?? 'UNKNOWN');
      setJudgmentError(err.message ?? t('message.getJudgmentFail'));
      return null;
    }
  };

  // 責任比例（須在 early return 前調用 useMemo，符合 rules-of-hooks）
  const responsibilityRatioMemo = useMemo(
    () =>
      judgment
        ? (judgment.responsibility_ratio ?? {
            plaintiff: judgment.plaintiff_ratio,
            defendant: judgment.defendant_ratio,
          })
        : { plaintiff: 0, defendant: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 已用 judgment 欄位作為 deps
    [judgment?.plaintiff_ratio, judgment?.defendant_ratio, judgment?.responsibility_ratio]
  );

  // 輪詢判決狀態（如果判決尚未生成）
  // 注意：必須在任何引用 startPolling/stopPolling 的 useEffect 之前聲明，避免 TDZ（ReferenceError）
  const { startPolling, stopPolling, isPolling } = usePolling(
    fetchJudgment,
    POLLING_INTERVAL,
    (data) => data !== null, // 找到判決時停止
    {
      maxAttempts: 30,        // 最多30次
      maxDuration: 5 * 60 * 1000, // 最多5分鐘
      exponentialBackoff: true,
      initialInterval: POLLING_INTERVAL,  // 初始5秒
      maxInterval: 30 * 1000, // 最大30秒
    }
  );
  stopPollingRef.current = stopPolling;

  // 獲取案件狀態
  const fetchCase = async () => {
    if (!id) return null;
    
    try {
      const case_ = await getCase(id, caseSessionId ?? undefined);
      const status = case_.status;
      setCaseStatus(status);
      if (status === 'judgment_failed' && case_.judgment_failure_reason) {
        setJudgmentFailureReason(case_.judgment_failure_reason);
      }

      const canUploadEvidence = ['draft', 'submitted', 'in_progress'].includes(status);
      if (!canUploadEvidence) {
        setEvidenceUploadStatus(null);
        localStorage.removeItem(`pending_evidence_${id}`);
        return case_;
      }

      // 檢查證據上傳狀態
      const evidences = case_.evidences;
      if (evidences && Array.isArray(evidences) && evidences.length > 0) {
        setEvidenceUploadStatus('success');
      } else {
        // 檢查是否有待上傳的證據（從localStorage）
        const pendingEvidence = localStorage.getItem(`pending_evidence_${id}`);
        if (pendingEvidence) {
          setEvidenceUploadStatus('pending');
        } else {
          // 只有在明確知道有證據需要上傳時才顯示失敗狀態
          // 否則不顯示（因為可能用戶本來就沒有上傳證據）
          setEvidenceUploadStatus(null);
        }
      }
      
      return case_;
    } catch (error) {
      const err = error as { code?: string };
      if (id && (err?.code === 'NOT_FOUND' || err?.code === 'HTTP_404')) {
        caseSessionMap.remove(id);
        message.warning(t('message.caseNotFoundOrExpired'));
        navigate('/quick-experience/create', { replace: true });
        return null;
      }
      logger.error('Failed to fetch case', error);
      return null;
    }
  };

  // 檢查案件狀態
  useEffect(() => {
    const checkCaseStatus = async () => {
      const case_ = await fetchCase();
      if (case_) {
        setCaseStatus(case_.status);
        if (case_.status === 'judgment_failed') {
          setJudgmentErrorCode('JUDGMENT_FAILED');
          setJudgmentError(t('message.judgmentRetryHint'));
          stopPolling(); // 停止輪詢
        }
      }
    };
    
    if (id) {
      checkCaseStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 id/stopPolling 變化時跑，fetchCase 不進 deps
  }, [id, stopPolling]);

  // 重試生成判決
  const handleRetryJudgment = async () => {
    if (!id) return;
    
    setJudgmentError(null);
    setJudgmentErrorCode(null);
    setJudgmentFailureReason(null);
    setJudgment(null);
    
    try {
      const { generateJudgment } = await import('@/services/api/judgment');
      await generateJudgment(id, caseSessionId ?? undefined);
      message.success(t('message.judgmentRegenSuccess'));
      // 重新開始輪詢
      startPolling();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.retryFail');
      message.error(msg);
      setJudgmentError(msg);
    }
  };

  // 處理證據上傳
  const handleEvidenceUpload = async (fileList: File[]) => {
    if (!id) {
      message.error(t('message.caseIdMissing'));
      return;
    }

    const filesToUpload = fileList.filter((file) => file instanceof File);
    if (filesToUpload.length === 0) {
      message.warning(t('message.selectFile'));
      return;
    }

    setIsUploading(true);
    setEvidenceUploadStatus('pending');

    try {
      // 優先使用案件對應的 sessionId（支援多案件回訪），其次 localStorage，最後 store
      const sessionIdToUse = caseSessionId || sessionStorage.get() || session?.session_id;
      if (!sessionIdToUse) {
        message.error(t('message.sessionIdMissing'));
        setEvidenceUploadStatus('failed');
        setIsUploading(false);
        return;
      }

      await uploadEvidence(id, filesToUpload, sessionIdToUse);
      message.success(t('message.evidenceUploadSuccess'));
      setEvidenceUploadStatus('success');
      
      // 清除待上傳標記
      localStorage.removeItem(`pending_evidence_${id}`);
      
      // 重新獲取案件數據
      await fetchCase();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.evidenceUploadFail');
      message.error(msg);
      setEvidenceUploadStatus('failed');
      
      // 保存待上傳標記
      localStorage.setItem(`pending_evidence_${id}`, 'true');
    } finally {
      setIsUploading(false);
    }
  };

  // 初始獲取
  useEffect(() => {
    fetchJudgment();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 僅在 id 變化時拉取
  }, [id]);

  useEffect(() => {
    // 有明確錯誤或已知失敗時，不再輪詢
    if (!judgment && id && !judgmentError && caseStatus !== 'judgment_failed') {
      pollingEverStartedRef.current = true;
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [judgment, id, judgmentError, caseStatus, startPolling, stopPolling]);

  if (isLoading && !judgment) {
    return (
      <div className="loading-container">
        <Skeleton type="card" rows={5} />
      </div>
    );
  }

  if (error && !judgment) {
    return (
      <div className="error-container">
        <Alert title={t('error.fetch.title')} description={error} type="error" showIcon />
        <Button type="primary" onClick={() => navigate('/quick-experience/create')}>
          {t('error.back')}
        </Button>
      </div>
    );
  }

  // 顯示判決生成失敗錯誤
  if (judgmentError || caseStatus === 'judgment_failed') {
    const isSessionExpired =
      judgmentErrorCode === 'SESSION_EXPIRED' ||
      judgmentErrorCode === 'SESSION_ID_REQUIRED' ||
      judgmentErrorCode === 'INVALID_SESSION_ID';

    const isJudgmentFailed = judgmentErrorCode === 'JUDGMENT_FAILED' || caseStatus === 'judgment_failed';

    return (
      <div className="error-container">
        <Alert
          title={isSessionExpired ? t('error.session.title') : isJudgmentFailed ? t('error.judgment.title') : t('error.fetch.title')}
          description={
            isJudgmentFailed && judgmentFailureReason
              ? `${t('error.judgment.failureReasonPrefix')}${judgmentFailureReason}`
              : judgmentError ||
                (isSessionExpired
                  ? t('error.session.expiredHint')
                  : isJudgmentFailed
                    ? t('message.judgmentUnavailable')
                    : t('message.retryOrLater'))
          }
          type="error"
          showIcon
          action={
            isSessionExpired ? (
              <Button type="primary" onClick={() => navigate('/quick-experience/create')}>
                {t('result.restart')}
              </Button>
            ) : isJudgmentFailed ? (
              <Button type="primary" onClick={handleRetryJudgment}>
                {t('error.retry')}
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={() => {
                  setJudgmentError(null);
                  setJudgmentErrorCode(null);
                  pollingEverStartedRef.current = true;
                  startPolling();
                }}
              >
                {t('error.retry')}
              </Button>
            )
          }
        />
        <Button
          type="default"
          onClick={() => navigate('/quick-experience/create')}
          style={{ marginTop: 16 }}
        >
          {t('error.back')}
        </Button>
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
                <Button
                  type="primary"
                  onClick={() => {
                    pollingEverStartedRef.current = true;
                    startPolling();
                  }}
                >
                  {t('pending.long.action.wait')}
                </Button>
                <Button type="default" onClick={handleRetryJudgment}>
                  {t('pending.long.action.regen')}
                </Button>
                <Button type="link" onClick={() => navigate('/quick-experience/create')}>
                  {t('pending.long.action.back')}
                </Button>
              </Space>
            }
          />
        ) : (
          <>
            <Spin size="large" description={t('pending.tip')} />
            <Text type="secondary" style={{ marginTop: 16, display: 'block' }}>
              {t('pending.eta')}
            </Text>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('result.title')}
        description={`${t('responsibility.title')}：角色A ${responsibilityRatioMemo.plaintiff}%，角色B ${responsibilityRatioMemo.defendant}%`}
        keywords={t('result.keywords')}
      />
      <div className="quick-experience-result" role="main" aria-label={t('result.title')}>
        {/* 跳過鏈接（可訪問性） */}
        <a href="#judgment-section" className="skip-link">
          {t('result.skipToJudgment')}
        </a>

        <ResultHeader />

        <SummarySection summary={judgment.summary} />

        <ResponsibilitySection ratio={responsibilityRatioMemo} />

        <JudgmentSection content={judgment.judgment_content} />

        {/* 證據上傳狀態 */}
        <EvidenceUploadSection
          status={evidenceUploadStatus}
          caseId={id as string}
          isUploading={isUploading}
          onUploadFiles={handleEvidenceUpload}
        />

        <ActionsSection
          onRegister={() => navigate('/auth/register')}
          onBackToCreate={() => navigate('/quick-experience/create')}
        />

        <RegisterPromptSection
          show={showRegisterPrompt}
          onRegister={() => navigate('/auth/register')}
          onClose={() => setShowRegisterPrompt(false)}
        />
      </div>
    </>
  );
};

export default QuickExperienceResult;
