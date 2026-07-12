/**
 * 判決詳情頁面
 *
 * Guided Reflection：保留 fetch、accept/reject、policy-driven intent navigation 與 standard-route follow-up。
 * 星級 rating 不再作使用者面接受門檻；API optional rating 僅保留相容性。
 * 保留: JudgmentViewer, ResponsibilityRatio, ConsentModal 業務組件
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import {
  ArrowLeft, CheckCircle, XCircle, Heart,
  Shield, Pause, LogOut, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { getJudgment, acceptJudgment } from '@/services/api/judgment';
import { psychProfileApi } from '@/services/api/psychProfile';
import { useInterviewTrigger } from '@/hooks/useInterviewTrigger';
import type { Judgment } from '@/types/judgment';
import type { ReconciliationIntent } from '@/services/api/reconciliation';
import JudgmentViewer from '@/components/business/JudgmentViewer';
import ResponsibilityRatio from '@/components/business/ResponsibilityRatio';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import SEO from '@/components/common/SEO';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

const POST_JUDGMENT_RICHNESS_THRESHOLD = 0.5;

const JudgmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPostJudgmentCard, setShowPostJudgmentCard] = useState(false);
  const dismissedPostJudgmentRef = useRef(false);
  const fetchLockRef = useRef(false);
  const acceptLockRef = useRef(false);

  const {
    triggerInterview: handlePostJudgmentChat,
    consentOpen, setConsentOpen, setProfileConsent, handleConsent, consentLoading,
  } = useInterviewTrigger('post_judgment');

  const mountedRef = useMountedRef();
  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false; setJudgment(null);
    if (id) fetchJudgment();
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!judgment) return;
    if (judgment.judgment_route === 'safety_support' || judgment.judgment_route === 'crisis_support') {
      setShowPostJudgmentCard(false);
      return;
    }
    if (judgment.user1_acceptance === false) { setShowPostJudgmentCard(false); return; }
    if (dismissedPostJudgmentRef.current) return;
    let cancelled = false;
    psychProfileApi.getProfile()
      .then((profile) => {
        if (cancelled) return;
        if (!profile) return;
        setProfileConsent(!!profile.consent_given);
        if ((profile.richness_score ?? 0) < POST_JUDGMENT_RICHNESS_THRESHOLD) setShowPostJudgmentCard(true);
      })
      .catch((e: unknown) => { logger.warn('Failed to fetch profile for post-judgment card', e); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgment, setProfileConsent]);

  const fetchJudgment = async () => {
    if (!id || fetchLockRef.current) return;
    fetchLockRef.current = true; setLoading(true); setLoadError(null);
    try {
      const data = await getJudgment(id);
      if (staleRef.current) return;
      setJudgment(data);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = getErrorMessage(error, 'message.getJudgmentDetailFail');
      toast.error(msg); setLoadError(msg);
    } finally { fetchLockRef.current = false; if (!staleRef.current) setLoading(false); }
  };

  const handleAccept = async () => {
    if (!id || accepting || acceptLockRef.current) return;
    acceptLockRef.current = true; setAccepting(true);
    try {
      await acceptJudgment(id, { accepted: true });
      if (!mountedRef.current) return;
      toast.success(t('message.acceptJudgmentSuccess'));
      setShowAcceptModal(false);
      setJudgment((prev) => (prev ? { ...prev, user1_acceptance: true as const } : null));
      fetchJudgment();
    } catch (error: unknown) { toast.error(getErrorMessage(error, 'message.operationFail')); }
    finally { acceptLockRef.current = false; setAccepting(false); }
  };

  const handleReject = async () => {
    if (!id || accepting || acceptLockRef.current) return;
    acceptLockRef.current = true; setAccepting(true);
    try {
      await acceptJudgment(id, { accepted: false });
      if (!mountedRef.current) return;
      toast.success(t('message.rejectJudgmentSuccess'));
      setShowRejectModal(false);
      setJudgment((prev) => (prev ? { ...prev, user1_acceptance: false as const } : null));
      fetchJudgment();
    } catch (error: unknown) { toast.error(getErrorMessage(error, 'message.operationFail')); }
    finally { acceptLockRef.current = false; setAccepting(false); }
  };

  const handleChooseIntent = (intent: ReconciliationIntent) => {
    if (!id) return;
    navigate(`/reconciliation/${id}?intent=${intent}`);
  };

  const responsibilityRatio = useMemo(
    () => judgment
      ? (judgment.responsibility_ratio ?? { plaintiff: judgment.plaintiff_ratio, defendant: judgment.defendant_ratio })
      : { plaintiff: 0, defendant: 0 },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [judgment?.plaintiff_ratio, judgment?.defendant_ratio, judgment?.responsibility_ratio],
  );

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  if (!judgment) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-foreground">{loadError || t('message.judgmentNotFound')}</p></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>{t('judgmentDetail.back')}</Button>
            <Button size="sm" onClick={() => id && fetchJudgment()}>{t('common.retry')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const intentCards = [
    { intent: 'repair' as const, icon: Heart, title: t('judgmentDetail.intentRepairTitle'), desc: t('judgmentDetail.intentRepairDesc'), cta: t('judgmentDetail.intentRepairCta') },
    { intent: 'cool_down' as const, icon: Pause, title: t('judgmentDetail.intentCoolDownTitle'), desc: t('judgmentDetail.intentCoolDownDesc'), cta: t('judgmentDetail.intentCoolDownCta') },
    { intent: 'graceful_exit' as const, icon: LogOut, title: t('judgmentDetail.intentGracefulExitTitle'), desc: t('judgmentDetail.intentGracefulExitDesc'), cta: t('judgmentDetail.intentGracefulExitCta') },
    { intent: 'safety_support' as const, icon: Shield, title: t('judgmentDetail.intentSafetyTitle'), desc: t('judgmentDetail.intentSafetyDesc'), cta: t('judgmentDetail.intentSafetyCta') },
  ];

  const reconciliationPolicy = judgment.reconciliation_policy;
  const isSafetyRoute = judgment.judgment_route === 'safety_support' || judgment.judgment_route === 'crisis_support';
  const showResponsibilityRatio = judgment.responsibility_ratio_visibility?.can_show === true;
  const visibleIntentCards = intentCards.filter(({ intent }) => {
    if (!reconciliationPolicy?.allowedReconciliationIntents.includes(intent)) return false;
    return isSafetyRoute ? intent === reconciliationPolicy.defaultReconciliationIntent : intent !== 'safety_support';
  });

  return (
    <>
      <SEO title={t('judgmentDetail.pageTitle')} description={t('judgmentDetail.description')} />
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12" aria-label={t('judgmentDetail.pageLabel')}>
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6" aria-label={t('judgmentDetail.backAria')}>
          <ArrowLeft className="size-4" />{t('judgmentDetail.back')}
        </Button>

        {/* Header */}
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t('result.title')}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground font-heading md:text-4xl">{t('judgmentDetail.docTitle')}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{t('result.subtitle')}</p>
        </div>

        {isSafetyRoute && (
          <section className="mb-8 border-y border-primary/30 bg-primary/5 px-4 py-5" role="status" aria-live="polite">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground">{t('judgmentDetail.intentSafetyTitle')}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('judgmentDetail.intentSafetyDesc')}</p>
              </div>
            </div>
          </section>
        )}

        {/* Judgment Content */}
        <div className="mb-8">
          <JudgmentViewer content={judgment.judgment_content ?? ''} title={t('judgmentDetail.docTitle')} showActions={true} />
        </div>

        {showResponsibilityRatio && (
          <section className="mb-8">
            <h2 className="mb-2 text-base font-semibold text-foreground">{t('responsibility.title')}</h2>
            <p className="mb-4 text-sm text-muted-foreground">{t('judgmentDetail.nextDirectionDesc')}</p>
            <ResponsibilityRatio ratio={responsibilityRatio} showLabels size="large" />
          </section>
        )}

        {/* Feedback + Actions */}
        <section className="space-y-7 border-t border-border pt-8">
          <div>
            <h2 className="text-base font-semibold text-foreground font-heading">{t('judgmentDetail.feedbackTitle')}</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button onClick={() => setShowAcceptModal(true)} disabled={judgment.user1_acceptance !== undefined} aria-label={t('judgmentDetail.acceptAria')}>
                <CheckCircle className="size-4" />{t('judgmentDetail.accept')}
              </Button>
              <Button variant="outline" onClick={() => setShowRejectModal(true)} disabled={judgment.user1_acceptance !== undefined} aria-label={t('judgmentDetail.rejectAria')}>
                <XCircle className="size-4" />{t('judgmentDetail.reject')}
              </Button>
            </div>
          </div>

          {judgment.user1_acceptance !== undefined && (
            <div className={cn('flex items-start gap-3 rounded-lg p-3', judgment.user1_acceptance ? 'bg-success/5 border border-success/20' : 'bg-warning/5 border border-warning/20')} role="status" aria-live="polite">
              {judgment.user1_acceptance ? <CheckCircle className="size-4 text-success mt-0.5" /> : <AlertCircle className="size-4 text-warning mt-0.5" />}
              <p className="text-sm text-foreground">{judgment.user1_acceptance ? t('judgmentDetail.acceptedAlert') : t('judgmentDetail.rejectedAlert')}</p>
            </div>
          )}

          {/* Intent Direction */}
          {visibleIntentCards.length > 0 && <div className="border-t border-border pt-7 space-y-3">
            <h5 className="text-base font-semibold text-foreground font-heading">{t('judgmentDetail.nextDirectionTitle')}</h5>
            <p className="text-sm text-muted-foreground">{t('judgmentDetail.nextDirectionDesc')}</p>
            <div className="divide-y divide-border border-y border-border">
              {visibleIntentCards.map(({ intent, icon: Icon, title, desc, cta }, index) => (
                <div key={intent} className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                    <Icon className="size-4 text-foreground" />
                    <span className="text-sm font-semibold text-foreground">{title}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
                  </div>
                  <Button size="sm" variant={index === 0 ? 'default' : 'outline'} onClick={() => handleChooseIntent(intent)}>{cta}</Button>
                </div>
              ))}
            </div>
          </div>}
        </section>

        {/* Post-Judgment Trigger */}
        {showPostJudgmentCard && (
          <div className="mt-10 border-t border-border pt-7 space-y-3">
            <h4 className="text-base font-semibold text-foreground font-heading">{t('trigger.postJudgmentTitle')}</h4>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t('trigger.postJudgmentDesc')}</p>
            <div className="flex gap-3">
              <Button onClick={handlePostJudgmentChat}>{t('trigger.postJudgmentOk')}</Button>
              <Button variant="ghost" onClick={() => { dismissedPostJudgmentRef.current = true; setShowPostJudgmentCard(false); }}>{t('trigger.postJudgmentSkip')}</Button>
            </div>
          </div>
        )}

        {/* Accept Modal */}
        <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('judgmentDetail.acceptModalTitle')}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{t('judgmentDetail.acceptModalConfirm')}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAcceptModal(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleAccept} disabled={accepting}>
                {accepting && <Loader2 className="size-4 animate-spin" />}{t('judgmentDetail.confirmAccept')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('judgmentDetail.rejectModalTitle')}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{t('judgmentDetail.rejectModalConfirm')}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>{t('common.cancel')}</Button>
              <Button variant="destructive" onClick={handleReject} disabled={accepting}>
                {accepting && <Loader2 className="size-4 animate-spin" />}{t('judgmentDetail.confirmReject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConsentModal open={consentOpen} onConsent={handleConsent} onCancel={() => setConsentOpen(false)} loading={consentLoading} />
      </main>
    </>
  );
};

export default JudgmentDetail;
