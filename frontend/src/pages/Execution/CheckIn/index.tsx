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
import { ArrowLeft, CheckCircle, Upload, Loader2, AlertCircle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { checkin, getExecutionStatus, type ExecutionStatus } from '@/services/api/execution';
import { uploadEvidence } from '@/services/api/case';
import { getPlanById } from '@/services/api/reconciliation';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

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
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [stepResult, setStepResult] = useState<'done' | 'partial' | 'skipped'>('done');
  const [closeness, setCloseness] = useState<'closer' | 'same' | 'farther'>('same');
  const [stress, setStress] = useState<'low' | 'medium' | 'high'>('medium');
  const [needsHelp, setNeedsHelp] = useState(false);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    staleRef.current = false;
    if (planId) void fetchExecution();
    return () => { staleRef.current = true; if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current); };
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
    if (!planId || submitting) return;
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

      await checkin({ plan_id: planId, notes: notes || undefined, photos: photoUrls, step_result: stepResult, closeness, stress, needs_help: needsHelp });
      if (!mountedRef.current) return;
      setShowSuccessAnim(true);
      successTimeoutRef.current = setTimeout(() => {
        successTimeoutRef.current = null;
        if (!mountedRef.current) return;
        setShowSuccessAnim(false);
        toast.success(needsHelp ? t('execCheckIn.successNeedsHelp') : t('message.checkinSuccess'));
        setNotes(''); setPhotos([]); setStepResult('done'); setCloseness('same'); setStress('medium'); setNeedsHelp(false);
        void fetchExecution();
      }, 1500);
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.checkinFail'));
    } finally { if (mountedRef.current) setSubmitting(false); }
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
        <div className="mb-6 rounded-xl border border-border bg-card p-5 space-y-3">
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
                <div className="flex items-start gap-2 rounded-lg bg-primary-light/30 p-3"><Info className="size-4 mt-0.5 text-primary shrink-0" /><p className="text-xs text-muted-foreground">{t('execCheckIn.fallbackHint')}{execution.current_step.fallback_content}</p></div>
              )}
            </div>
          )}
        </div>

        {/* Check-in Form */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-5" aria-label={t('execCheckIn.formLabel')}>
          {/* Step Result */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t('execCheckIn.stepResultLabel')}</legend>
            <div className="flex flex-wrap gap-2">
              {([['done', t('execCheckIn.stepResult.done')], ['partial', t('execCheckIn.stepResult.partial')], ['skipped', t('execCheckIn.stepResult.skipped')]] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setStepResult(val as 'done' | 'partial' | 'skipped')} className={cn('rounded-full border px-4 py-2 text-sm transition-colors', stepResult === val ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/30')}>{label}</button>
              ))}
            </div>
          </fieldset>

          {/* Closeness */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t('execCheckIn.closenessLabel')}</legend>
            <div className="flex flex-wrap gap-2">
              {([['closer', t('execCheckIn.closeness.closer')], ['same', t('execCheckIn.closeness.same')], ['farther', t('execCheckIn.closeness.farther')]] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setCloseness(val as 'closer' | 'same' | 'farther')} className={cn('rounded-full border px-4 py-2 text-sm transition-colors', closeness === val ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/30')}>{label}</button>
              ))}
            </div>
          </fieldset>

          {/* Stress */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t('execCheckIn.stressLabel')}</legend>
            <div className="flex flex-wrap gap-2">
              {([['low', t('execCheckIn.stress.low')], ['medium', t('execCheckIn.stress.medium')], ['high', t('execCheckIn.stress.high')]] as const).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setStress(val as 'low' | 'medium' | 'high')} className={cn('rounded-full border px-4 py-2 text-sm transition-colors', stress === val ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/30')}>{label}</button>
              ))}
            </div>
          </fieldset>

          {/* Needs Help */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">{t('execCheckIn.needsHelpLabel')}</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="needsHelp" checked={!needsHelp} onChange={() => setNeedsHelp(false)} className="accent-primary" /><span className="text-sm">{t('execCheckIn.needsHelp.no')}</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="needsHelp" checked={needsHelp} onChange={() => setNeedsHelp(true)} className="accent-primary" /><span className="text-sm">{t('execCheckIn.needsHelp.yes')}</span></label>
            </div>
          </fieldset>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('execCheckIn.notesLabel')}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={1000} placeholder={t('execCheckIn.notesPlaceholder')} className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('execCheckIn.photosLabel')}</label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files || []).slice(0, 3))} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" />{t('execCheckIn.uploadBtn')}</Button>
            {photos.length > 0 && <p className="text-xs text-muted-foreground">{t('execCheckIn.photosSelected').replace('{count}', String(photos.length))}</p>}
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploadingPhotos}
            className="h-14 w-full rounded-2xl text-base font-semibold"
          >
            <AnimatePresence mode="wait">
              {showSuccessAnim ? (
                <motion.span key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-2">
                  <CheckCircle className="size-5" /> {t('execCheckIn.successInline')}
                </motion.span>
              ) : (
                <motion.span key="normal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {uploadingPhotos ? t('execCheckIn.uploadingPhotos') : submitting ? <Loader2 className="size-4 animate-spin" /> : t('execCheckIn.submitBtn')}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>

        {/* History */}
        {recentCheckins.length > 0 && (
          <div className="mt-8 rounded-xl border border-border bg-card p-5 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">{t('execCheckIn.historyTitle')}</h4>
            {recentCheckins.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">{item.result === 'done' ? t('execCheckIn.stepResult.done') : item.result === 'partial' ? t('execCheckIn.stepResult.partial') : t('execCheckIn.stepResult.skipped')}</p>
                <p className="text-xs text-muted-foreground">{t('execCheckIn.historyCloseness')}{item.closeness} / {t('execCheckIn.historyStress')}{item.stress} / {item.needs_help ? t('execCheckIn.historyNeedsHelp') : t('execCheckIn.historyNoHelp')}</p>
                {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                <p className="text-[11px] text-muted-foreground/60">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ExecutionCheckIn;
