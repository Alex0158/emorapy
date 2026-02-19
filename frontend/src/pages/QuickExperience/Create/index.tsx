/**
 * 快速體驗 - 創建案件頁面（優化版）
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Progress,
  Space,
  Typography,
  Tabs,
  Collapse,
  message,
  Alert,
} from 'antd';
import {
  LockOutlined,
} from '@ant-design/icons';
import { useSessionStore } from '@/store/sessionStore';
import { useCaseStore } from '@/store/caseStore';
import { getCaseBySessionId } from '@/services/api/case';
import { validateStatement } from '@/utils/validate';
import { MAX_IMAGE_COUNT, MIN_DEFENDANT_LENGTH } from '@/utils/constants';
import { localStore, sessionStorage, caseSessionMap } from '@/utils/storage';
import BearJudge from '@/components/business/BearJudge';
import StatementInput from '@/components/business/StatementInput';
import FileUpload from '@/components/business/FileUpload';
import KeyboardShortcuts from '@/components/common/KeyboardShortcuts';
import GuideTooltip from '@/components/common/GuideTooltip';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useKeyboardNavigation } from '@/hooks/useAccessibility';
import type { UploadFile } from 'antd/es/upload/interface';
import SEO from '@/components/common/SEO';
import { t } from '@/utils/i18n';
import './Create.less';

const { Title, Text } = Typography;

const DRAFT_STORAGE_KEY = 'quick_case_draft';

interface CaseDraft {
  plaintiffStatement: string;
  defendantStatement: string;
  evidenceUrls: string[];
}

const QuickExperienceCreate = () => {
  const navigate = useNavigate();
  const { session, createSession, setSession } = useSessionStore();
  const { createQuickCase, isLoading } = useCaseStore();

  const { width } = useWindowSize();
  // 布局模式：'horizontal' | 'vertical'（根據屏幕寬度自動切換）
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>(
    width >= 768 ? 'horizontal' : 'vertical'
  );
  const [plaintiffStatement, setPlaintiffStatement] = useState('');
  const [defendantStatement, setDefendantStatement] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<UploadFile[]>([]);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [isGeneratingDefendant, setIsGeneratingDefendant] = useState(false);
  const [recoveredCase, setRecoveredCase] = useState<{ id: string; status: string } | null>(null);
  const submitLockRef = useRef(false);

  // 根據屏幕寬度自動切換布局
  useEffect(() => {
    setLayoutMode(width >= 768 ? 'horizontal' : 'vertical');
  }, [width]);

  // 初始化Session
  useEffect(() => {
    // 僅在創建頁主動處理 Session（避免覆蓋舊 session_id）
    const existingSessionId = sessionStorage.get() || session?.session_id;
    if (!existingSessionId) {
      createSession().catch(() => {
        // Session創建失敗，靜默處理（用戶仍可繼續使用）
      });
    }
  }, [session, createSession]);

  // 刷新找回案件：若有 sessionId 且後端有對應案件，提示「繼續查看」
  // 404 時 getCaseBySessionId 已 return null 不拋錯；401 由 request 攔截器統一 clearSession + refreshSession，此處僅靜默吞錯
  useEffect(() => {
    const sessionId = sessionStorage.get() || session?.session_id;
    if (!sessionId) return;
    getCaseBySessionId(sessionId)
      .then((case_) => {
        if (case_ && ['submitted', 'in_progress', 'completed', 'judgment_failed'].includes(case_.status)) {
          setRecoveredCase({ id: case_.id, status: case_.status });
        }
      })
      .catch(() => {});
  }, [session?.session_id]);

  // 自動保存草稿
  useEffect(() => {
    const timer = setInterval(() => {
      if (plaintiffStatement || defendantStatement) {
        const draft: CaseDraft = {
          plaintiffStatement,
          defendantStatement,
          evidenceUrls: evidenceFiles.map((f: { url?: string }) => f.url || '').filter(Boolean),
        };
        localStore.set(DRAFT_STORAGE_KEY, draft);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(null), 3000);
      }
    }, 30000); // 每30秒保存一次

    return () => {
      clearInterval(timer);
    };
  }, [plaintiffStatement, defendantStatement, evidenceFiles]);

  // 恢復草稿
  useEffect(() => {
    const draft = localStore.get<CaseDraft>(DRAFT_STORAGE_KEY);
    if (draft) {
      setPlaintiffStatement(draft.plaintiffStatement || '');
      setDefendantStatement(draft.defendantStatement || '');
      // 證據文件需要重新上傳，不恢復
    }
  }, []);

  // 計算完成度
  const calculateProgress = useCallback(() => {
    let progress = 0;
    const plaintiffValid = validateStatement(plaintiffStatement).valid;
    const defendantLen = defendantStatement.trim().length;
    const defendantValid = defendantLen === 0
      ? true
      : defendantLen >= MIN_DEFENDANT_LENGTH;

    if (plaintiffValid) progress += 70;
    if (defendantValid) progress += 30;

    return Math.min(progress, 100);
  }, [plaintiffStatement, defendantStatement]);

  const progress = calculateProgress();
  const canSubmit = validateStatement(plaintiffStatement).valid;

  // 鍵盤快捷鍵（使用useMemo優化）
  const shortcuts = useMemo(
    () => [
      {
        key: 'ctrl+s',
        description: t('message.shortcutSaveDraft'),
        action: () => {
          const draft: CaseDraft = {
            plaintiffStatement,
            defendantStatement,
            evidenceUrls: evidenceFiles.map((f: { url?: string }) => f.url || '').filter(Boolean),
          };
          localStore.set(DRAFT_STORAGE_KEY, draft);
          message.success(t('message.draftSaved'));
        },
      },
      {
        key: 'ctrl+enter',
        description: t('message.shortcutSubmit'),
        action: () => {
          if (canSubmit) {
            handleSubmit();
          }
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSubmit 不進 deps 避免重建表單配置
    [plaintiffStatement, defendantStatement, evidenceFiles, canSubmit]
  );

  // 模板 & 代寫
  const templates = useMemo(
    () => [
      t('quickCreate.template1'),
      t('quickCreate.template2'),
      t('quickCreate.template3'),
    ],
    []
  );

  const applyTemplate = (text: string, target: 'plaintiff' | 'defendant') => {
    if (target === 'plaintiff') setPlaintiffStatement(text);
    else setDefendantStatement(text);
  };

  const handleAutoGenerateDefendant = () => {
    if (!plaintiffStatement.trim()) {
      message.info(t('message.fillPlaintiffFirst'));
      return;
    }
    setIsGeneratingDefendant(true);
    const source = plaintiffStatement.slice(0, 120);
    const draft = t('quickCreate.defendantDraftTemplate').replace('{source}', source);
    setTimeout(() => {
      setDefendantStatement(draft);
      setIsGeneratingDefendant(false);
      message.success(t('message.defendantDraftDone'));
    }, 300);
  };

  // 鍵盤導航支持
  useKeyboardNavigation(
    () => {
      if (canSubmit) {
        handleSubmit();
      }
    },
    undefined,
    undefined,
    undefined,
    canSubmit
  );

  // 處理提交
  const handleSubmit = async () => {
    if (submitLockRef.current) {
      return;
    }
    if (!canSubmit) {
      message.warning(t('message.completePlaintiff'));
      return;
    }

    submitLockRef.current = true;
    try {
      if (!sessionStorage.get() && !session?.session_id) {
        await createSession().catch(() => {});
      }

      // 創建案件（快速體驗模式）
      const result = await createQuickCase({
        plaintiff_statement: plaintiffStatement.trim(),
        defendant_statement: defendantStatement.trim() || '',
        evidence_urls: [], // 證據將在案件創建後上傳
      });

      // 如果返回了session_id，更新Session 並保存 caseId->sessionId 映射（支援多案件回訪）
      if (result.session_id) {
        sessionStorage.set(result.session_id);
        caseSessionMap.set(result.case.id, result.session_id);
        // 同步 Session Store（後端回傳 expires_at，避免 24h/7d 延長不一致）
        if (result.session_expires_at) {
          setSession({
            session_id: result.session_id,
            expires_at: result.session_expires_at,
          });
        }
      }

      // 如果有證據文件，上傳證據
      const filesToUpload = evidenceFiles
        .filter((f): f is UploadFile & { originFileObj: File } => Boolean(f?.originFileObj))
        .map((f) => f.originFileObj);

      if (filesToUpload.length > 0) {
        try {
          const { uploadEvidence } = await import('@/services/api/case');
          // 優先使用返回的session_id，否則使用store中的session
          const sessionIdToUse = result.session_id || sessionStorage.get() || session?.session_id;
          
          if (!sessionIdToUse) {
            message.warning(t('message.sessionIdMissing'));
            return;
          }
          
          await uploadEvidence(result.case.id, filesToUpload as File[], sessionIdToUse);
          message.success(t('message.evidenceUploadSuccess'));
        } catch (uploadError: unknown) {
          // 證據上傳失敗不阻止流程，只提示
          // 標記結果頁可補傳證據
          localStorage.setItem(`pending_evidence_${result.case.id}`, 'true');
          const msg = uploadError instanceof Error ? uploadError.message : t('message.evidenceUploadFailCaseCreated');
          message.warning(msg);
        }
      }

      // 清除草稿
      localStore.remove(DRAFT_STORAGE_KEY);

      // 跳轉到判決結果頁面（使用案件ID）
      navigate(`/quick-experience/result/${result.case.id}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('message.submitFail');
      message.error(msg);
    } finally {
      submitLockRef.current = false;
    }
  };


  return (
    <>
      <SEO
        title={t('quickCreate.title')}
        description={t('quickCreate.description')}
        keywords={t('quickCreate.keywords')}
      />
      <div className="quick-experience-create" role="main" aria-label={t('quickCreate.pageLabel')}>
        <a href="#input-section" className="skip-link">
          {t('quickCreate.skipToInput')}
        </a>

        {recoveredCase && (
          <Alert
            title={t('quickCreate.recoveredCase.title')}
            description={t('quickCreate.recoveredCase.desc')}
            type="info"
            showIcon
            action={
              <Space>
                <Button size="small" type="primary" onClick={() => navigate(`/quick-experience/result/${recoveredCase.id}`)}>
                  {t('quickCreate.recoveredCase.continue')}
                </Button>
                <Button size="small" onClick={() => setRecoveredCase(null)}>
                  {t('quickCreate.recoveredCase.startNew')}
                </Button>
              </Space>
            }
            closable
            onClose={() => setRecoveredCase(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        <AnimatedWrapper animation="fade" delay={100}>
          <section className="guide-section" aria-labelledby="guide-title">
            <BearJudge size="medium" animated />
            <Title level={2} id="guide-title" className="guide-title">
              {t('quickCreate.guide.title')}
            </Title>
            <Text className="guide-subtitle">{t('quickCreate.guide.subtitle')}</Text>
          </section>
        </AnimatedWrapper>

      {autoSaveStatus === 'saved' && (
        <Alert
          title={t('quickCreate.autoSaved')}
          type="success"
          showIcon
          closable
          style={{ margin: '16px auto', maxWidth: 1200 }}
        />
      )}

        {/* 單人雙角色輸入區域 */}
        <AnimatedWrapper animation="slide" direction="up" delay={200} trigger="intersection">
          <section id="input-section" className="input-section" aria-labelledby="input-section-title">
            <div className="container">
              {/* 布局選擇器 */}
              <div className="layout-selector" role="group" aria-label={t('quickCreate.ariaLayoutSelect')}>
                <Tabs
                  activeKey={layoutMode}
                  onChange={(key) => setLayoutMode(key as 'horizontal' | 'vertical')}
                  items={[
                    { key: 'horizontal', label: t('quickCreate.layout.horizontal') },
                    { key: 'vertical', label: t('quickCreate.layout.vertical') },
                  ]}
                  aria-label={t('quickCreate.ariaLayoutMode')}
                />
              </div>

              {/* 輸入區域 */}
              <div className={`input-area ${layoutMode}`} role="group" aria-label={t('quickCreate.ariaInputArea')}>
                {/* 角色A輸入區 */}
                <AnimatedWrapper animation="fade" delay={300} trigger="intersection">
                  <Card
                    className="statement-card plaintiff-card"
                    role="article"
                    aria-labelledby="plaintiff-title"
                    tabIndex={0}
                  >
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <span className="role-badge role-a" aria-hidden="true">
                    {t('quickCreate.roleA')}
                  </span>
                  <Title level={4} id="plaintiff-title" className="card-title">
                    {t('quickCreate.plaintiffTitle')}
                  </Title>
                </div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 14, color: '#64748B' }}>
                  請具體描述事件與感受（至少需要30字）
                </Text>

                    <StatementInput
                      value={plaintiffStatement}
                      onChange={setPlaintiffStatement}
                      role="plaintiff"
                      showGuide={true}
                      minLength={30}
                      onValidationChange={() => {
                        // 驗證狀態變化處理
                      }}
                    />
                    <Space size="small" wrap style={{ marginTop: 8 }}>
                      {templates.map((tmpl, idx) => (
                        <Button key={idx} size="small" onClick={() => applyTemplate(tmpl, 'plaintiff')}>
                          {t('quickCreate.applyTemplateN').replace('{n}', String(idx + 1))}
                        </Button>
                      ))}
                    </Space>
                  </Card>
                </AnimatedWrapper>

                {/* 中間分隔區域 */}
                <div className="divider" aria-hidden="true">
                  <BearJudge size="small" animated />
                </div>

                {/* 角色B輸入區 */}
                <AnimatedWrapper animation="fade" delay={400} trigger="intersection">
                  <Card
                    className="statement-card defendant-card"
                    role="article"
                    aria-labelledby="defendant-title"
                    tabIndex={0}
                  >
                <div className="card-header" style={{ marginBottom: 12 }}>
                  <span className="role-badge role-b" aria-hidden="true">
                    {t('quickCreate.roleB')}
                  </span>
                  <Title level={4} id="defendant-title" className="card-title">
                    {t('quickCreate.defendantTitle')}
                  </Title>
                </div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 14, color: '#64748B' }}>
                  可選填。若不知如何開口，可點擊下方「自動代寫」
                </Text>

                    <StatementInput
                      value={defendantStatement}
                      onChange={setDefendantStatement}
                      role="defendant"
                      showGuide={true}
                      allowEmpty
                      minLength={MIN_DEFENDANT_LENGTH}
                      onValidationChange={() => {
                        // 驗證狀態變化處理
                      }}
                    />
                <Space size="small" wrap style={{ marginTop: 8 }}>
                  <Button size="small" onClick={() => applyTemplate(templates[0], 'defendant')}>
                    {t('quickCreate.applyTemplate')}
                  </Button>
                  <Button size="small" loading={isGeneratingDefendant} onClick={handleAutoGenerateDefendant}>
                    {t('quickCreate.autoWrite')}
                  </Button>
                </Space>
                <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                  {t('quickCreate.defendantHint').replace('{min}', String(MIN_DEFENDANT_LENGTH))}
                </Text>
              </Card>
            </AnimatedWrapper>
              </div>
            </div>
          </section>
        </AnimatedWrapper>

      {/* 證據上傳區域（可選） */}
      <section className="evidence-section">
        <div className="container">
          <Collapse
            defaultActiveKey={[]}
            items={[
              {
                key: 'evidence',
                label: t('quickCreate.evidenceHeader'),
                children: (
                  <>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                      {t('quickCreate.evidenceHint')}
                    </Text>
                    <FileUpload
                      value={evidenceFiles}
                      onChange={setEvidenceFiles}
                      maxCount={MAX_IMAGE_COUNT}
                    />
                  </>
                ),
              },
            ]}
          />
        </div>
      </section>

      {/* 註冊引導區域 */}
      {showRegisterPrompt && (
        <section className="register-prompt-section">
          <div className="container">
            <Alert
              title={
                <Space>
                  <LockOutlined />
                  <span>{t('quickCreate.registerMessage')}</span>
                </Space>
              }
              description={t('register.prompt.desc')}
              type="info"
              action={
                <Space>
                  <Button size="small" onClick={() => navigate('/auth/register')}>
                    {t('register.action.now')}
                  </Button>
                  <Button size="small" type="text" onClick={() => setShowRegisterPrompt(false)}>
                    {t('quickCreate.close')}
                  </Button>
                </Space>
              }
              closable
              onClose={() => setShowRegisterPrompt(false)}
            />
          </div>
        </section>
      )}

      {/* 鍵盤快捷鍵支持 */}
      <KeyboardShortcuts shortcuts={shortcuts} showHelp={true} />

        {/* 提交區域 */}
        <AnimatedWrapper animation="slide" direction="up" delay={500} trigger="intersection">
          <section className="submit-section" aria-labelledby="submit-section-title">
            <div className="container">
              {canSubmit && (
                <div className="progress-display" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <Progress percent={progress} status="success" />
                  <Text>{t('quickCreate.progressDone').replace('{percent}', String(progress))}</Text>
                </div>
              )}

              <div className="submit-actions">
                <GuideTooltip
                  content={t('quickCreate.submitHint')}
                  storageKey="quick_submit_guide"
                  placement="top"
                >
                  <Button
                    type="primary"
                    size="large"
                    loading={isLoading}
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                    className="submit-button"
                    aria-label={canSubmit ? t('quickCreate.submitAriaReady') : t('quickCreate.submitAriaDisabled')}
                    aria-describedby="submit-hints"
                  >
                    {isLoading ? t('quickCreate.submitting') : t('quickCreate.submit')}
                  </Button>
                </GuideTooltip>

                <div id="submit-hints" className="submit-hints">
                  <Text type="secondary">{t('quickCreate.afterSubmit')}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('quickCreate.eta')}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('quickCreate.quickNote')}
                  </Text>
                </div>
              </div>
            </div>
          </section>
        </AnimatedWrapper>
      </div>
    </>
  );
};

export default QuickExperienceCreate;
