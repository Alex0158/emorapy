/**
 * 和好方案承諾工作台
 *
 * 遷移: Ant Card/Descriptions/Row/Col/Tag/Button/Alert/Space/Spin/Typography/Icons/message
 *       → shadcn + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（fetch plan, commit, invite, start, pause, resume, respond）
 */

import { useEffect, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle, Heart, Pause, Play, Send, Loader2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getPlanById, invitePartner, pausePlan, respondPlan, selectPlan,
} from '@/services/api/reconciliation';
import { confirmExecution, resumeTrack } from '@/services/api/execution';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import { getErrorMessage } from '@/utils/apiError';
import { safeParsePlanContent } from '@/utils/planContent';
import { t } from '@/utils/i18n';

const commitmentLabelMap: Record<string, () => string> = {
  not_viewed: () => t('reconDetail.commitment.notViewed'), viewed: () => t('reconDetail.commitment.viewed'), deferred: () => t('reconDetail.commitment.deferred'),
  committed: () => t('reconDetail.commitment.committed'), declined: () => t('reconDetail.commitment.declined'), paused: () => t('reconDetail.commitment.paused'),
};

type PlanDetail = Awaited<ReturnType<typeof getPlanById>>;

const ReconciliationDetail = () => {
  const { judgmentId, id } = useParams<{ judgmentId: string; id: string }>();
  const navigate = useNavigate();
  const mountedRef = useMountedRef();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchLockRef = useRef(false);
  const startLockRef = useRef(false);
  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    if (id) void fetchPlan();
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchPlan = async () => {
    if (!id || fetchLockRef.current) return;
    fetchLockRef.current = true; setLoading(true); setLoadError(null);
    try {
      const planDetail = await getPlanById(id);
      if (staleRef.current) return;
      setPlan(planDetail);
      if (planDetail.viewer_role === 'invitee' && planDetail.commitment?.current_user.commitment_status === 'not_viewed') {
        await respondPlan(id, 'viewed');
        if (!staleRef.current) { const refreshed = await getPlanById(id); if (!staleRef.current) setPlan(refreshed); }
      }
    } catch (error: unknown) {
      if (staleRef.current) return;
      setLoadError(getErrorMessage(error, 'message.getPlanDetailFail')); setPlan(null);
    } finally { fetchLockRef.current = false; if (!staleRef.current) setLoading(false); }
  };

  const handleCommit = async () => {
    if (!id) return; setSelecting(true);
    try { await selectPlan(id); if (!mountedRef.current) return; toast.success(t('reconDetail.commitSuccess')); await fetchPlan(); }
    catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'message.selectPlanFail')); }
    finally { if (mountedRef.current) setSelecting(false); }
  };

  const handleInvite = async () => {
    if (!id) return; setInviting(true);
    try { await invitePartner(id); if (!mountedRef.current) return; toast.success(t('reconDetail.inviteSuccess')); await fetchPlan(); }
    catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'message.operationFail')); }
    finally { if (mountedRef.current) setInviting(false); }
  };

  const handleStart = async () => {
    if (!id || startLockRef.current) return;
    startLockRef.current = true;
    setStarting(true);
    try { await confirmExecution(id); if (!mountedRef.current) return; toast.success(t('reconDetail.startSuccess')); navigate(`/execution/${id}/checkin`); }
    catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'message.startExecutionFail')); }
    finally { startLockRef.current = false; if (mountedRef.current) setStarting(false); }
  };

  const handlePause = async () => {
    if (!id) return; setPausing(true);
    try { await pausePlan(id); if (!mountedRef.current) return; toast.success(t('reconDetail.pauseSuccess')); await fetchPlan(); }
    catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'message.operationFail')); }
    finally { if (mountedRef.current) setPausing(false); }
  };

  const handleRespond = async (action: 'committed' | 'deferred' | 'declined', options?: { reason?: 'need_time' | 'needs_space' | 'unsure' | 'too_much_pressure'; remind_in_hours?: number }) => {
    if (!id) return; setSelecting(true);
    try {
      if (options) await respondPlan(id, action, options); else await respondPlan(id, action);
      if (!mountedRef.current) return;
      toast.success(action === 'committed' ? t('reconDetail.respondCommitted') : action === 'deferred' ? t('reconDetail.respondDeferred') : t('reconDetail.respondDeclined'));
      await fetchPlan();
    } catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'message.operationFail')); }
    finally { if (mountedRef.current) setSelecting(false); }
  };

  const handleResume = async () => {
    if (!plan?.commitment?.track_id) return; setResuming(true);
    try { const result = await resumeTrack(plan.commitment.track_id); if (!mountedRef.current) return; toast.success(t('reconDetail.resumeSuccess')); navigate(`/execution/${result.plan_id}/checkin`); }
    catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'message.operationFail')); }
    finally { if (mountedRef.current) setResuming(false); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  if (!plan) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-foreground">{loadError || t('message.planNotFound')}</p></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchPlan()}>{t('common.retry')}</Button>
            <Button size="sm" onClick={() => judgmentId && navigate(`/reconciliation/${judgmentId}`)}>{t('reconDetail.backToPlans')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const parsed = plan.content || safeParsePlanContent(plan.plan_content);
  const currentStatus = plan.commitment?.current_user.commitment_status || 'not_viewed';
  const partnerStatus = plan.commitment?.partner?.commitment_status || 'not_viewed';
  const dualCommitted = plan.commitment?.is_dual_committed || false;
  const viewerRole = plan.viewer_role || 'solo';
  const trackStatus = plan.commitment?.track_status || 'draft';
  const journeyContext = plan.journey_context;

  return (
    <ProtectedRoute>
      <SEO title={t('reconDetail.pageTitle')} description={parsed.description.substring(0, 100)} />
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12" aria-label={t('reconDetail.pageLabel')}>
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6" aria-label={t('reconDetail.backAria')}>
          <ArrowLeft className="size-4" />{t('reconDetail.back')}
        </Button>

        {/* Plan Header */}
        <header className="mb-8 space-y-5">
          <div className="flex flex-wrap gap-2"><Badge variant="outline">{plan.commitment?.recommended_mode === 'co' ? t('reconDetail.modeCo') : t('reconDetail.modeSolo')}</Badge></div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground font-heading md:text-4xl" id="plan-title">{parsed.title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{parsed.description}</p>
          </div>
          <dl className="grid grid-cols-1 gap-5 border-y border-border py-5 sm:grid-cols-2">
            <div><dt className="text-xs font-medium text-muted-foreground">{t('reconDetail.fitReasonLabel')}</dt><dd className="mt-1 text-sm leading-6 text-foreground">{plan.fit_reason || parsed.fit_reason}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">{t('reconDetail.estimatedDurationLabel')}</dt><dd className="mt-1 text-sm leading-6 text-foreground">{plan.estimated_duration != null ? t('reconDetail.durationDays').replace('{n}', String(plan.estimated_duration)) : t('reconDetail.durationTbd')}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">{t('reconDetail.doNotUseWhenLabel')}</dt><dd className="mt-1 text-sm leading-6 text-foreground">{(plan.do_not_use_when || parsed.do_not_use_when).join('、') || t('reconDetail.noRestrictions')}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">{t('reconDetail.fallbackLabel')}</dt><dd className="mt-1 text-sm leading-6 text-foreground">{plan.fallback_step || parsed.fallback_step}</dd></div>
          </dl>
        </header>

        {/* Steps */}
        <section className="mb-8 grid grid-cols-1 divide-y divide-border border-y border-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="space-y-3 py-5 md:pr-6">
            <h2 className="text-base font-semibold text-foreground">{t('reconDetail.firstStepTitle')}</h2>
            <p className="text-sm text-muted-foreground">{plan.first_step || parsed.first_step || parsed.steps[0]}</p>
            <p className="text-xs text-muted-foreground/70">{t('reconDetail.firstStepFallback')}{plan.fallback_step || parsed.fallback_step}</p>
          </div>
          <div className="space-y-3 py-5 md:pl-6">
            <h2 className="text-base font-semibold text-foreground">{t('reconDetail.partnerNotReadyTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('reconDetail.partnerNotReadyBody')}</p>
            <p className="text-xs text-muted-foreground/70">{t('reconDetail.pauseRuleHint')}{plan.pause_rule || parsed.pause_rule}</p>
          </div>
        </section>

        {/* Commitment Status */}
        <section className="space-y-5 border-t border-border pt-7">
          <h2 className="text-base font-semibold text-foreground">{t('reconDetail.commitmentTitle')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 border-l-2 border-primary/40 pl-4">
              <span className="text-xs font-medium text-muted-foreground">{t('reconDetail.yourStatus')}</span>
              <Badge variant={currentStatus === 'committed' ? 'default' : 'secondary'} className={currentStatus === 'committed' ? 'bg-success/10 text-success' : ''}>
                {commitmentLabelMap[currentStatus]?.() || currentStatus}
              </Badge>
            </div>
            <div className="space-y-2 border-l-2 border-border pl-4">
              <span className="text-xs font-medium text-muted-foreground">{t('reconDetail.partnerStatus')}</span>
              <Badge variant="secondary">
                {commitmentLabelMap[partnerStatus]?.() || partnerStatus}
              </Badge>
            </div>
          </div>

          {/* Journey Alert */}
          <div className={`flex items-start gap-3 border-y px-4 py-4 ${dualCommitted ? 'border-success/30 bg-success/5' : 'border-primary/20 bg-primary/5'}`}>
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{journeyContext?.title || (dualCommitted ? t('reconDetail.dualCommittedTitle') : t('reconDetail.soloStartTitle'))}</p>
              <p className="text-xs text-muted-foreground">{journeyContext?.body || (dualCommitted ? t('reconDetail.dualCommittedBody') : t('reconDetail.soloStartBody'))}</p>
            </div>
          </div>

          {plan.track_history_summary?.has_superseded_versions && (
            <div className="flex items-start gap-3 rounded-lg bg-warning/5 border border-warning/20 p-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">{t('reconDetail.versionHistory').replace('{count}', String(plan.track_history_summary.superseded_versions_count))}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {viewerRole === 'invitee' && currentStatus !== 'committed' && currentStatus !== 'declined' && (
              <>
                <Button disabled={selecting} onClick={() => handleRespond('committed')}><CheckCircle className="size-4" />{t('reconDetail.actionCommit')}</Button>
                <Button variant="outline" disabled={selecting} onClick={() => handleRespond('deferred', { reason: 'need_time', remind_in_hours: 72 })}>{t('reconDetail.actionDefer')}</Button>
                <Button variant="ghost" disabled={selecting} onClick={() => handleRespond('declined', { reason: 'needs_space' })}>{t('reconDetail.actionDecline')}</Button>
              </>
            )}
            {viewerRole !== 'invitee' && currentStatus !== 'committed' && currentStatus !== 'declined' && (
              <Button disabled={selecting} onClick={handleCommit}><CheckCircle className="size-4" />{t('reconDetail.actionSoloStart')}</Button>
            )}
            {currentStatus === 'committed' && trackStatus !== 'replanning' && trackStatus !== 'paused' && (
              <Button disabled={starting} onClick={handleStart}><Play className="size-4" />{t('reconDetail.actionStartToday')}</Button>
            )}
            {currentStatus === 'committed' && !dualCommitted && viewerRole !== 'invitee' && plan.invite_context?.can_invite && (
              <Button variant="outline" disabled={inviting} onClick={handleInvite}><Send className="size-4" />{t('reconDetail.actionInvite')}</Button>
            )}
            {trackStatus === 'replanning' && (
              <Button onClick={() => navigate(`/execution/${id}/replan`)}><Play className="size-4" />{t('reconDetail.actionReplan')}</Button>
            )}
            {(trackStatus === 'paused' || currentStatus === 'paused') && plan.commitment?.track_id && (
              <Button disabled={resuming} onClick={handleResume}><Play className="size-4" />{t('reconDetail.actionResume')}</Button>
            )}
            {currentStatus === 'committed' && trackStatus !== 'paused' && (
              <Button variant="outline" disabled={pausing} onClick={handlePause}><Pause className="size-4" />{t('reconDetail.actionPause')}</Button>
            )}
            <Button variant="ghost" onClick={() => judgmentId && navigate(`/reconciliation/${judgmentId}`)}><Heart className="size-4" />{t('reconDetail.actionExploreOther')}</Button>
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
};

export default ReconciliationDetail;
