/**
 * 重新調整修復旅程（遷移：Ant → shadcn + Tailwind + sonner + Lucide）
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, Loader2, Info, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import AIErrorState from '@/components/common/AIErrorState';
import AIPhaseTimeline from '@/components/common/AIPhaseTimeline';
import AIRecoveryBadge from '@/components/common/AIRecoveryBadge';
import { getExecutionStatus, replanTrack, type ExecutionStatus } from '@/services/api/execution';
import type { AIStreamReadyEvent } from '@/services/aiStream';
import { getErrorMessage } from '@/utils/apiError';
import { useAIStreamSubscription } from '@/hooks/useAIStreamSubscription';
import type { AIStreamEvent, AIStreamPhase, AIStreamSnapshot } from '@/types/aiStream';
import { cn } from '@/lib/utils';

import { t } from '@/utils/i18n';

type ReasonKey = 'needs_help' | 'farther' | 'high_stress' | 'manual';
type ModeKey = 'lower_pressure' | 'slower_pace' | 'solo_first';
const reasonLabelMap: Record<ReasonKey, () => string> = { needs_help: () => t('execReplan.reason.needsHelp'), farther: () => t('execReplan.reason.farther'), high_stress: () => t('execReplan.reason.highStress'), manual: () => t('execReplan.reason.manual') };
const modeLabelMap: Record<ModeKey, () => string> = { lower_pressure: () => t('execReplan.mode.lowerPressure'), slower_pace: () => t('execReplan.mode.slowerPace'), solo_first: () => t('execReplan.mode.soloFirst') };
const phaseLabelMap: Record<string, () => string> = { collecting_context: () => t('execReplan.phase.collectingContext'), analyzing_recent_pulse: () => t('execReplan.phase.analyzingPulse'), drafting_adjustment: () => t('execReplan.phase.draftingAdjustment'), finalizing_plan: () => t('execReplan.phase.finalizingPlan'), persisted: () => t('execReplan.phase.persisted') };

interface ReplanStreamState { latestSnapshot: AIStreamSnapshot | null; phaseHistory: AIStreamPhase[]; latestEvent: AIStreamEvent | null; }
const initialStreamState: ReplanStreamState = { latestSnapshot: null, phaseHistory: [], latestEvent: null };

function pickReplanSnapshotFromReady(ready: AIStreamReadyEvent): AIStreamSnapshot | null {
  const snapshots = Array.isArray(ready.snapshots) ? ready.snapshots : [];
  return [...snapshots.filter((s: AIStreamSnapshot) => s.metadata?.task_type === 'repair_replan')].sort((a, b) => b.lastSeq - a.lastSeq)[0] ?? null;
}
function reduceReady(prev: ReplanStreamState, ready: AIStreamReadyEvent): ReplanStreamState {
  const snapshot = pickReplanSnapshotFromReady(ready);
  if (!snapshot) return prev;
  return { latestSnapshot: snapshot, latestEvent: prev.latestEvent, phaseHistory: snapshot.phase ? Array.from(new Set([...prev.phaseHistory, snapshot.phase])) : prev.phaseHistory };
}
function reduceEvent(prev: ReplanStreamState, event: AIStreamEvent): ReplanStreamState {
  if (event.metadata?.task_type !== 'repair_replan') return prev;
  const phase = event.phase ?? prev.latestSnapshot?.phase ?? null;
  const latestSnapshot = { streamId: event.streamId, requestId: event.requestId, scopeType: event.scopeType, scopeId: event.scopeId, status: event.eventType === 'stream.persisted' ? 'persisted' : event.eventType === 'stream.failed' ? 'failed' : event.eventType === 'stream.cancelled' ? 'cancelled' : event.eventType === 'stream.completed' ? 'completed' : event.eventType === 'stream.delta' ? 'streaming' : prev.latestSnapshot?.status ?? 'started', lastSeq: event.seq, text: event.fullText ?? prev.latestSnapshot?.text ?? '', phase: phase ?? undefined, messageId: event.messageId ?? prev.latestSnapshot?.messageId, metadata: event.metadata ?? prev.latestSnapshot?.metadata, error: event.error ?? prev.latestSnapshot?.error, updatedAt: event.createdAt } satisfies AIStreamSnapshot;
  return { latestSnapshot, latestEvent: event, phaseHistory: phase ? Array.from(new Set([...prev.phaseHistory, phase])) : prev.phaseHistory };
}

const ExecutionReplan = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [waitingForAI, setWaitingForAI] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<{ reason: ReasonKey; mode: ModeKey }>({ reason: 'manual', mode: 'lower_pressure' });

  useEffect(() => {
    if (!planId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await getExecutionStatus(planId);
        setExecution(data);
        setFormValues({ reason: (data.status_reason && data.status_reason in reasonLabelMap ? data.status_reason : 'manual') as ReasonKey, mode: (data.replan_recommendation && data.replan_recommendation in modeLabelMap ? data.replan_recommendation : 'lower_pressure') as ModeKey });
        setWaitingForAI(data.journey_status === 'replanning' || Boolean(data.active_replan_stream_id));
      } catch (error: unknown) { toast.error(getErrorMessage(error, 'message.getExecutionStatusFail')); setExecution(null); }
      finally { setLoading(false); }
    })();
  }, [planId]);

  const { state: streamState, isRecovering } = useAIStreamSubscription<ReplanStreamState>({
    scopeType: 'repair_track', scopeId: execution?.track_id ?? null, enabled: Boolean(execution?.track_id) && waitingForAI,
    initialState: initialStreamState, reduceReady, reduceEvent,
    hasRecoverableState: (state) => Boolean(state.latestSnapshot),
    shouldClearRecoveringOnEvent: (event) => event.metadata?.task_type === 'repair_replan',
    onConnectionError: () => { setStreamError(null); },
    onTerminalError: (error) => { setStreamError(error.message); },
    isTerminalError: (error) => Boolean(error.status && error.status >= 400 && error.status !== 429),
  });

  const nextPlanId = useMemo(() => {
    const fromStream = typeof streamState.latestSnapshot?.metadata?.plan_id === 'string' ? streamState.latestSnapshot.metadata.plan_id : null;
    return fromStream || execution?.superseded_plan_id || null;
  }, [execution?.superseded_plan_id, streamState.latestSnapshot?.metadata]);

  useEffect(() => {
    if (streamState.latestSnapshot?.status === 'persisted' && nextPlanId) {
      toast.success(t('execReplan.successPersisted'));
      navigate(`/execution/${nextPlanId}/checkin`);
    }
  }, [navigate, nextPlanId, streamState.latestSnapshot?.status]);

  const handleSubmit = async () => {
    if (!execution?.track_id || submitting) return;
    setSubmitting(true); setStreamError(null);
    try { await replanTrack(execution.track_id, formValues); setWaitingForAI(true); toast.success(t('execReplan.submitSuccess')); }
    catch (error: unknown) { toast.error(getErrorMessage(error, 'message.operationFail')); }
    finally { setSubmitting(false); }
  };

  if (loading) return <ProtectedRoute><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div></ProtectedRoute>;

  if (!execution) return <ProtectedRoute><div className="mx-auto max-w-lg p-6"><AIErrorState title={t('execReplan.loadFailTitle')} description={t('execReplan.loadFailDesc')} actions={<Button size="sm" onClick={() => navigate('/execution/dashboard')}>{t('execReplan.backToDashboard')}</Button>} /></div></ProtectedRoute>;

  if (!execution.track_id && execution.superseded_plan_id) return (
    <ProtectedRoute><div className="mx-auto max-w-lg p-6"><div className="rounded-xl border border-success/30 bg-success/5 p-5 space-y-3"><div className="flex items-start gap-3"><CheckCircle className="size-5 text-success mt-0.5" /><div><p className="font-medium text-foreground">{t('execReplan.supersededTitle')}</p><p className="text-sm text-muted-foreground mt-1">{t('execReplan.supersededDesc')}</p></div></div><Button size="sm" onClick={() => navigate(`/execution/${execution.superseded_plan_id}/checkin`)}>{t('execReplan.goToLatest')}</Button></div></div></ProtectedRoute>
  );

  if (!execution.track_id) return (
    <ProtectedRoute><div className="mx-auto max-w-lg p-6"><div className="rounded-xl border border-warning/30 bg-warning/5 p-5 space-y-3"><p className="text-sm text-foreground">{t('execReplan.noTrack')}</p><Button size="sm" onClick={() => navigate('/execution/dashboard')}>{t('execReplan.backToDashboard')}</Button></div></div></ProtectedRoute>
  );

  const waitingSnapshot = streamState.latestSnapshot;
  const waitingPhase = waitingSnapshot?.phase ?? null;
  const isWaitingState = waitingForAI || execution.journey_status === 'replanning';

  return (
    <ProtectedRoute>
      <SEO title={t('execReplan.seoTitle')} description={t('execReplan.seoDesc')} />
      <div className="mx-auto max-w-2xl px-4 py-8" role="main">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="size-4" />{t('common.back')}</Button>
          <h2 className="text-xl font-bold text-foreground font-heading">{t('execReplan.heading')}</h2>
        </div>

        {/* Context */}
        <div className="mb-6 rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="font-semibold text-foreground">{execution.plan_summary?.title || t('execReplan.defaultTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('execReplan.contextDesc')}</p>
          {execution.current_step?.content && (
            <div className="flex items-start gap-2 rounded-lg bg-primary-light/30 p-3"><Info className="size-4 mt-0.5 text-primary shrink-0" /><div><p className="text-xs font-medium">{t('execReplan.stuckPoint')}</p><p className="text-xs text-muted-foreground">{execution.current_step.content}</p></div></div>
          )}
          {isRecovering && <AIRecoveryBadge text={t('execReplan.recovering')} />}
        </div>

        {isWaitingState ? (
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            <div><h4 className="text-base font-semibold text-foreground">{t('execReplan.waitingTitle')}</h4><p className="text-sm text-muted-foreground mt-1">{t('execReplan.waitingDesc')}</p></div>
            <AIPhaseTimeline currentPhase={waitingPhase} phaseHistory={streamState.phaseHistory} getLabel={(phase) => phaseLabelMap[phase]?.() || phase} />
            {waitingSnapshot?.text && (
              <div className={cn('rounded-lg p-3 text-sm', waitingSnapshot.status === 'failed' ? 'bg-destructive/5 border border-destructive/20' : waitingSnapshot.status === 'persisted' ? 'bg-success/5 border border-success/20' : 'bg-primary-light/30')}>
                <p className="font-medium text-foreground mb-1">{waitingSnapshot.status === 'persisted' ? t('execReplan.newVersionReady') : t('execReplan.adjustmentSummary')}</p>
                <p className="text-muted-foreground">{waitingSnapshot.text}</p>
              </div>
            )}
            {(waitingSnapshot?.status === 'failed' || streamError) ? (
              <AIErrorState title={t('execReplan.failedTitle')} description={streamError || waitingSnapshot?.error?.message || t('execReplan.failedDesc')} actions={<div className="flex gap-2"><Button size="sm" onClick={() => void handleSubmit()} disabled={submitting}>{submitting && <Loader2 className="size-3 animate-spin" />}{t('execReplan.retryBtn')}</Button><Button variant="outline" size="sm" onClick={() => navigate(`/execution/${execution.plan_id}/checkin`)}>{t('execReplan.backToStep')}</Button></div>} />
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-primary-light/20 p-3"><Info className="size-4 mt-0.5 text-primary shrink-0" /><p className="text-xs text-muted-foreground">{t('execReplan.leaveHint')}</p></div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">{t('execReplan.reasonLabel')}</legend>
              <div className="space-y-2">
                {Object.entries(reasonLabelMap).map(([value, labelFn]) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer"><input type="radio" name="reason" value={value} checked={formValues.reason === value} onChange={() => setFormValues((p) => ({ ...p, reason: value as ReasonKey }))} className="accent-primary" /><span className="text-sm">{labelFn()}</span></label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-foreground">{t('execReplan.modeLabel')}</legend>
              <div className="space-y-2">
                {Object.entries(modeLabelMap).map(([value, labelFn]) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer"><input type="radio" name="mode" value={value} checked={formValues.mode === value} onChange={() => setFormValues((p) => ({ ...p, mode: value as ModeKey }))} className="accent-primary" /><span className="text-sm">{labelFn()}</span></label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2">
              <Button onClick={() => void handleSubmit()} disabled={submitting}><RefreshCw className="size-4" />{submitting && <Loader2 className="size-4 animate-spin" />}{t('execReplan.submitBtn')}</Button>
              <Button variant="outline" onClick={() => navigate(`/execution/${execution.plan_id}/checkin`)}>{t('execReplan.backToStep')}</Button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ExecutionReplan;
