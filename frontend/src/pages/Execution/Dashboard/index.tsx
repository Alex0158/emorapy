/**
 * 修復進展看板
 *
 * 遷移: Ant Card/Typography/Alert/Button/Progress/Tag/Row/Col/Empty/Spin/Space/message
 *       → shadcn + Tailwind + sonner + 狀態差異化卡片設計
 * 保留: 所有業務邏輯（fetch, sections, primary CTA, resume track）
 * 新增: 狀態差異化卡片（active=暖珊瑚、completed=淡綠、paused=琥珀、draft=虛線）
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getAllExecutionStatuses, resumeTrack, type ExecutionStatus } from '@/services/api/execution';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { EmptyState } from '@/components/common/EmptyState';
import SEO from '@/components/common/SEO';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import {
  getDifficultyText,
  getPlanTypeText,
} from '@/utils/statusTags';

const journeyStatusLabelMap: Record<string, () => string> = {
  draft: () => t('execDashboard.status.draft'),
  partner_invited: () => t('execDashboard.status.partnerInvited'),
  solo_active: () => t('execDashboard.status.soloActive'),
  co_active: () => t('execDashboard.status.coActive'),
  replanning: () => t('execDashboard.status.replanning'),
  paused: () => t('execDashboard.status.paused'),
  completed: () => t('execDashboard.status.completed'),
  closed: () => t('execDashboard.status.closed'),
};

const sectionOrder = ['draft', 'partner_invited', 'active', 'replanning', 'paused', 'completed'] as const;

const sectionMeta: Record<(typeof sectionOrder)[number], { title: () => string; matcher: (status: string) => boolean }> = {
  draft: { title: () => t('execDashboard.section.draft'), matcher: (status) => status === 'draft' },
  partner_invited: { title: () => t('execDashboard.section.partnerWaiting'), matcher: (status) => status === 'partner_waiting' || status === 'partner_invited' },
  active: { title: () => t('execDashboard.section.active'), matcher: (status) => status === 'active' || status === 'solo_active' || status === 'co_active' },
  replanning: { title: () => t('execDashboard.section.replanning'), matcher: (status) => status === 'replanning' },
  paused: { title: () => t('execDashboard.section.paused'), matcher: (status) => status === 'paused' },
  completed: { title: () => t('execDashboard.section.completed'), matcher: (status) => status === 'completed' || status === 'closed' },
};

const primaryCtaLabelMap: Record<string, () => string> = {
  commit_plan: () => t('execDashboard.cta.commitPlan'),
  view_invitation_status: () => t('execDashboard.cta.viewInvitation'),
  continue_today_step: () => t('execDashboard.cta.continueStep'),
  replan_track: () => t('execDashboard.cta.replan'),
  resume_track: () => t('execDashboard.cta.resume'),
  review_completed_journey: () => t('execDashboard.cta.reviewJourney'),
  review_history: () => t('execDashboard.cta.reviewHistory'),
};

// 卡片狀態差異化樣式
function getCardStyle(sectionKey: string) {
  switch (sectionKey) {
    case 'active': return 'border-l-4 border-l-primary bg-card shadow-sm hover:shadow-md';
    case 'completed': return 'border-l-4 border-l-success bg-success/5 opacity-80';
    case 'paused': return 'border-l-4 border-l-warning bg-warning/5';
    case 'replanning': return 'border-l-4 border-l-destructive bg-destructive/5';
    case 'draft': return 'border-2 border-dashed border-border bg-muted/30';
    default: return 'border border-border bg-card';
  }
}

const ExecutionDashboard = () => {
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<ExecutionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchLockRef = useRef(false);
  const staleRef = useRef(false);

  const fetchExecutions = async () => {
    if (fetchLockRef.current) return;
    fetchLockRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAllExecutionStatuses();
      if (staleRef.current) return;
      setExecutions(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = getErrorMessage(error, 'message.getExecutionStatusFail');
      setLoadError(msg);
      setExecutions([]);
      toast.error(msg);
    } finally {
      fetchLockRef.current = false;
      if (!staleRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    staleRef.current = false;
    void fetchExecutions();
    return () => { staleRef.current = true; };
  }, []);

  const sections = useMemo(() => (
    sectionOrder.map((key) => ({
      key,
      title: sectionMeta[key].title(),
      items: executions.filter((item) => sectionMeta[key].matcher(item.presentation_bucket || item.journey_status)),
    })).filter((section) => section.items.length > 0)
  ), [executions]);
  const hasVisibleJourneys = sections.length > 0;

  const handlePrimaryAction = async (item: ExecutionStatus) => {
    if (item.journey_context?.primary_cta.path) {
      navigate(item.journey_context.primary_cta.path);
      return;
    }
    if (item.primary_cta === 'replan_track') {
      navigate(`/execution/${item.plan_id}/replan`);
      return;
    }
    if (item.primary_cta === 'resume_track' && item.track_id) {
      try {
        const resumed = await resumeTrack(item.track_id);
        navigate(`/execution/${resumed.plan_id}/checkin`);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'message.operationFail'));
      }
      return;
    }
    if (item.primary_cta === 'view_invitation_status' || item.primary_cta === 'commit_plan' || item.primary_cta === 'review_history' || item.primary_cta === 'review_completed_journey') {
      if (item.judgment_id) {
        navigate(`/reconciliation/${item.judgment_id}/${item.plan_id}`);
      } else {
        navigate(item.plan_id ? `/execution/${item.plan_id}/checkin` : '/execution/dashboard');
      }
      return;
    }
    navigate(`/execution/${item.plan_id}/checkin`);
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO title={t('execDashboard.title')} description={t('execDashboard.description')} />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6" role="main" aria-label={t('execDashboard.pageLabel')}>
        {/* Header */}
        <header className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground font-heading">
            {t('execDashboard.heading')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('execDashboard.subtitle')}</p>
        </header>

        {/* Error */}
        {loadError && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm text-foreground">{loadError}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchExecutions()}>{t('common.retry')}</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>{t('common.back')}</Button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loadError && !hasVisibleJourneys && (
          <EmptyState
            variant="executions"
            actionLabel={t('execDashboard.goCaseList')}
            onAction={() => navigate('/case/list')}
          />
        )}

        {/* Sections */}
        {hasVisibleJourneys && (
          <div className="space-y-10">
            {sections.map((section, sectionIndex) => (
              <motion.div
                key={section.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: sectionIndex * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <h4 className="mb-4 text-base font-semibold text-foreground">{section.title}</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item) => (
                    <div
                      key={item.plan_id}
                      className={cn(
                        'flex flex-col rounded-xl p-5 transition-all',
                        getCardStyle(section.key),
                      )}
                    >
                      {/* Card Header */}
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground line-clamp-2">
                          {item.journey_context?.title || item.plan_summary?.title || t('execDashboard.planFallbackTitle').replace('{id}', item.plan_id.slice(0, 8))}
                        </span>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {item.relationship_mode === 'co' ? t('execDashboard.modeCo') : t('execDashboard.modeSolo')}
                        </Badge>
                      </div>

                      {/* Tags */}
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {item.plan_summary && (
                          <>
                            <Badge variant="outline" className="text-[10px]">{getPlanTypeText(item.plan_summary.plan_type)}</Badge>
                            <Badge variant="outline" className="text-[10px]">{getDifficultyText(item.plan_summary.difficulty_level)}</Badge>
                          </>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {journeyStatusLabelMap[item.journey_status]?.() || item.journey_status}
                        </Badge>
                      </div>

                      {/* Body */}
                      {(item.journey_context?.body || item.plan_summary?.fit_reason) && (
                        <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                          {item.journey_context?.body || item.plan_summary?.fit_reason}
                        </p>
                      )}

                      {/* Progress */}
                      <div className="mb-3">
                        <Progress value={item.progress} className="h-1.5" />
                      </div>

                      {/* Pulse */}
                      {item.pulse_summary && (
                        <p className="mb-2 text-[11px] text-muted-foreground">
                          {t('execDashboard.closeness')}{item.pulse_summary.closeness} / {t('execDashboard.stress')}{item.pulse_summary.stress}
                          {item.pulse_summary.needs_replan ? ` / ${t('execDashboard.suggestReplan')}` : ''}
                        </p>
                      )}
                      {item.status_reason && (
                        <p className="mb-2 text-[11px] text-muted-foreground">{t('execDashboard.currentStatus')}{item.status_reason}</p>
                      )}

                      {/* CTA */}
                      <div className="mt-auto pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handlePrimaryAction(item)}
                          className="w-full justify-between text-primary hover:text-primary-hover"
                        >
                          <span className="text-xs">
                            {item.journey_context?.primary_cta.label || primaryCtaLabelMap[item.primary_cta || 'continue_today_step']?.() || t('execDashboard.cta.viewJourney')}
                          </span>
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ExecutionDashboard;
