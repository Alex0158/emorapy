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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllExecutionStatuses, resumeTrack, type ExecutionStatus } from '@/services/api/execution';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import { EmptyState } from '@/components/common/EmptyState';
import SEO from '@/components/common/SEO';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

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
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12" aria-label={t('execDashboard.pageLabel')}>
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground font-heading md:text-4xl">
            {t('execDashboard.heading')}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{t('execDashboard.subtitle')}</p>
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
            {sections.map((section) => (
              <section key={section.key}>
                <h2 className="mb-4 text-base font-semibold text-foreground">{section.title}</h2>
                <div className="divide-y divide-border border-y border-border">
                  {section.items.map((item) => (
                    <article key={item.plan_id} className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground line-clamp-2">
                          {item.journey_context?.title || item.plan_summary?.title || t('execDashboard.planFallbackTitle').replace('{id}', item.plan_id.slice(0, 8))}
                          </span>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{item.relationship_mode === 'co' ? t('execDashboard.modeCo') : t('execDashboard.modeSolo')}</Badge>
                        </div>
                      {(item.journey_context?.body || item.plan_summary?.fit_reason) && (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-2">
                          {item.journey_context?.body || item.plan_summary?.fit_reason}
                        </p>
                      )}
                      </div>
                      <div>
                        <Button
                          variant={section.key === 'active' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => void handlePrimaryAction(item)}
                          className="w-full justify-between md:w-auto"
                        >
                          <span className="text-xs">
                            {item.journey_context?.primary_cta.label || primaryCtaLabelMap[item.primary_cta || 'continue_today_step']?.() || t('execDashboard.cta.viewJourney')}
                          </span>
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
};

export default ExecutionDashboard;
