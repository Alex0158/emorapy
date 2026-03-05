/**
 * 快速體驗 - 創建案件頁面（極致美學版）
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Button,
  Progress,
  Space,
  Typography,
  Tabs,
  Collapse,
  message,
  Alert,
} from 'antd';
import { LockOutlined, TeamOutlined } from '@ant-design/icons';
import { useSessionStore } from '@/store/sessionStore';
import { useCaseStore } from '@/store/caseStore';
import { getCaseBySessionId } from '@/services/api/case';
import { validateStatement } from '@/utils/validate';
import { MAX_IMAGE_COUNT, MIN_DEFENDANT_LENGTH } from '@/utils/constants';
import { localStore, sessionStorage, caseSessionMap } from '@/utils/storage';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import StatementInput from '@/components/business/StatementInput';
import FileUpload from '@/components/business/FileUpload';
import KeyboardShortcuts from '@/components/common/KeyboardShortcuts';
import GuideTooltip from '@/components/common/GuideTooltip';
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
  const [layoutMode, setLayoutMode] = useState<'horizontal' | 'vertical'>(
    width >= 1024 ? 'horizontal' : 'vertical'
  );
  const [plaintiffStatement, setPlaintiffStatement] = useState('');
  const [defendantStatement, setDefendantStatement] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<UploadFile[]>([]);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [isGeneratingDefendant, setIsGeneratingDefendant] = useState(false);
  const [recoveredCase, setRecoveredCase] = useState<{ id: string; status: string } | null>(null);
  const submitLockRef = useRef(false);
  const mountedRef = useMountedRef();
  const autoGenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLayoutMode(width >= 1024 ? 'horizontal' : 'vertical');
  }, [width]);

  useEffect(() => {
    const existingSessionId = sessionStorage.get() || session?.session_id;
    if (!existingSessionId) {
      createSession().catch((e: unknown) => { logger.warn('Failed to create session', e); });
    }
  }, [session, createSession]);

  useEffect(() => {
    let stale = false;
    const sessionId = sessionStorage.get() || session?.session_id;
    if (!sessionId) return;
    getCaseBySessionId(sessionId)
      .then((case_) => {
        if (stale) return;
        if (case_ && ['submitted', 'in_progress', 'completed', 'judgment_failed'].includes(case_.status)) {
          setRecoveredCase({ id: case_.id, status: case_.status });
        }
      })
      .catch((e: unknown) => { logger.warn('Failed to check case recovery', e); });
    return () => { stale = true; };
  }, [session?.session_id]);

  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout>;
    const timer = setInterval(() => {
      if (plaintiffStatement || defendantStatement) {
        const draft: CaseDraft = {
          plaintiffStatement,
          defendantStatement,
          evidenceUrls: evidenceFiles.map((f: { url?: string }) => f.url || '').filter(Boolean),
        };
        localStore.set(DRAFT_STORAGE_KEY, draft);
        setAutoSaveStatus('saved');
        hideTimeout = setTimeout(() => setAutoSaveStatus(null), 3000);
      }
    }, 30000);
    return () => {
      clearInterval(timer);
      clearTimeout(hideTimeout);
    };
  }, [plaintiffStatement, defendantStatement, evidenceFiles]);

  useEffect(() => {
    const draft = localStore.get<CaseDraft>(DRAFT_STORAGE_KEY);
    if (draft) {
      setPlaintiffStatement(draft.plaintiffStatement || '');
      setDefendantStatement(draft.defendantStatement || '');
    }
  }, []);

  const calculateProgress = useCallback(() => {
    let progress = 0;
    const plaintiffValid = validateStatement(plaintiffStatement).valid;
    const defendantLen = defendantStatement.trim().length;
    const defendantValid = defendantLen === 0 ? true : defendantLen >= MIN_DEFENDANT_LENGTH;
    if (plaintiffValid) progress += 70;
    if (defendantValid) progress += 30;
    return Math.min(progress, 100);
  }, [plaintiffStatement, defendantStatement]);

  const progress = calculateProgress();
  const canSubmit = validateStatement(plaintiffStatement).valid;

  const shortcuts = [
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
        if (canSubmit) handleSubmit();
      },
    },
  ];

  const templates = useMemo(() => [
    t('quickCreate.template1'),
    t('quickCreate.template2'),
    t('quickCreate.template3'),
  ], []);

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
    if (autoGenTimeoutRef.current) {
      clearTimeout(autoGenTimeoutRef.current);
    }
    autoGenTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setDefendantStatement(draft);
      setIsGeneratingDefendant(false);
      message.success(t('message.defendantDraftDone'));
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (autoGenTimeoutRef.current) {
        clearTimeout(autoGenTimeoutRef.current);
      }
    };
  }, []);

  useKeyboardNavigation(() => { if (canSubmit) handleSubmit(); }, undefined, undefined, undefined, canSubmit);

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    if (!canSubmit) {
      message.warning(t('message.completePlaintiff'));
      return;
    }

    submitLockRef.current = true;
    try {
      if (!sessionStorage.get() && !session?.session_id) {
        await createSession().catch((e: unknown) => { logger.warn('Failed to create session before submit', e); });
      }

      const result = await createQuickCase({
        plaintiff_statement: plaintiffStatement.trim(),
        defendant_statement: defendantStatement.trim() || '',
        evidence_urls: [],
      });

      if (!result?.case?.id) {
        throw new Error(t('message.submitFail'));
      }

      if (result.session_id) {
        sessionStorage.set(result.session_id);
        caseSessionMap.set(result.case.id, result.session_id);
        if (result.session_expires_at) {
          setSession({ session_id: result.session_id, expires_at: result.session_expires_at });
        }
      }

      const filesToUpload = evidenceFiles
        .filter((f): f is UploadFile & { originFileObj: File } => Boolean(f?.originFileObj))
        .map((f) => f.originFileObj);

      if (filesToUpload.length > 0) {
        try {
          const { uploadEvidence } = await import('@/services/api/case');
          const sessionIdToUse = result.session_id || sessionStorage.get() || session?.session_id;
          if (sessionIdToUse) {
            await uploadEvidence(result.case.id, filesToUpload as File[], sessionIdToUse);
          }
        } catch {
          try { localStorage.setItem(`pending_evidence_${result.case.id}`, 'true'); } catch { /* noop */ }
        }
      }

      localStore.remove(DRAFT_STORAGE_KEY);
      if (mountedRef.current) navigate(`/quick-experience/result/${result.case.id}`);
    } catch (error: unknown) {
      if (mountedRef.current) message.error((error as { message?: string })?.message || t('message.submitFail'));
    } finally {
      submitLockRef.current = false;
    }
  };

  return (
    <>
      <SEO title={t('quickCreate.title')} description={t('quickCreate.description')} keywords={t('quickCreate.keywords')} />
      
      <div className="quick-experience-create">
        <a href="#input-section" className="skip-link">{t('quickCreate.skipToInput')}</a>

        <AnimatePresence>
          {recoveredCase && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="container" style={{ paddingTop: 24 }}>
              <Alert
                title={t('quickCreate.recoveredCase.title')}
                description={t('quickCreate.recoveredCase.desc')}
                type="info"
                showIcon
                action={
                  <Space>
                    <Button size="small" type="primary" onClick={() => navigate(`/quick-experience/result/${recoveredCase.id}`)}>{t('quickCreate.recoveredCase.continue')}</Button>
                    <Button size="small" onClick={() => setRecoveredCase(null)}>{t('quickCreate.recoveredCase.startNew')}</Button>
                  </Space>
                }
                closable
                onClose={() => setRecoveredCase(null)}
                style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section 
          className="guide-section"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="container">
            <MediatorAvatar size="medium" animated />
            <Title level={1} className="guide-title">{t('quickCreate.guide.title')}</Title>
            <Text className="guide-subtitle">{t('quickCreate.guide.subtitle')}</Text>
            <div style={{ marginTop: 16 }}>
              <Button
                type="link"
                icon={<TeamOutlined />}
                onClick={() => navigate('/quick-experience/collaborative')}
                style={{ color: '#FBBF24', fontSize: 14 }}
              >
                {t('quickCreate.collaborativeHint')}
              </Button>
            </div>
          </div>
        </motion.section>

        <AnimatePresence>
          {autoSaveStatus === 'saved' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="container">
              <Alert title={t('quickCreate.autoSaved')} type="success" showIcon closable style={{ marginBottom: 24, borderRadius: 16 }} />
            </motion.div>
          )}
        </AnimatePresence>

        <section id="input-section" className="input-section">
          <div className="container">
            <motion.div 
              className="layout-selector"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Tabs
                activeKey={layoutMode}
                onChange={(key) => setLayoutMode(key as 'horizontal' | 'vertical')}
                items={[
                  { key: 'horizontal', label: t('quickCreate.layout.horizontal') },
                  { key: 'vertical', label: t('quickCreate.layout.vertical') },
                ]}
              />
            </motion.div>

            <div className={`input-area ${layoutMode}`}>
              <motion.div 
                className="statement-card plaintiff-card"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <div className="card-header">
                  <span className="role-badge role-a">{t('quickCreate.roleA')}</span>
                  <h3 className="card-title">{t('quickCreate.plaintiffTitle')}</h3>
                </div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 24, fontSize: 15, lineHeight: 1.6 }}>
                  {t('quickCreate.plaintiffHint')}
                </Text>
                <StatementInput
                  value={plaintiffStatement}
                  onChange={setPlaintiffStatement}
                  role="plaintiff"
                  showGuide={true}
                  minLength={30}
                />
                <Space size="middle" wrap style={{ marginTop: 16 }}>
                  {templates.map((tmpl, idx) => (
                    <Button key={idx} onClick={() => applyTemplate(tmpl, 'plaintiff')}>
                      {t('quickCreate.applyTemplateN').replace('{n}', String(idx + 1))}
                    </Button>
                  ))}
                </Space>
              </motion.div>

              <motion.div 
                className="divider"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <MediatorAvatar size="small" animated />
              </motion.div>

              <motion.div 
                className="statement-card defendant-card"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <div className="card-header">
                  <span className="role-badge role-b">{t('quickCreate.roleB')}</span>
                  <h3 className="card-title">{t('quickCreate.defendantTitle')}</h3>
                </div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 24, fontSize: 15, lineHeight: 1.6 }}>
                  {t('quickCreate.defendantHint')}
                </Text>
                <StatementInput
                  value={defendantStatement}
                  onChange={setDefendantStatement}
                  role="defendant"
                  showGuide={true}
                  allowEmpty
                  minLength={MIN_DEFENDANT_LENGTH}
                />
                <Space size="middle" wrap style={{ marginTop: 16 }}>
                  <Button onClick={() => applyTemplate(templates[0], 'defendant')}>
                    {t('quickCreate.applyTemplate')}
                  </Button>
                  <Button type="primary" ghost loading={isGeneratingDefendant} onClick={handleAutoGenerateDefendant} style={{ border: 'none', background: 'rgba(14, 165, 233, 0.1)', color: '#0284C7' }}>
                    ✨ {t('quickCreate.autoWrite')}
                  </Button>
                </Space>
                <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
                  {t('quickCreate.defendantMinHint').replace('{min}', String(MIN_DEFENDANT_LENGTH))}
                </Text>
              </motion.div>
            </div>
          </div>
        </section>

        <motion.section 
          className="evidence-section"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <div className="container">
            <Collapse
              defaultActiveKey={[]}
              expandIconPlacement="end"
              items={[
                {
                  key: 'evidence',
                  label: t('quickCreate.evidenceHeader'),
                  children: (
                    <>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 24, fontSize: 15 }}>
                        {t('quickCreate.evidenceHint')}
                      </Text>
                      <FileUpload value={evidenceFiles} onChange={setEvidenceFiles} maxCount={MAX_IMAGE_COUNT} />
                    </>
                  ),
                },
              ]}
            />
          </div>
        </motion.section>

        <AnimatePresence>
          {showRegisterPrompt && (
            <motion.section 
              className="register-prompt-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="container">
                <Alert
                  title={<Space><LockOutlined /><span>{t('quickCreate.registerMessage')}</span></Space>}
                  description={t('register.prompt.desc')}
                  type="info"
                  action={
                    <Space>
                      <Button type="primary" onClick={() => navigate('/auth/register')}>{t('register.action.now')}</Button>
                      <Button type="text" onClick={() => setShowRegisterPrompt(false)}>{t('quickCreate.close')}</Button>
                    </Space>
                  }
                  closable
                  onClose={() => setShowRegisterPrompt(false)}
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <KeyboardShortcuts shortcuts={shortcuts} showHelp={true} />

        <motion.section 
          className="submit-section"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="container">
            <AnimatePresence>
              {canSubmit && (
                <motion.div 
                  className="progress-display"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                >
                  <Progress percent={progress} status="active" strokeColor={{ '0%': '#34D399', '100%': '#10B981' }} />
                  <Text>{t('quickCreate.progressDone').replace('{percent}', String(progress))}</Text>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="submit-actions">
              <GuideTooltip content={t('quickCreate.submitHint')} storageKey="quick_submit_guide" placement="top">
                <button
                  className="submit-button"
                  disabled={!canSubmit || isLoading}
                  onClick={handleSubmit}
                  aria-label={canSubmit ? t('quickCreate.submitAriaReady') : t('quickCreate.submitAriaDisabled')}
                >
                  {isLoading ? t('quickCreate.submitting') : t('quickCreate.submit')}
                </button>
              </GuideTooltip>
              <div className="submit-hints">
                <Text>{t('quickCreate.afterSubmit')}</Text>
                <br />
                <Text style={{ fontSize: 13, opacity: 0.8 }}>{t('quickCreate.eta')}</Text>
                <br />
                <Text style={{ fontSize: 13, opacity: 0.8 }}>{t('quickCreate.quickNote')}</Text>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </>
  );
};

export default QuickExperienceCreate;
