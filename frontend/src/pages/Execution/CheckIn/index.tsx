/**
 * 今天的一小步（Check-In 頁面）
 *
 * 遷移: Ant Form/Radio/TextArea/Upload/Card/Alert/Button/Typography/Spin/Space/message/Icons
 *       → shadcn + 原生表單 + Tailwind + sonner + Lucide
 */

import { useEffect, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Loader2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkin, getExecutionStatus, type ExecutionStatus } from '@/services/api/execution';
import { uploadEvidence } from '@/services/api/case';
import { getPlanById } from '@/services/api/reconciliation';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/apiError';
import { getLocale, t } from '@/utils/i18n';

const normalizeExecutionStatus = (payload: ExecutionStatus): ExecutionStatus => ({
  ...payload,
  records: Array.isArray(payload.records) ? payload.records : [],
  recent_checkins: Array.isArray(payload.recent_checkins) ? payload.recent_checkins : [],
});

const ExecutionCheckIn = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const mountedRef = useMountedRef();
  const [execution, setExecution] = useState<ExecutionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const staleRef = useRef(false);
  const submitLockRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [stepResult, setStepResult] = useState<'done' | 'partial' | 'skipped' | null>(null);
  const [closeness, setCloseness] = useState<'closer' | 'same' | 'farther' | null>(null);
  const [stress, setStress] = useState<'low' | 'medium' | 'high' | null>(null);
  const [needsHelp, setNeedsHelp] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    staleRef.current = false;
    if (planId) void fetchExecution();
    return () => { staleRef.current = true; };
  }, [planId]);

  const fetchExecution = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const data = await getExecutionStatus(planId);
      if (staleRef.current) return;
      setExecution(normalizeExecutionStatus(data));
    } catch (error: unknown) {
      if (!staleRef.current) { toast.error(getErrorMessage(error, 'message.getExecutionStatusFail')); setExecution(null); }
    } finally { if (!staleRef.current) setLoading(false); }
  };

  const handleSubmit = async () => {
    if (!planId || submitting || submitLockRef.current) return;
    if (!stepResult) {
      toast.warning(t('execCheckIn.stepResultLabel'));
      return;
    }
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        setUploadingPhotos(true);
        try {
          const plan = await getPlanById(planId);
          if (plan?.judgment?.case_id) {
            const evidences = await uploadEvidence(plan.judgment.case_id, photos);
            photoUrls = evidences.map((item) => item.file_url);
          }
        } catch (photoErr: unknown) {
          if (mountedRef.current) toast.warning(getErrorMessage(photoErr, 'message.photoUploadFailContinue'));
        } finally { if (mountedRef.current) setUploadingPhotos(false); }
      }

      await checkin({
        plan_id: planId,
        notes: notes || undefined,
        photos: photoUrls,
        step_result: stepResult,
        closeness: closeness || undefined,
        stress: stress || undefined,
        needs_help: needsHelp ?? undefined,
      });
      if (!mountedRef.current) return;
      toast.success(needsHelp ? t('execCheckIn.successNeedsHelp') : t('message.checkinSuccess'));
      setNotes(''); setPhotos([]); setStepResult(null); setCloseness(null); setStress(null); setNeedsHelp(null);
      void fetchExecution();
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.checkinFail'));
    } finally { submitLockRef.current = false; if (mountedRef.current) setSubmitting(false); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  if (!execution) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-5 space-y-3">
          <p className="text-sm text-foreground">{t('execCheckIn.notFound')}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchExecution()}>{t('common.retry')}</Button>
            <Button size="sm" onClick={() => navigate('/execution/dashboard')}>{t('execCheckIn.backToDashboard')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const recentCheckins = Array.isArray(execution.recent_checkins) ? execution.recent_checkins : [];

  return (
    <ProtectedRoute>
      <SEO title={t('execCheckIn.title')} description={t('execCheckIn.description')} />
      <div className="mx-auto max-w-2xl px-4 py-8" role="main" aria-label={t('execCheckIn.pageLabel')}>
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label={t('execCheckIn.backAria')}><ArrowLeft className="size-4" />{t('execCheckIn.back')}</Button>
          <h2 className="text-xl font-bold text-foreground font-heading">{t('execCheckIn.heading')}</h2>
        </div>

        {/* Context Card */}
        <section className="mb-8 space-y-4 border-y border-border py-6">
          <p className="font-semibold text-foreground">{execution.plan_summary?.title || t('execCheckIn.defaultTitle')}</p>
          <p className="text-sm text-muted-foreground">{execution.relationship_mode === 'co' ? t('execCheckIn.modeCoDesc') : t('execCheckIn.modeSoloDesc')}</p>

          {execution.journey_status === 'replanning' && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 p-3">
              <AlertCircle className="size-4 mt-0.5 text-warning shrink-0" />
              <div className="flex-1"><p className="text-sm text-foreground">{t('execCheckIn.replanNeeded')}</p><p className="text-xs text-muted-foreground">{t('execCheckIn.replanReason')}</p></div>
              <Button size="sm" onClick={() => navigate(`/execution/${planId}/replan`)}>{t('execCheckIn.goReplan')}</Button>
            </div>
          )}

          {execution.current_step && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-foreground">{t('execCheckIn.todayTask')}</p>
              <p className="text-sm text-muted-foreground">{execution.current_step.content}</p>
              {execution.current_step.fallback_content && (
                <div className="flex items-start gap-2 border-l-2 border-primary/50 pl-3"><Info className="size-4 mt-0.5 text-primary shrink-0" /><p className="text-xs text-muted-foreground">{t('execCheckIn.fallbackHint')}{execution.current_step.fallback_content}</p></div>
              )}
            </div>
          )}
        </section>

        {/* Check-in Form */}
        <section className="space-y-6" aria-label={t('execCheckIn.formLabel')}>
          {/* Step Result */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t('execCheckIn.stepResultLabel')}</legend>
            <div className="flex flex-wrap gap-2">
              {([['done', t('execCheckIn.stepResult.done')], ['partial', t('execCheckIn.stepResult.partial')], ['skipped', t('execCheckIn.stepResult.skipped')]] as const).map(([val, label]) => (
                <button key={val} type="button" aria-pressed={stepResult === val} onClick={() => setStepResult(val as 'done' | 'partial' | 'skipped')} className={cn('rounded-full border px-4 py-2.5 min-h-[44px] text-sm transition-colors', stepResult === val ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/30')}>{label}</button>
              ))}
            </div>
          </fieldset>

          <details className="border-y border-border py-2">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-foreground">{t('execCheckIn.notesLabel')}</summary>
            <div className="space-y-6 pb-5 pt-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t('execCheckIn.closenessLabel')}</legend>
            <div className="flex flex-wrap gap-2">
              {([['closer', t('execCheckIn.closeness.closer')], ['same', t('execCheckIn.closeness.same')], ['farther', t('execCheckIn.closeness.farther')]] as const).map(([val, label]) => (
                <button key={val} type="button" aria-pressed={closeness === val} onClick={() => setCloseness(val as 'closer' | 'same' | 'farther')} className={cn('rounded-full border px-4 py-2.5 min-h-[44px] text-sm transition-colors', closeness === val ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/30')}>{label}</button>
              ))}
            </div>
          </fieldset>

          {/* Stress */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t('execCheckIn.stressLabel')}</legend>
            <div className="flex flex-wrap gap-2">
              {([['low', t('execCheckIn.stress.low')], ['medium', t('execCheckIn.stress.medium')], ['high', t('execCheckIn.stress.high')]] as const).map(([val, label]) => (
                <button key={val} type="button" aria-pressed={stress === val} onClick={() => setStress(val as 'low' | 'medium' | 'high')} className={cn('rounded-full border px-4 py-2.5 min-h-[44px] text-sm transition-colors', stress === val ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/30')}>{label}</button>
              ))}
            </div>
          </fieldset>

          {/* Needs Help */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t('execCheckIn.needsHelpLabel')}</legend>
            <div className="space-y-2">
              <label className="flex min-h-11 items-center gap-2 cursor-pointer"><input type="radio" name="needsHelp" checked={needsHelp === false} onChange={() => setNeedsHelp(false)} className="accent-primary" /><span className="text-sm">{t('execCheckIn.needsHelp.no')}</span></label>
              <label className="flex min-h-11 items-center gap-2 cursor-pointer"><input type="radio" name="needsHelp" checked={needsHelp === true} onChange={() => setNeedsHelp(true)} className="accent-primary" /><span className="text-sm">{t('execCheckIn.needsHelp.yes')}</span></label>
            </div>
          </fieldset>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="exec-checkin-notes" className="text-sm font-medium text-foreground">{t('execCheckIn.notesLabel')}</label>
            <textarea id="exec-checkin-notes" autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={1000} placeholder={t('execCheckIn.notesPlaceholder')} className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('execCheckIn.photosLabel')}</label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files || []).slice(0, 3))} className="hidden" />
            <Button variant="outline" size="sm" aria-label={t('execCheckIn.uploadBtn')} onClick={() => fileInputRef.current?.click()}><Upload className="size-4" />{t('execCheckIn.uploadBtn')}</Button>
            {photos.length > 0 && <p className="text-xs text-muted-foreground">{t('execCheckIn.photosSelected').replace('{count}', String(photos.length))}</p>}
          </div>
            </div>
          </details>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!stepResult || submitting || uploadingPhotos}
            aria-label={uploadingPhotos ? t('execCheckIn.uploadingPhotos') : t('execCheckIn.submitBtn')}
            className="h-12 w-full text-base font-semibold sm:w-auto"
          >
            {uploadingPhotos ? t('execCheckIn.uploadingPhotos') : submitting ? <Loader2 className="size-4 animate-spin" /> : t('execCheckIn.submitBtn')}
          </Button>
        </section>

        {/* History */}
        {recentCheckins.length > 0 && (
          <details className="mt-10 border-t border-border pt-2">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-foreground">{t('execCheckIn.historyTitle')}</summary>
            <div className="divide-y divide-border border-y border-border">
            {recentCheckins.map((item) => (
              <div key={item.id} className="space-y-1 py-4">
                <p className="text-sm font-medium text-foreground">{item.result === 'done' ? t('execCheckIn.stepResult.done') : item.result === 'partial' ? t('execCheckIn.stepResult.partial') : t('execCheckIn.stepResult.skipped')}</p>
                <p className="text-xs text-muted-foreground">{t('execCheckIn.historyCloseness')}{item.closeness} / {t('execCheckIn.historyStress')}{item.stress} / {item.needs_help ? t('execCheckIn.historyNeedsHelp') : t('execCheckIn.historyNoHelp')}</p>
                {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                <p className="text-[11px] text-muted-foreground/60">{new Date(item.created_at).toLocaleString(getLocale())}</p>
              </div>
            ))}
            </div>
          </details>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ExecutionCheckIn;
