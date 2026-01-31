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
import { sessionStorage } from '@/utils/storage';
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
  const [evidenceUploadStatus, setEvidenceUploadStatus] = useState<'success' | 'failed' | 'pending' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { session, refreshSession } = useSessionStore();
  const pollingEverStartedRef = useRef(false);

  // 獲取判決（支持輪詢）
  const fetchJudgment = async (): Promise<Judgment | null> => {
    if (!id) {
      message.error(t('message.caseIdMissing'));
      navigate('/quick-experience/create');
      return null;
    }

    try {
      const judgmentData = await getJudgmentByCaseId(id);
      if (judgmentData) {
        setJudgment(judgmentData);
        return judgmentData;
      }
      return null;
    } catch (error: any) {
      // 判決尚未生成：視為正常pending，繼續輪詢（不輸出錯誤）
      if (error.code === 'JUDGMENT_PENDING' || error.code === 'HTTP_404' || error.code === 'JUDGMENT_NOT_FOUND') {
        return null;
      }
      // 判決生成失敗：停止輪詢並顯示重試
      if (error.code === 'JUDGMENT_FAILED') {
        setJudgmentErrorCode('JUDGMENT_FAILED');
        setJudgmentError(error.message || '判決生成失敗，請點擊重試');
        return null;
      }

      // Session 過期/缺失：提示重新開始（不應導向登入）
      if (
        error.code === 'SESSION_EXPIRED' ||
        error.code === 'SESSION_ID_REQUIRED' ||
        error.code === 'INVALID_SESSION_ID'
      ) {
        try {
          await refreshSession(true);
        } catch {
          // 靜默失敗，仍提示用戶重新開始
        }
        setJudgmentErrorCode(error.code);
        setJudgmentError(error.message || '快速體驗Session已過期，請重新開始');
        return null;
      }

      // 其他錯誤：提示並停止輪詢（避免無意義輪詢）
      logger.error('Failed to fetch judgment', error);
      setJudgmentErrorCode(error.code || 'UNKNOWN');
      setJudgmentError(error.message || '獲取判決失敗，請稍後重試');
      return null;
    }
  };

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

  // 獲取案件狀態
  const fetchCase = async () => {
    if (!id) return null;
    
    try {
      const case_ = await getCase(id);
      
      // 檢查證據上傳狀態
      const evidences = (case_ as any).evidences;
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
          setJudgmentError('判決生成失敗，請點擊重試');
          stopPolling(); // 停止輪詢
        }
      }
    };
    
    if (id) {
      checkCaseStatus();
    }
  }, [id, stopPolling]);

  // 重試生成判決
  const handleRetryJudgment = async () => {
    if (!id) return;
    
    setJudgmentError(null);
    setJudgmentErrorCode(null);
    setJudgment(null);
    
    try {
      const { generateJudgment } = await import('@/services/api/judgment');
      await generateJudgment(id);
      message.success(t('message.judgmentRegenSuccess'));
      // 重新開始輪詢
      startPolling();
    } catch (error: any) {
      message.error(error.message || '重試失敗，請稍後再試');
      setJudgmentError(error.message || '重試失敗，請稍後再試');
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
      // 優先使用 localStorage 的 sessionId（避免刷新後 store 尚未恢復）
      const sessionIdToUse = sessionStorage.get() || session?.session_id;
      if (!sessionIdToUse) {
        message.error('Session ID缺失，無法上傳證據');
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
    } catch (error: any) {
      message.error(error.message || '證據上傳失敗');
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
        <Alert message="獲取判決失敗" description={error} type="error" showIcon />
        <Button type="primary" onClick={() => navigate('/quick-experience/create')}>
          返回創建頁面
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
          message={isSessionExpired ? 'Session 已過期' : isJudgmentFailed ? '判決生成失敗' : '獲取判決失敗'}
          description={
            judgmentError ||
            (isSessionExpired
              ? '快速體驗Session已過期，請重新開始'
              : isJudgmentFailed
                ? 'AI服務暫時不可用，請稍後重試'
                : '請稍後再試或點擊重試')
          }
          type="error"
          showIcon
          action={
            isSessionExpired ? (
              <Button type="primary" onClick={() => navigate('/quick-experience/create')}>
                重新開始
              </Button>
            ) : isJudgmentFailed ? (
              <Button type="primary" onClick={handleRetryJudgment}>
                重試
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
                重試
              </Button>
            )
          }
        />
        <Button
          type="default"
          onClick={() => navigate('/quick-experience/create')}
          style={{ marginTop: 16 }}
        >
          返回創建頁面
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
            message="判決生成時間較長"
            description="已暫停自動輪詢，您可以選擇繼續等待，或重新提交生成請求。"
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
                  繼續等待
                </Button>
                <Button type="default" onClick={handleRetryJudgment}>
                  重新生成
                </Button>
                <Button type="link" onClick={() => navigate('/quick-experience/create')}>
                  返回創建頁
                </Button>
              </Space>
            }
          />
        ) : (
          <>
            <Spin size="large" tip="判決正在生成中，請稍候..." />
            <Text type="secondary" style={{ marginTop: 16, display: 'block' }}>
              預計等待時間：30-60秒
            </Text>
          </>
        )}
      </div>
    );
  }

  const responsibility_ratio =
    judgment.responsibility_ratio ?? {
      plaintiff: judgment.plaintiff_ratio,
      defendant: judgment.defendant_ratio,
    };

  // 使用useMemo優化計算
  const responsibilityRatioMemo = useMemo(
    () => responsibility_ratio,
    [responsibility_ratio.plaintiff, responsibility_ratio.defendant]
  );

  return (
    <>
      <SEO
        title="判決結果 - 快速體驗"
        description={`責任分比例：角色A ${responsibility_ratio.plaintiff}%，角色B ${responsibility_ratio.defendant}%`}
        keywords="判決結果,責任分比例,AI判決"
      />
      <div className="quick-experience-result" role="main" aria-label="判決結果頁面">
        {/* 跳過鏈接（可訪問性） */}
        <a href="#judgment-section" className="skip-link">
          跳過到判決內容
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
