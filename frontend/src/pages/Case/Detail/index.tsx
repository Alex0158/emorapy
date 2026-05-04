/**
 * 案件詳情頁面
 *
 * 遷移: Ant Card/Button/Typography/Descriptions/Spin/Alert/Space/Icons/message
 *       → shadcn + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（fetch, submit, defendant respond, status routing）
 * 保留: StatementInput 業務組件、getCaseStatusTag/getCaseTypeTag 工具
 */

import { useState, useEffect, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Edit, CheckCircle, Clock, Send,
  AlertTriangle, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCase, submitCase, updateCase } from '@/services/api/case';
import type { Case } from '@/types/case';
import { useAuthStore } from '@/store/authStore';
import StatementInput from '@/components/business/StatementInput';
import { validateStatement } from '@/utils/validate';
import SEO from '@/components/common/SEO';
import { formatDateTime } from '@/utils/formatDate';
import { logger } from '@/utils/logger';
import { getCaseStatusTag, getCaseTypeTag } from '@/utils/statusTags';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

const CaseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [case_, setCase_] = useState<Case | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [defendantStatement, setDefendantStatement] = useState('');
  const [respondLoading, setRespondLoading] = useState(false);
  const [loadErrorTitle, setLoadErrorTitle] = useState<string | null>(null);
  const [loadErrorDescription, setLoadErrorDescription] = useState<string | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fetchLockRef = useRef(false);
  const submitLockRef = useRef(false);
  const respondLockRef = useRef(false);
  const viewJudgmentLockRef = useRef(false);
  const mountedRef = useMountedRef();
  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    if (id) fetchCase();
    return () => { staleRef.current = true; clearTimeout(redirectTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCase = async () => {
    if (!id) { toast.error(t('message.caseIdMissing')); navigate('/case/list'); return; }
    if (fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    try {
      const caseData = await getCase(id);
      if (staleRef.current) return;
      setLoadErrorTitle(null); setLoadErrorDescription(null);
      setCase_(caseData);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const err = error as { code?: string };
      if (err?.code === 'NOT_FOUND' || err?.code === 'HTTP_404') {
        setLoadErrorTitle(t('common.caseNotFound')); toast.error(t('common.caseNotFound'));
        redirectTimerRef.current = setTimeout(() => navigate('/case/list'), 1500);
      } else if (err?.code === 'FORBIDDEN' || err?.code === 'HTTP_403') {
        const msg = getErrorMessage(error, 'message.noPermissionViewCase');
        setLoadErrorTitle(t('message.noPermissionViewCase'));
        setLoadErrorDescription(msg === t('message.noPermissionViewCase') ? null : msg);
        toast.error(msg); redirectTimerRef.current = setTimeout(() => navigate('/case/list'), 1500);
      } else if (err?.code === 'UNAUTHORIZED' || err?.code === 'HTTP_401') {
        setLoadErrorTitle(t('message.pleaseLogin')); toast.error(t('message.pleaseLogin'));
        redirectTimerRef.current = setTimeout(() => navigate('/auth/login'), 1500);
      } else {
        const msg = getErrorMessage(error, 'common.getCaseFail');
        setLoadErrorTitle(t('common.getCaseFail'));
        setLoadErrorDescription(msg === t('common.getCaseFail') ? null : msg);
        toast.error(msg); logger.error('Failed to fetch case', error);
      }
    } finally { fetchLockRef.current = false; if (!staleRef.current) setLoading(false); }
  };

  const handleSubmit = async () => {
    if (submitting || submitLockRef.current || !id) { if (!id) toast.error(t('message.caseIdMissing')); return; }
    submitLockRef.current = true; setSubmitting(true);
    try {
      await submitCase(id);
      if (!mountedRef.current) return;
      toast.success(t('message.submitCaseSuccess'));
      navigate(`/case/${id}/review`);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const err = error as { code?: string };
      if (err?.code === 'FORBIDDEN' || err?.code === 'HTTP_403') toast.error(getErrorMessage(error, 'message.noPermissionSubmitCase'));
      else { toast.error(getErrorMessage(error, 'message.submitCaseFail')); if (err?.code !== 'CASE_NOT_EDITABLE' && err?.code !== 'VALIDATION_ERROR') logger.error('Failed to submit case', error); }
    } finally { submitLockRef.current = false; if (mountedRef.current) setSubmitting(false); }
  };

  const handleDefendantRespond = async () => {
    if (respondLoading || respondLockRef.current || !id || !case_) return;
    if (!validateStatement(defendantStatement).valid) { toast.warning(t('caseDetail.defendantStatementTooShort')); return; }
    respondLockRef.current = true; setRespondLoading(true);
    try {
      const updated = await updateCase(id, { defendant_statement: defendantStatement });
      if (!mountedRef.current) return;
      setCase_(updated); toast.success(t('caseDetail.defendantRespondSuccess'));
      if (updated.status === 'submitted') navigate(`/case/${id}/review`);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      toast.error(getErrorMessage(error, 'caseDetail.defendantRespondFail'));
    } finally { respondLockRef.current = false; if (mountedRef.current) setRespondLoading(false); }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  if (!case_) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-foreground">{loadErrorTitle || t('common.caseNotFound')}</p>
              {loadErrorDescription && <p className="mt-1 text-sm text-muted-foreground">{loadErrorDescription}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/case/list')}>{t('caseDetail.backList')}</Button>
            <Button size="sm" onClick={() => id && fetchCase()}>{t('common.retry')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const modeLabel = case_.mode === 'remote' ? t('caseDetail.modeRemote') : case_.mode === 'collaborative' ? t('caseDetail.modeCollaborative') : t('caseDetail.modeQuick');
  const isDefendant = user?.id === case_.defendant_id;
  const isPlaintiff = user?.id === case_.plaintiff_id;
  const needsDefendantResponse = case_.status === 'draft' && (case_.mode === 'remote' || case_.mode === 'collaborative') && !case_.defendant_statement;

  return (
    <>
      <SEO title={`${case_.title}${t('caseDetail.titleSuffix')}`} description={case_.plaintiff_statement?.substring(0, 100) || ''} />
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6" role="main" aria-label={t('caseDetail.pageLabel')}>
        {/* Back + Edit */}
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/case/list')} aria-label={t('caseDetail.backListAria')}>
            <ArrowLeft className="size-4" />{t('caseDetail.backList')}
          </Button>
          {case_.status === 'draft' && !needsDefendantResponse && (
            <Button variant="outline" size="sm" onClick={() => toast.info(t('message.editComingSoon'))} aria-label={t('caseDetail.editAria')}>
              <Edit className="size-4" />{t('caseDetail.edit')}
            </Button>
          )}
        </div>

        {/* Title + Status */}
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {getCaseStatusTag(case_.status)}
            {getCaseTypeTag(case_.type)}
          </div>
          <h1 className="text-3xl font-bold text-foreground font-heading">{case_.title}</h1>
        </div>

        {/* Info Grid (replaces Ant Descriptions) */}
        <div className="mb-8 rounded-xl border border-border bg-card p-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label={t('caseDetail.descLabel')}>
            <InfoItem label={t('caseDetail.caseId')} value={case_.id} />
            <InfoItem label={t('caseDetail.caseType')} value={case_.type} />
            <InfoItem label={t('caseDetail.subType')} value={case_.sub_type || t('caseDetail.subTypeNone')} />
            <InfoItem label={t('caseDetail.mode')} value={modeLabel} />
            <InfoItem label={t('caseDetail.createdAt')} value={formatDateTime(case_.created_at)} />
            <InfoItem label={t('caseDetail.updatedAt')} value={formatDateTime(case_.updated_at)} />
            {case_.submitted_at && <InfoItem label={t('caseDetail.submittedAt')} value={formatDateTime(case_.submitted_at)} />}
            {case_.completed_at && <InfoItem label={t('caseDetail.completedAt')} value={formatDateTime(case_.completed_at)} />}
          </dl>
        </div>

        {/* Plaintiff Statement */}
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('caseDetail.plaintiffStatement')}</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{case_.plaintiff_statement}</p>
        </div>

        {/* Defendant Statement */}
        {case_.defendant_statement && (
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('caseDetail.defendantStatement')}</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{case_.defendant_statement}</p>
          </div>
        )}

        {/* Defendant Response Form */}
        {needsDefendantResponse && isDefendant && (
          <div className="mb-6 rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-base font-semibold text-foreground">{t('caseDetail.yourResponse')}</h3>
            <div className="flex items-start gap-2 rounded-lg bg-primary-light/30 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">{t('caseDetail.defendantResponseHint')}</p>
            </div>
            <StatementInput value={defendantStatement} onChange={setDefendantStatement} placeholder={t('caseDetail.defendantResponsePlaceholder')} />
            <Button onClick={handleDefendantRespond} disabled={!validateStatement(defendantStatement).valid || respondLoading}>
              {respondLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t('caseDetail.submitResponse')}
            </Button>
          </div>
        )}

        {/* Waiting for defendant */}
        {needsDefendantResponse && isPlaintiff && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
            <Clock className="mt-0.5 size-5 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-foreground">{t('caseDetail.waitingForDefendant')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('caseDetail.waitingForDefendantDesc')}</p>
            </div>
          </div>
        )}

        {/* Submit Case (draft) */}
        {case_.status === 'draft' && !needsDefendantResponse && (
          <div className="mt-8 space-y-2">
            <Button size="lg" onClick={handleSubmit} disabled={submitting} className="w-full rounded-2xl" aria-label={t('caseDetail.submitCaseAria')}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
              {t('caseDetail.submitCase')}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t('caseDetail.submitHint')}</p>
          </div>
        )}

        {/* View Review (submitted/in_progress) */}
        {(case_.status === 'submitted' || case_.status === 'in_progress') && (
          <div className="mt-8">
            <Button size="lg" onClick={() => navigate(`/case/${id}/review`)} className="w-full rounded-2xl" aria-label={t('caseDetail.viewReviewAria')}>
              <Clock className="size-4" />{t('caseDetail.viewReview')}
            </Button>
          </div>
        )}

        {/* View Judgment (completed) */}
        {case_.status === 'completed' && (
          <div className="mt-8">
            <Button size="lg" className="w-full rounded-2xl" aria-label={t('caseDetail.viewJudgmentAria')} onClick={async () => {
              if (viewJudgmentLockRef.current) return;
              viewJudgmentLockRef.current = true;
              try {
                const { getJudgmentByCaseId } = await import('@/services/api/judgment');
                const judgment = await getJudgmentByCaseId(case_.id);
                if (!mountedRef.current) return;
                if (judgment) navigate(`/judgment/${judgment.id}`);
                else toast.warning(t('message.judgmentNotReady'));
              } catch (error) { if (mountedRef.current) toast.error(getErrorMessage(error, 'message.getJudgmentFail')); }
              finally { viewJudgmentLockRef.current = false; }
            }}>
              {t('caseDetail.viewJudgment')}
            </Button>
          </div>
        )}

        {/* Judgment Failed */}
        {case_.status === 'judgment_failed' && (
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-foreground">{t('review.judgmentFailed')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{case_.judgment_failure_reason || t('review.judgmentFailedDesc')}</p>
              <Button size="sm" className="mt-3" onClick={() => navigate(`/case/${id}/review`)}>{t('review.retryJudgment')}</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground truncate">{value}</dd>
    </div>
  );
}

export default CaseDetail;
