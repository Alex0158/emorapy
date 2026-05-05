/**
 * 我的故事 — 心理畫像專頁
 *
 * 遷移: Ant Typography/Card/Collapse/Tag/Button/Progress/Modal/Tooltip/Empty/Spin/Alert/Space/Icons/message
 *       → shadcn Accordion + Dialog + Badge + Progress + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（profile fetch, domain narratives, insights, delete, interview trigger）
 * 保留: RichnessRing 業務組件
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, MessageCircle, Trash2, History, Lightbulb, BookOpen, Info, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import RichnessRing from '@/components/business/Interview/RichnessRing';
import { EmptyState } from '@/components/common/EmptyState';
import { usePsychProfileStore } from '@/store/psychProfileStore';
import { getErrorMessage } from '@/utils/apiError';
import { getInterviewResumeNavigationPath } from '@/utils/interviewResume';
import { useInterviewStore } from '@/store/interviewStore';
import { getDomainLabel } from '@/types/interview';
import type { PsychDomain, ProfileInsight, FeedbackHistoryItem, FeedbackCard } from '@/types/interview';
import SEO from '@/components/common/SEO';
import { getLocale, t } from '@/utils/i18n';

const ALL_DOMAINS: PsychDomain[] = ['attachment', 'family_origin', 'life_events', 'relationship_history', 'belief_values', 'cultural_background', 'personality', 'education_cognition'];

const MyStory: React.FC = () => {
  const navigate = useNavigate();
  const { profile, feedbackHistory, loading, error: storeError, fetchProfile, fetchFeedbackHistory, deleteAllData } = usePsychProfileStore();
  const { startSession, checkResume, retryFailed } = useInterviewStore();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failedSessionId, setFailedSessionId] = useState<string | null>(null);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const mountedRef = useMountedRef();
  const retryLockRef = useRef(false);
  const locale = getLocale();

  const getInsightTypeLabel = (insightType: string) => {
    const translated = t(`psychProfile.insightType.${insightType}`);
    return translated === `psychProfile.insightType.${insightType}` ? insightType : translated;
  };

  useEffect(() => {
    let cancelled = false;
    fetchProfile(); fetchFeedbackHistory();
    checkResume().then(data => { if (cancelled) return; if (data.has_failed && data.failed_session_id) setFailedSessionId(data.failed_session_id); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleStartChat = async () => {
    try {
      const resumeData = await checkResume();
      if (!mountedRef.current) return;
      const resumePath = getInterviewResumeNavigationPath(resumeData);
      if (resumePath) { navigate(resumePath); return; }
      const session = await startSession('organic');
      if (!mountedRef.current) return;
      navigate(`/interview/${session.id}`);
    } catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'interview.startFail')); }
  };

  const handleRetryFailed = async () => {
    if (!failedSessionId || retryLockRef.current) return;
    retryLockRef.current = true; setRetryingFailed(true);
    try {
      await retryFailed(failedSessionId);
      if (!mountedRef.current) return;
      toast.info(t('psychProfile.retryProcessing'));
      setFailedSessionId(null); navigate(`/interview/${failedSessionId}/result`);
    } catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'interview.retryFail')); }
    finally { retryLockRef.current = false; if (mountedRef.current) setRetryingFailed(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAllData();
      if (!mountedRef.current) return;
      toast.success(t('psychProfile.deleteSuccess')); setDeleteModalOpen(false); navigate('/profile/index');
    } catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'psychProfile.deleteFail')); }
    finally { if (mountedRef.current) setDeleting(false); }
  };

  if (loading && !profile) {
    return <div className="flex min-h-[60vh] items-center justify-center gap-3"><Loader2 className="size-8 animate-spin text-primary" /><span className="text-sm text-muted-foreground">{t('common.loading')}</span></div>;
  }

  if (!loading && !profile && storeError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-foreground">{storeError}</p></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchProfile()}>{t('common.retry')}</Button>
            <Button size="sm" onClick={() => navigate('/profile/index')}>{t('settings.goToProfile')}</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile?.consent_given) {
    return <div className="mx-auto max-w-lg p-6"><EmptyState variant="default" title={t('psychProfile.noStoryYet')} actionLabel={t('psychProfile.goStartStory')} onAction={() => navigate('/profile/index')} /></div>;
  }

  const latestNarratives = Array.isArray(profile.narratives) ? profile.narratives.filter((n) => n.is_latest && n.completeness > 0) : [];
  const activeInsights = Array.isArray(profile.insights) ? profile.insights.filter((i) => i.is_active) : [];
  const exploredDomains = latestNarratives.map((n) => n.domain);
  const unexploredDomains = ALL_DOMAINS.filter((d) => !exploredDomains.includes(d));
  const insightsByDomain = activeInsights.reduce<Record<string, ProfileInsight[]>>((acc, i) => { if (!acc[i.domain]) acc[i.domain] = []; acc[i.domain].push(i); return acc; }, {});

  return (
    <>
      <SEO title={t('psychProfile.myStoryTitle')} description={t('psychProfile.myStoryDesc')} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-4xl px-4 py-8 md:px-6" role="main">
        {/* Failed session alert */}
        {failedSessionId && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t('psychProfile.failedSessionTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('psychProfile.failedSessionDesc')}</p>
            </div>
            <Button size="sm" onClick={handleRetryFailed} disabled={retryingFailed}>
              {retryingFailed && <Loader2 className="size-3 animate-spin" />}{t('psychProfile.retryProcessing')}
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile/index')}><ArrowLeft className="size-5" /></Button>
          <h2 className="text-2xl font-bold text-foreground font-heading">{t('psychProfile.myStoryTitle')}</h2>
        </div>

        {/* Disclaimer */}
        <p className="mb-4 text-xs text-muted-foreground/80">{t('psychProfile.disclaimer')}</p>

        {/* Overview */}
        <div className="mb-8 rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
            <div className="flex flex-col items-center shrink-0">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-xs text-muted-foreground">{t('psychProfile.richnessLabel')}</span>
                <Info className="size-3 text-muted-foreground" aria-label={t('psychProfile.domainOverviewHint')} />
              </div>
              <RichnessRing score={profile.richness_score || 0} size={120} hasDomainProgress={exploredDomains.length > 0} />
            </div>
            <div className="flex-1 space-y-5">
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">{t('psychProfile.exploredDomains')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {exploredDomains.length === 0 ? <span className="text-xs text-muted-foreground">{t('psychProfile.noExploredDomainsYet')}</span> : exploredDomains.map((d) => <Badge key={d} variant="secondary" className="text-xs">{getDomainLabel(d as PsychDomain)}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">{t('psychProfile.unexploredDomains')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {unexploredDomains.map((d) => <Badge key={d} variant="outline" className="text-xs text-muted-foreground">{getDomainLabel(d as PsychDomain)}</Badge>)}
                </div>
              </div>
              <Button onClick={handleStartChat}><MessageCircle className="size-4" />{t('psychProfile.continueChat')}</Button>
            </div>
          </div>
        </div>

        {/* Domain Details (Accordion) */}
        <div className="mb-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="size-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground font-heading">{t('psychProfile.domainDetails')}</h3>
          </div>
          {latestNarratives.length === 0 ? (
            <EmptyState variant="default" title={t('psychProfile.noDomainData')} />
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {latestNarratives.map((narrative) => (
                <AccordionItem key={narrative.domain} value={narrative.domain} className="rounded-lg border border-border px-4">
                  <AccordionTrigger className="py-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs">{getDomainLabel(narrative.domain as PsychDomain)}</Badge>
                      <Progress value={Math.round(narrative.completeness * 100)} className="w-20 h-1.5" />
                      <span className="text-xs text-muted-foreground">{Math.round(narrative.completeness * 100)}%</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-4">
                    {narrative.ai_summary && (
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{t('psychProfile.aiSummary')}：</p>
                        <p className="text-sm text-foreground leading-relaxed">{narrative.ai_summary}</p>
                      </div>
                    )}
                    {insightsByDomain[narrative.domain]?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1"><Lightbulb className="size-3" />{t('psychProfile.insightsForDomain')}：</p>
                        <div className="space-y-2">
                          {insightsByDomain[narrative.domain].map((insight) => (
                            <div key={insight.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">{getInsightTypeLabel(insight.insight_type)}</Badge>
                                <span className="text-sm font-semibold text-foreground">{insight.key}</span>
                                <Progress value={Math.round(insight.confidence * 100)} className="w-12 h-1" />
                              </div>
                              <p className="text-sm text-muted-foreground">{insight.value}</p>
                              {insight.evidence && <p className="text-xs italic text-primary/70 bg-primary-light/30 p-2 rounded">「{insight.evidence}」</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        {/* Interview History */}
        {feedbackHistory.length > 0 && (
          <div className="mb-8 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="size-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground font-heading">{t('psychProfile.interviewHistory')}</h3>
            </div>
            <div className="space-y-3">
              {feedbackHistory.map((item: FeedbackHistoryItem) => {
                let card: FeedbackCard | null = null;
                try { card = item.feedback_card ? JSON.parse(item.feedback_card) : null; } catch { /* ignore */ }
                return (
                  <div key={item.session_id} className="rounded-lg border border-border p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString(locale)}</span>
                      <div className="flex flex-wrap gap-1">{item.domains_touched.map((d) => <Badge key={d} variant="secondary" className="text-[10px]">{getDomainLabel(d as PsychDomain)}</Badge>)}</div>
                    </div>
                    {card?.summary && <p className="text-sm text-muted-foreground">{card.summary}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delete Data */}
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 space-y-3">
          <h5 className="text-base font-semibold text-destructive">{t('psychProfile.manageData')}</h5>
          <p className="text-sm text-destructive/70">{t('psychProfile.manageDataDesc')}</p>
          <Button variant="destructive" size="sm" onClick={() => setDeleteModalOpen(true)}>
            <Trash2 className="size-4" />{t('psychProfile.deleteAllData')}
          </Button>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader><DialogTitle>{t('psychProfile.deleteConfirmTitle')}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{t('psychProfile.deleteConfirmDesc')}</p>
            <p className="text-sm font-medium text-destructive">{t('psychProfile.deleteWarning')}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>{t('common.cancel')}</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting && <Loader2 className="size-4 animate-spin" />}{t('psychProfile.confirmDelete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </>
  );
};

export default MyStory;
