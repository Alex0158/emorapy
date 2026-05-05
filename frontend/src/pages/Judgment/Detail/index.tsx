/**
 * 判決詳情頁面
 *
 * 遷移: Ant Card/Button/Typography/Rate/Modal/Alert/Divider/Row/Col/Space/Spin/Icons/message
 *       → shadcn Dialog + Button + Tailwind + sonner + Lucide + 自定義星級
 * 保留: 所有業務邏輯（fetch, accept/reject, rating, intent navigation, post-judgment trigger）
 * 保留: JudgmentViewer, ResponsibilityRatio, ConsentModal 業務組件
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useParams, useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import {
  ArrowLeft, CheckCircle, XCircle, Heart, Star,
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
import MediatorAvatar from '@/components/business/MediatorAvatar';
import JudgmentViewer from '@/components/business/JudgmentViewer';
import ResponsibilityRatio from '@/components/business/ResponsibilityRatio';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import SEO from '@/components/common/SEO';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

const POST_JUDGMENT_RICHNESS_THRESHOLD = 0.5;

function StarRating({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1" role="group" aria-label={t('judgmentDetail.ratingAria')}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onChange(star)}
          disabled={disabled}
          className={cn('transition-colors', disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110')}
          aria-label={`${star} star`}
        >
          <Star className={cn('size-8', star <= value ? 'fill-primary text-primary' : 'text-muted-foreground/30')} />
        </button>
      ))}
    </div>
  );
}

const JudgmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [rating, setRating] = useState(0);
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
    staleRef.current = false; setJudgment(null); setRating(0);
    if (id) fetchJudgment();
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!judgment) return;
    if (judgment.user1_acceptance === false) { setShowPostJudgmentCard(false); return; }
    if (dismissedPostJudgmentRef.current) return;
    let cancelled = false;
    psychProfileApi.getProfile()
      .then((res) => {
        if (cancelled) return;
        const profile = res.data?.data;
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
      setJudgment(data); if (data.user1_rating) setRating(data.user1_rating);
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
      await acceptJudgment(id, { accepted: true, rating: rating || undefined });
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
    { intent: 'repair' as const, icon: Heart, title: t('judgmentDetail.intentRepairTitle'), desc: t('judgmentDetail.intentRepairDesc'), cta: t('judgmentDetail.intentRepairCta'), bg: 'bg-rose-50' },
    { intent: 'cool_down' as const, icon: Pause, title: t('judgmentDetail.intentCoolDownTitle'), desc: t('judgmentDetail.intentCoolDownDesc'), cta: t('judgmentDetail.intentCoolDownCta'), bg: 'bg-amber-50' },
    { intent: 'graceful_exit' as const, icon: LogOut, title: t('judgmentDetail.intentGracefulExitTitle'), desc: t('judgmentDetail.intentGracefulExitDesc'), cta: t('judgmentDetail.intentGracefulExitCta'), bg: 'bg-slate-50' },
    { intent: 'safety_support' as const, icon: Shield, title: t('judgmentDetail.intentSafetyTitle'), desc: t('judgmentDetail.intentSafetyDesc'), cta: t('judgmentDetail.intentSafetyCta'), bg: 'bg-cyan-50' },
  ];

  return (
    <>
      <SEO title={t('judgmentDetail.pageTitle')} description={t('judgmentDetail.description')} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-4xl px-4 py-8 md:px-6" role="main" aria-label={t('judgmentDetail.pageLabel')}>
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6" aria-label={t('judgmentDetail.backAria')}>
          <ArrowLeft className="size-4" />{t('judgmentDetail.back')}
        </Button>

        {/* Header */}
        <div className="mb-10 text-center">
          <MediatorAvatar size="large" animated />
          <h2 className="mt-4 text-2xl font-bold text-foreground font-heading">{t('result.title')}</h2>
          <p className="mt-1 text-base text-muted-foreground">{t('result.subtitle')}</p>
        </div>

        {/* Responsibility */}
        <div className="mb-8 rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground font-heading">{t('responsibility.title')}</h3>
          <ResponsibilityRatio ratio={responsibilityRatio} showLabels={true} size="large" />
        </div>

        {/* Judgment Content */}
        <div className="mb-8">
          <JudgmentViewer content={judgment.judgment_content ?? ''} title={t('judgmentDetail.docTitle')} showActions={true} />
        </div>

        {/* Feedback + Actions */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <h4 className="text-base font-semibold text-foreground font-heading">{t('judgmentDetail.feedbackTitle')}</h4>

          {/* Rating */}
          <div className="flex items-center gap-4 rounded-lg bg-muted/50 p-4">
            <span className="text-sm font-medium text-foreground">{t('judgmentDetail.ratingLabel')}</span>
            <StarRating value={rating} onChange={setRating} disabled={judgment.user1_acceptance !== undefined} />
          </div>

          {/* Accept/Reject */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowAcceptModal(true)} disabled={judgment.user1_acceptance !== undefined} aria-label={t('judgmentDetail.acceptAria')}>
              <CheckCircle className="size-4" />{t('judgmentDetail.accept')}
            </Button>
            <Button variant="destructive" onClick={() => setShowRejectModal(true)} disabled={judgment.user1_acceptance !== undefined} aria-label={t('judgmentDetail.rejectAria')}>
              <XCircle className="size-4" />{t('judgmentDetail.reject')}
            </Button>
          </div>

          {judgment.user1_acceptance !== undefined && (
            <div className={cn('flex items-start gap-3 rounded-lg p-3', judgment.user1_acceptance ? 'bg-success/5 border border-success/20' : 'bg-warning/5 border border-warning/20')} role="status" aria-live="polite">
              {judgment.user1_acceptance ? <CheckCircle className="size-4 text-success mt-0.5" /> : <AlertCircle className="size-4 text-warning mt-0.5" />}
              <p className="text-sm text-foreground">{judgment.user1_acceptance ? t('judgmentDetail.acceptedAlert') : t('judgmentDetail.rejectedAlert')}</p>
            </div>
          )}

          {/* Intent Direction */}
          <div className="border-t border-border pt-6 space-y-3">
            <h5 className="text-base font-semibold text-foreground font-heading">{t('judgmentDetail.nextDirectionTitle')}</h5>
            <p className="text-sm text-muted-foreground">{t('judgmentDetail.nextDirectionDesc')}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-2">
              {intentCards.map(({ intent, icon: Icon, title, desc, cta, bg }) => (
                <div key={intent} className={cn('rounded-xl p-5 space-y-3', bg)}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-foreground" />
                    <span className="text-sm font-semibold text-foreground">{title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <Button size="sm" variant="outline" onClick={() => handleChooseIntent(intent)}>{cta}</Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Post-Judgment Trigger */}
        {showPostJudgmentCard && (
          <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-4">
            <Heart className="mx-auto size-10 text-primary" />
            <h4 className="text-lg font-semibold text-foreground font-heading">{t('trigger.postJudgmentTitle')}</h4>
            <p className="text-sm text-muted-foreground">{t('trigger.postJudgmentDesc')}</p>
            <div className="flex justify-center gap-3">
              <Button onClick={handlePostJudgmentChat}>{t('trigger.postJudgmentOk')}</Button>
              <Button variant="outline" onClick={() => { dismissedPostJudgmentRef.current = true; setShowPostJudgmentCard(false); }}>{t('trigger.postJudgmentSkip')}</Button>
            </div>
          </div>
        )}

        {/* Accept Modal */}
        <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('judgmentDetail.acceptModalTitle')}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{t('judgmentDetail.acceptModalConfirm')}</p>
            {rating > 0 && <p className="text-sm font-medium text-primary">{t('judgmentDetail.acceptModalRating').replace('{rating}', String(rating))}</p>}
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
      </motion.div>
    </>
  );
};

export default JudgmentDetail;
