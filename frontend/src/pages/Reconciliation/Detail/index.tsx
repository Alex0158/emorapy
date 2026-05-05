/**
 * 和好方案承諾工作台
 *
 * 遷移: Ant Card/Descriptions/Row/Col/Tag/Button/Alert/Space/Spin/Typography/Icons/message
 *       → shadcn + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（fetch plan, commit, invite, start, pause, resume, respond）
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
    if (!id) return; setStarting(true);
    try { await confirmExecution(id); if (!mountedRef.current) return; toast.success(t('reconDetail.startSuccess')); navigate(`/execution/${id}/checkin`); }
    catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'message.startExecutionFail')); }
    finally { if (mountedRef.current) setStarting(false); }
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
            <Button size="sm" onClick={() => judgmentId && navigate(`/reconciliation/${judgmentId}`)}>返回方案頁</Button>
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-5xl px-4 py-8 md:px-6" role="main" aria-label={t('reconDetail.pageLabel')}>
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6" aria-label={t('reconDetail.backAria')}>
          <ArrowLeft className="size-4" />{t('reconDetail.back')}
        </Button>

        {/* Plan Header */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{plan.intent}</Badge>
            <Badge variant="outline">{plan.commitment?.recommended_mode === 'co' ? t('reconDetail.modeCo') : t('reconDetail.modeSolo')}</Badge>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground font-heading" id="plan-title">{parsed.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{parsed.description}</p>
          </div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-border">
            <div><dt className="text-xs font-medium text-muted-foreground">為什麼是這個方案</dt><dd className="mt-1 text-sm text-foreground">{plan.fit_reason || parsed.fit_reason}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">{t('reconDetail.estimatedDurationLabel')}</dt><dd className="mt-1 text-sm text-foreground">{plan.estimated_duration != null ? t('reconDetail.durationDays').replace('{n}', String(plan.estimated_duration)) : t('reconDetail.durationTbd')}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">{t('reconDetail.doNotUseWhenLabel')}</dt><dd className="mt-1 text-sm text-foreground">{(plan.do_not_use_when || parsed.do_not_use_when).join('、') || t('reconDetail.noRestrictions')}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">卡住時怎麼降難度</dt><dd className="mt-1 text-sm text-foreground">{plan.fallback_step || parsed.fallback_step}</dd></div>
          </dl>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h4 className="text-base font-semibold text-foreground">對你來說第一步是什麼</h4>
            <p className="text-sm text-muted-foreground">{plan.first_step || parsed.first_step || parsed.steps[0]}</p>
            <p className="text-xs text-muted-foreground/70">如果覺得太難：{plan.fallback_step || parsed.fallback_step}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h4 className="text-base font-semibold text-foreground">如果對方還沒準備好</h4>
            <p className="text-sm text-muted-foreground">你仍然可以先從一個低壓步驟開始，先把氣氛和安全感慢慢拉回來。</p>
            <p className="text-xs text-muted-foreground/70">不舒服時怎麼暫停：{plan.pause_rule || parsed.pause_rule}</p>
          </div>
        </div>

        {/* Commitment Status */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h4 className="text-base font-semibold text-foreground">共同承諾狀態</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">你目前的狀態</span>
              <Badge variant={currentStatus === 'committed' ? 'default' : 'secondary'} className={currentStatus === 'committed' ? 'bg-success/10 text-success' : ''}>
                {commitmentLabelMap[currentStatus]?.() || currentStatus}
              </Badge>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">對方目前的狀態</span>
              <Badge variant="secondary">
                {commitmentLabelMap[partnerStatus]?.() || partnerStatus}
              </Badge>
            </div>
          </div>

          {/* Journey Alert */}
          <div className={`flex items-start gap-3 rounded-lg p-3 ${dualCommitted ? 'bg-success/5 border border-success/20' : 'bg-primary-light/30'}`}>
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{journeyContext?.title || (dualCommitted ? t('reconDetail.dualCommittedTitle') : t('reconDetail.soloStartTitle'))}</p>
              <p className="text-xs text-muted-foreground">{journeyContext?.body || (dualCommitted ? t('reconDetail.dualCommittedBody') : t('reconDetail.soloStartBody'))}</p>
            </div>
          </div>

          {plan.track_history_summary?.has_superseded_versions && (
            <div className="flex items-start gap-3 rounded-lg bg-warning/5 border border-warning/20 p-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">這一輪之前已做過 {plan.track_history_summary.superseded_versions_count} 次版本調整，現在看到的是最新版本。</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            {viewerRole === 'invitee' && currentStatus !== 'committed' && currentStatus !== 'declined' && (
              <>
                <Button disabled={selecting} onClick={() => handleRespond('committed')}><CheckCircle className="size-4" />我願意一起試</Button>
                <Button variant="outline" disabled={selecting} onClick={() => handleRespond('deferred', { reason: 'need_time', remind_in_hours: 72 })}>我需要一點時間</Button>
                <Button variant="ghost" disabled={selecting} onClick={() => handleRespond('declined', { reason: 'needs_space' })}>暫時先不要</Button>
              </>
            )}
            {viewerRole !== 'invitee' && currentStatus !== 'committed' && currentStatus !== 'declined' && (
              <Button disabled={selecting} onClick={handleCommit}><CheckCircle className="size-4" />我願意先開始</Button>
            )}
            {currentStatus === 'committed' && trackStatus !== 'replanning' && trackStatus !== 'paused' && (
              <Button disabled={starting} onClick={handleStart}><Play className="size-4" />從今天開始</Button>
            )}
            {currentStatus === 'committed' && !dualCommitted && viewerRole !== 'invitee' && plan.invite_context?.can_invite && (
              <Button variant="outline" disabled={inviting} onClick={handleInvite}><Send className="size-4" />邀請對方一起試</Button>
            )}
            {trackStatus === 'replanning' && (
              <Button onClick={() => navigate(`/execution/${id}/replan`)}><Play className="size-4" />重新調整這一輪</Button>
            )}
            {(trackStatus === 'paused' || currentStatus === 'paused') && plan.commitment?.track_id && (
              <Button disabled={resuming} onClick={handleResume}><Play className="size-4" />恢復這一輪</Button>
            )}
            {currentStatus === 'committed' && trackStatus !== 'paused' && (
              <Button variant="outline" disabled={pausing} onClick={handlePause}><Pause className="size-4" />先暫停</Button>
            )}
            <Button variant="ghost" onClick={() => judgmentId && navigate(`/reconciliation/${judgmentId}`)}><Heart className="size-4" />重新看看其他方向</Button>
          </div>
        </div>
      </motion.div>
    </ProtectedRoute>
  );
};

export default ReconciliationDetail;
