/**
 * 和好方案旅程頁面
 *
 * 遷移: Ant Card/Row/Col/Select/Switch/Tag/Typography/Alert/Space/Spin/Empty/message/Icons
 *       → shadcn + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（fetch plans, generate, select/commit, journey entry）
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Compass, Heart, CheckCircle, Loader2, AlertCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  generatePlans, getPlans, selectPlan,
  type PlanPreferences, type ReconciliationIntent, type ReconciliationPlan, type JourneyEntry, type ReconciliationPlanBundle,
} from '@/services/api/reconciliation';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { safeParsePlanContent } from '@/utils/planContent';
import { getDifficultyText, getPlanTypeText } from '@/utils/statusTags';

const intentMeta: Record<ReconciliationIntent, { title: () => string; subtitle: () => string }> = {
  repair: { title: () => t('reconList.intent.repair.title'), subtitle: () => t('reconList.intent.repair.subtitle') },
  cool_down: { title: () => t('reconList.intent.coolDown.title'), subtitle: () => t('reconList.intent.coolDown.subtitle') },
  graceful_exit: { title: () => t('reconList.intent.gracefulExit.title'), subtitle: () => t('reconList.intent.gracefulExit.subtitle') },
  safety_support: { title: () => t('reconList.intent.safetySupport.title'), subtitle: () => t('reconList.intent.safetySupport.subtitle') },
};

const defaultPreferences: PlanPreferences = { pressure_level: 'low', pace: 'today', style: ['action'], invite_partner: false };
const VALID_INTENTS = new Set<ReconciliationIntent>(['repair', 'cool_down', 'graceful_exit', 'safety_support']);
type RepairAccess = ReconciliationPlanBundle['repair_access'];

const normalizePlans = (payload: unknown): ReconciliationPlan[] => {
  if (Array.isArray(payload)) return payload as ReconciliationPlan[];
  if (payload && typeof payload === 'object' && 'plans' in payload) {
    const plans = (payload as { plans?: unknown }).plans;
    return Array.isArray(plans) ? (plans as ReconciliationPlan[]) : [];
  }
  return [];
};

const normalizeRecommendedPlanId = (payload: unknown): string | null => {
  if (payload && typeof payload === 'object' && 'recommended_plan_id' in payload) {
    const value = (payload as { recommended_plan_id?: unknown }).recommended_plan_id;
    return typeof value === 'string' ? value : null;
  }
  return null;
};

const normalizeJourneyEntry = (payload: unknown): JourneyEntry => {
  if (payload && typeof payload === 'object' && 'journey_entry' in payload) {
    const value = (payload as { journey_entry?: JourneyEntry }).journey_entry;
    if (value) return value;
  }
  return { status: 'none', track_id: null, active_plan_id: null, recommended_action: 'generate_bundle', last_pulse: null, has_superseded_versions: false };
};

const normalizeRepairAccess = (payload: unknown, intent: ReconciliationIntent): RepairAccess => {
  if (payload && typeof payload === 'object' && 'repair_access' in payload) {
    const value = (payload as { repair_access?: RepairAccess }).repair_access;
    if (value) return value;
  }
  return {
    judgment_route: 'standard',
    default_intent: intent,
    allowed_intents: [intent],
    can_invite_partner: false,
    can_use_co_repair: false,
    force_solo_repair: true,
    relationship_scope: 'unknown',
    reasons: [],
  };
};

const ReconciliationList = () => {
  const { judgmentId } = useParams<{ judgmentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mountedRef = useMountedRef();
  const intentParam = searchParams.get('intent');
  const requestedIntent = intentParam && VALID_INTENTS.has(intentParam as ReconciliationIntent)
    ? intentParam as ReconciliationIntent
    : null;
  const [intent, setIntent] = useState<ReconciliationIntent>(requestedIntent || 'repair');
  const [repairAccess, setRepairAccess] = useState<RepairAccess | null>(null);
  const [plans, setPlans] = useState<ReconciliationPlan[]>([]);
  const [recommendedPlanId, setRecommendedPlanId] = useState<string | null>(null);
  const [journeyEntry, setJourneyEntry] = useState<JourneyEntry>(normalizeJourneyEntry(null));
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PlanPreferences>(defaultPreferences);

  const fetchGenerationRef = useRef(0);
  const generatingLockRef = useRef(false);
  const selectingPlanIdRef = useRef<string | null>(null);

  useEffect(() => {
    const generation = ++fetchGenerationRef.current;
    setPlans([]); setRecommendedPlanId(null); setJourneyEntry(normalizeJourneyEntry(null)); setRepairAccess(null);
    if (judgmentId) void fetchPlans(generation);
    return () => {
      if (fetchGenerationRef.current === generation) fetchGenerationRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgmentId, requestedIntent]);

  const fetchPlans = async (generation = ++fetchGenerationRef.current) => {
    if (!judgmentId) return;
    setLoading(true); setLoadError(null);
    try {
      const bundle = await getPlans(judgmentId, requestedIntent ? { intent: requestedIntent } : undefined);
      if (fetchGenerationRef.current !== generation) return;
      const effectiveIntent = bundle.intent || requestedIntent || 'repair';
      const nextAccess = normalizeRepairAccess(bundle, effectiveIntent);
      setIntent(effectiveIntent);
      setRepairAccess(nextAccess);
      setPreferences((previous) => ({ ...previous, invite_partner: nextAccess.can_invite_partner ? previous.invite_partner : false }));
      setPlans(normalizePlans(bundle)); setRecommendedPlanId(normalizeRecommendedPlanId(bundle)); setJourneyEntry(normalizeJourneyEntry(bundle));
    } catch (error: unknown) {
      if (fetchGenerationRef.current !== generation) return;
      const err = error as { code?: string };
      if (err.code === 'NOT_FOUND' || err.code === 'HTTP_404') { setPlans([]); setRecommendedPlanId(null); }
      else { setLoadError(getErrorMessage(error, 'message.getPlansFail')); setPlans([]); }
    } finally {
      if (fetchGenerationRef.current === generation) setLoading(false);
    }
  };

  const handleGeneratePlans = async (force = false) => {
    if (!judgmentId || generatingLockRef.current) return;
    generatingLockRef.current = true; setGenerating(true);
    try {
      const bundle = await generatePlans(judgmentId, { intent, preferences, force_regenerate: force });
      if (!mountedRef.current) return;
      const effectiveIntent = bundle.intent || intent;
      const nextAccess = normalizeRepairAccess(bundle, effectiveIntent);
      setIntent(effectiveIntent);
      setRepairAccess(nextAccess);
      setPreferences((previous) => ({
        ...previous,
        invite_partner: nextAccess.can_invite_partner ? previous.invite_partner : false,
      }));
      setPlans(normalizePlans(bundle)); setRecommendedPlanId(normalizeRecommendedPlanId(bundle)); setJourneyEntry(normalizeJourneyEntry(bundle));
      toast.success(force ? t('reconList.regenerateSuccess') : t('reconList.generateSuccess'));
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.generatePlansFail'));
    } finally { generatingLockRef.current = false; if (mountedRef.current) setGenerating(false); }
  };

  const handleCommitPlan = async (planId: string) => {
    if (!judgmentId || selectingPlanIdRef.current) return;
    selectingPlanIdRef.current = planId;
    try {
      await selectPlan(planId);
      if (!mountedRef.current) return;
      toast.success(t('reconList.commitSuccess'));
      navigate(`/reconciliation/${judgmentId}/${planId}`);
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.selectPlanFail'));
    } finally { selectingPlanIdRef.current = null; }
  };

  const recommendedPlan = useMemo(() => {
    const safePlans = Array.isArray(plans) ? plans : [];
    if (safePlans.length === 0) return null;
    return safePlans.find((plan) => plan.id === recommendedPlanId) || safePlans[0];
  }, [plans, recommendedPlanId]);

  const alternatePlans = useMemo(() => {
    const safePlans = Array.isArray(plans) ? plans : [];
    if (!recommendedPlan) return [];
    return safePlans.filter((plan) => plan.id !== recommendedPlan.id).slice(0, 2);
  }, [plans, recommendedPlan]);

  const handleJourneyContinue = () => {
    if (!judgmentId) return;
    const journeyPath = journeyEntry.journey_context?.primary_cta.path;
    if (journeyPath) { navigate(journeyPath); return; }
    if (journeyEntry.recommended_action === 'resume_daily_step' && journeyEntry.active_plan_id) { navigate(`/execution/${journeyEntry.active_plan_id}/checkin`); return; }
    if (journeyEntry.recommended_action === 'replan_track' && journeyEntry.active_plan_id) { navigate(`/execution/${journeyEntry.active_plan_id}/replan`); return; }
    if (journeyEntry.recommended_action === 'resume_track' && journeyEntry.active_plan_id) { navigate(`/reconciliation/${judgmentId}/${journeyEntry.active_plan_id}`); return; }
    if (journeyEntry.active_plan_id) navigate(`/reconciliation/${judgmentId}/${journeyEntry.active_plan_id}`);
  };

  return (
    <ProtectedRoute>
      <SEO title={t('reconList.title')} description={t('reconList.description')} />
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12" aria-label={t('reconList.pageLabel')}>
        <header className="mb-9 max-w-2xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><Compass className="size-4" />{t('reconList.journeySteps')}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground font-heading md:text-4xl">{intentMeta[intent].title()}</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{intentMeta[intent].subtitle()}</p>
        </header>

        {repairAccess?.force_solo_repair && (
          <div className="mb-7 flex items-start gap-3 border-y border-primary/30 bg-primary/5 px-4 py-5" role="status">
            <Shield className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">{t('reconList.invitePartnerNo')}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{repairAccess.reasons[0] || intentMeta[intent].subtitle()}</p>
            </div>
          </div>
        )}

        {/* Preferences */}
        <section className="mb-8 space-y-5 border-y border-border py-6">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">{t('reconList.preferencesTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('reconList.preferencesDesc')}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">{t('reconList.pressureLevel')}</span>
              <Select value={preferences.pressure_level} onValueChange={(v: string) => setPreferences((prev) => ({ ...prev, pressure_level: v as PlanPreferences['pressure_level'] }))}>
                <SelectTrigger aria-label={t('reconList.pressureLevel')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('reconList.pressureLow')}</SelectItem>
                  <SelectItem value="medium">{t('reconList.pressureMedium')}</SelectItem>
                  <SelectItem value="high">{t('reconList.pressureHigh')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">{t('reconList.paceLabel')}</span>
              <Select value={preferences.pace} onValueChange={(v: string) => setPreferences((prev) => ({ ...prev, pace: v as PlanPreferences['pace'] }))}>
                <SelectTrigger aria-label={t('reconList.paceLabel')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{t('reconList.paceToday')}</SelectItem>
                  <SelectItem value="this_week">{t('reconList.paceThisWeek')}</SelectItem>
                  <SelectItem value="ease_in">{t('reconList.paceEaseIn')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {repairAccess?.can_invite_partner && <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">{t('reconList.invitePartnerLabel')}</span>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button" role="switch" aria-checked={preferences.invite_partner}
                  aria-label={t('reconList.invitePartnerLabel')}
                  onClick={() => setPreferences((prev) => ({ ...prev, invite_partner: !prev.invite_partner }))}
                  className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', preferences.invite_partner ? 'bg-primary' : 'bg-muted')}
                >
                  <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform', preferences.invite_partner ? 'translate-x-5' : 'translate-x-0')} />
                </button>
                <span className="text-sm text-muted-foreground">{preferences.invite_partner ? t('reconList.invitePartnerYes') : t('reconList.invitePartnerNo')}</span>
              </div>
            </div>}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => handleGeneratePlans(plans.length > 0)}
              disabled={generating || loading || !repairAccess}
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}
              {plans.length > 0 ? t('reconList.regenerateBtn') : t('reconList.generateBtn')}
            </Button>
          </div>
        </section>

        {/* Error */}
        {loadError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="flex-1"><p className="text-sm text-foreground">{loadError}</p></div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchPlans()}>{t('common.retry')}</Button>
              <Button variant="ghost" size="sm" onClick={() => judgmentId && navigate(`/judgment/${judgmentId}`)}>{t('reconList.backToJudgment')}</Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {(loading || generating) && (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{generating ? t('reconList.generatingHint') : t('common.loading')}</span>
          </div>
        )}

        {/* Journey Entry Alert */}
        {!loading && journeyEntry.status !== 'none' && journeyEntry.active_plan_id && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-light/50 p-4">
            <Compass className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{journeyEntry.journey_context?.title || t('reconList.journeyActiveTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{journeyEntry.journey_context?.body || t('reconList.journeyActiveBody')}</p>
            </div>
            <Button size="sm" onClick={handleJourneyContinue}>
              {journeyEntry.journey_context?.primary_cta.label || t('reconList.journeyActiveCta')}
            </Button>
          </div>
        )}

        {/* Plans */}
        {!loading && !generating && !recommendedPlan && (
          <EmptyState variant="executions" title={t('reconList.emptyTitle')} description={t('reconList.emptyDesc')} actionLabel={t('reconList.generateBtn')} onAction={() => handleGeneratePlans(false)} />
        )}

        {!loading && !generating && recommendedPlan && (
          <div className="space-y-10">
            {/* Recommended Plan */}
            <section className="space-y-5 border-y border-primary/30 bg-primary/[0.03] px-1 py-7 md:px-5">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-success/10 text-success border-success/30">{t('reconList.recommended')}</Badge>
                <Badge variant="outline">{getPlanTypeText(recommendedPlan.plan_type)}</Badge>
                <Badge variant="outline">{getDifficultyText(recommendedPlan.difficulty_level)}</Badge>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{recommendedPlan.content?.title || safeParsePlanContent(recommendedPlan.plan_content).title}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{recommendedPlan.content?.description || safeParsePlanContent(recommendedPlan.plan_content).description}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="border-l-2 border-primary/40 pl-4">
                  <p className="text-xs font-semibold text-foreground mb-1">{t('reconList.whyRecommend')}</p>
                  <p className="text-sm text-muted-foreground">{recommendedPlan.fit_reason || safeParsePlanContent(recommendedPlan.plan_content).fit_reason || t('reconList.defaultFitReason')}</p>
                </div>
                <div className="border-l-2 border-border pl-4">
                  <p className="text-xs font-semibold text-foreground mb-1">{t('reconList.firstStepToday')}</p>
                  <p className="text-sm text-muted-foreground">{recommendedPlan.first_step || safeParsePlanContent(recommendedPlan.plan_content).first_step}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleCommitPlan(recommendedPlan.id)}>
                  <CheckCircle className="size-4" />
                  {recommendedPlan.commitment?.current_user.commitment_status === 'committed' ? t('reconList.viewWorkbench') : t('reconList.commitFromThis')}
                </Button>
                <Button variant="outline" onClick={() => navigate(`/reconciliation/${judgmentId}/${recommendedPlan.id}`)}>{t('reconList.viewFullPlan')}</Button>
              </div>
            </section>

            {/* Alternate Plans */}
            {alternatePlans.length > 0 && (
              <div>
                <h2 className="mb-4 text-base font-semibold text-foreground">{t('reconList.alternateTitle')}</h2>
                <div className="divide-y divide-border border-y border-border">
                  {alternatePlans.map((plan) => {
                    const parsed = plan.content || safeParsePlanContent(plan.plan_content);
                    return (
                      <article key={plan.id} className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-center">
                        <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">{getPlanTypeText(plan.plan_type)}</Badge>
                          <Badge variant="outline">{getDifficultyText(plan.difficulty_level)}</Badge>
                        </div>
                        <h3 className="text-base font-semibold text-foreground">{parsed.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-3">{parsed.description}</p>
                        <p className="text-xs text-muted-foreground">{plan.fit_reason || parsed.fit_reason}</p>
                        </div>
                        <div className="flex gap-2 md:flex-col">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/reconciliation/${judgmentId}/${plan.id}`)}>{t('reconList.viewDetail')}</Button>
                          <Button size="sm" onClick={() => handleCommitPlan(plan.id)}>{t('reconList.tryThis')}</Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
};

export default ReconciliationList;
