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
import { Compass, Heart, RefreshCw, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  generatePlans, getPlans, selectPlan,
  type PlanPreferences, type ReconciliationIntent, type ReconciliationPlan, type JourneyEntry,
} from '@/services/api/reconciliation';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import { EmptyState } from '@/components/common/EmptyState';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';
import { safeParsePlanContent } from '@/utils/planContent';
import { getDifficultyText, getPlanTypeText } from '@/utils/statusTags';

const intentMeta: Record<ReconciliationIntent, { title: string; subtitle: string }> = {
  repair: { title: '我想試著修復', subtitle: '先選一個最適合你們現在狀態的靠近方式，而不是把所有事一次解決。' },
  cool_down: { title: '我想先降溫，不急著決定', subtitle: '先穩住情緒和距離感，再決定要不要往下一步走。' },
  graceful_exit: { title: '我想體面地結束 / 拉開距離', subtitle: '有時候好好收尾，也是一種對彼此的尊重和照顧。' },
  safety_support: { title: '我需要安全支持', subtitle: '先讓自己回到更安全、更穩的狀態，比任何關係決定都重要。' },
};

const defaultPreferences: PlanPreferences = { pressure_level: 'low', pace: 'today', style: ['action'], invite_partner: true };

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

const ReconciliationList = () => {
  const { judgmentId } = useParams<{ judgmentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mountedRef = useMountedRef();
  const intent = (searchParams.get('intent') as ReconciliationIntent | null) || 'repair';
  const [plans, setPlans] = useState<ReconciliationPlan[]>([]);
  const [recommendedPlanId, setRecommendedPlanId] = useState<string | null>(null);
  const [journeyEntry, setJourneyEntry] = useState<JourneyEntry>(normalizeJourneyEntry(null));
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PlanPreferences>(defaultPreferences);

  const fetchLockRef = useRef(false);
  const generatingLockRef = useRef(false);
  const selectingPlanIdRef = useRef<string | null>(null);
  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    setPlans([]); setRecommendedPlanId(null); setJourneyEntry(normalizeJourneyEntry(null));
    if (judgmentId) void fetchPlans();
    return () => { staleRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgmentId, intent]);

  const fetchPlans = async () => {
    if (!judgmentId || fetchLockRef.current) return;
    fetchLockRef.current = true; setLoading(true); setLoadError(null);
    try {
      const bundle = await getPlans(judgmentId, { intent });
      if (staleRef.current) return;
      setPlans(normalizePlans(bundle)); setRecommendedPlanId(normalizeRecommendedPlanId(bundle)); setJourneyEntry(normalizeJourneyEntry(bundle));
    } catch (error: unknown) {
      if (staleRef.current) return;
      const err = error as { code?: string };
      if (err.code === 'NOT_FOUND' || err.code === 'HTTP_404') { setPlans([]); setRecommendedPlanId(null); }
      else { setLoadError(getErrorMessage(error, 'message.getPlansFail')); setPlans([]); }
    } finally { fetchLockRef.current = false; if (!staleRef.current) setLoading(false); }
  };

  const handleGeneratePlans = async (force = false) => {
    if (!judgmentId || generatingLockRef.current) return;
    generatingLockRef.current = true; setGenerating(true);
    try {
      const bundle = await generatePlans(judgmentId, { intent, preferences, force_regenerate: force });
      if (!mountedRef.current) return;
      setPlans(normalizePlans(bundle)); setRecommendedPlanId(normalizeRecommendedPlanId(bundle)); setJourneyEntry(normalizeJourneyEntry(bundle));
      toast.success(force ? '已根據你現在的狀態重新適配。' : '已整理出最適合你們的下一步。');
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
      toast.success('已記下你的承諾，接下來可以邀請對方一起試。');
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
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6" role="main" aria-label={t('reconList.pageLabel')}>
        {/* Header */}
        <div className="mb-8 text-center">
          <MediatorAvatar size="medium" animated />
          <h2 className="mt-4 text-2xl font-bold text-foreground font-heading md:text-3xl">{intentMeta[intent].title}</h2>
          <p className="mt-2 text-base text-muted-foreground max-w-2xl mx-auto">{intentMeta[intent].subtitle}</p>
          <Badge variant="secondary" className="mt-3"><Compass className="size-3 mr-1" />理解問題 → 選方向 → 選下一步 → 一起開始 → 持續修復</Badge>
        </div>

        {/* Preferences */}
        <div className="mb-8 rounded-xl border border-border bg-card p-6 space-y-5">
          <div>
            <h4 className="text-base font-semibold text-foreground mb-1">先告訴我，你想要什麼樣的節奏</h4>
            <p className="text-sm text-muted-foreground">這些偏好不會把你綁死，它只是幫我把第一個主推薦調得更貼近你們現在的狀態。</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">壓力承受度</span>
              <Select value={preferences.pressure_level} onValueChange={(v: string) => setPreferences((prev) => ({ ...prev, pressure_level: v as PlanPreferences['pressure_level'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">越低壓越好</SelectItem>
                  <SelectItem value="medium">可以有一點深度</SelectItem>
                  <SelectItem value="high">我願意面對比較難的步驟</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">希望節奏</span>
              <Select value={preferences.pace} onValueChange={(v: string) => setPreferences((prev) => ({ ...prev, pace: v as PlanPreferences['pace'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">今天就能開始</SelectItem>
                  <SelectItem value="this_week">這週內慢慢開始</SelectItem>
                  <SelectItem value="ease_in">先看看，慢一點也可以</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">是否想邀請對方一起加入</span>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button" role="switch" aria-checked={preferences.invite_partner}
                  onClick={() => setPreferences((prev) => ({ ...prev, invite_partner: !prev.invite_partner }))}
                  className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors', preferences.invite_partner ? 'bg-primary' : 'bg-muted')}
                >
                  <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform', preferences.invite_partner ? 'translate-x-5' : 'translate-x-0')} />
                </button>
                <span className="text-sm text-muted-foreground">{preferences.invite_partner ? '可以，之後再用低壓方式邀請' : '先不要，我想自己先試'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => handleGeneratePlans(plans.length > 0)} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}
              {plans.length > 0 ? '重新適配一次' : '看看最適合你們的下一步'}
            </Button>
            {plans.length > 0 && (
              <Button variant="outline" onClick={() => handleGeneratePlans(true)} disabled={generating}>
                <RefreshCw className="size-4" />強制重新生成
              </Button>
            )}
          </div>
        </div>

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
            <span className="text-sm text-muted-foreground">{generating ? '正在整理更貼近的方案...' : t('common.loading')}</span>
          </div>
        )}

        {/* Journey Entry Alert */}
        {!loading && journeyEntry.status !== 'none' && journeyEntry.active_plan_id && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-light/50 p-4">
            <Compass className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{journeyEntry.journey_context?.title || '你們已經有一輪正在進行中的旅程'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{journeyEntry.journey_context?.body || '你可以直接回到現在這一輪。'}</p>
            </div>
            <Button size="sm" onClick={handleJourneyContinue}>
              {journeyEntry.journey_context?.primary_cta.label || '回到這一輪'}
            </Button>
          </div>
        )}

        {/* Plans */}
        {!loading && !generating && !recommendedPlan && (
          <EmptyState variant="executions" title="還沒有主推薦" description="先按上方按鈕讓我根據你選的方向與節奏整理一次。" actionLabel="看看最適合你們的下一步" onAction={() => handleGeneratePlans(false)} />
        )}

        {!loading && !generating && recommendedPlan && (
          <div className="space-y-8">
            {/* Recommended Plan */}
            <div className="rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-success/10 text-success border-success/30">主推薦</Badge>
                <Badge variant="outline">{getPlanTypeText(recommendedPlan.plan_type)}</Badge>
                <Badge variant="outline">{getDifficultyText(recommendedPlan.difficulty_level)}</Badge>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">{recommendedPlan.content?.title || safeParsePlanContent(recommendedPlan.plan_content).title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{recommendedPlan.content?.description || safeParsePlanContent(recommendedPlan.plan_content).description}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-semibold text-foreground mb-1">為什麼我先推薦這個</p>
                  <p className="text-sm text-muted-foreground">{recommendedPlan.fit_reason || safeParsePlanContent(recommendedPlan.plan_content).fit_reason || '它最貼近你們現在想走的方向和節奏。'}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-semibold text-foreground mb-1">今天就能開始的第一步</p>
                  <p className="text-sm text-muted-foreground">{recommendedPlan.first_step || safeParsePlanContent(recommendedPlan.plan_content).first_step}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleCommitPlan(recommendedPlan.id)}>
                  <CheckCircle className="size-4" />
                  {recommendedPlan.commitment?.current_user.commitment_status === 'committed' ? '我已準備好，查看工作台' : '我願意先從這個開始'}
                </Button>
                <Button variant="outline" onClick={() => navigate(`/reconciliation/${judgmentId}/${recommendedPlan.id}`)}>查看完整方案</Button>
              </div>
            </div>

            {/* Alternate Plans */}
            {alternatePlans.length > 0 && (
              <div>
                <h4 className="mb-4 text-base font-semibold text-foreground">你也可以考慮這兩個備選</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {alternatePlans.map((plan) => {
                    const parsed = plan.content || safeParsePlanContent(plan.plan_content);
                    return (
                      <div key={plan.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">{getPlanTypeText(plan.plan_type)}</Badge>
                          <Badge variant="outline">{getDifficultyText(plan.difficulty_level)}</Badge>
                        </div>
                        <h4 className="text-base font-semibold text-foreground">{parsed.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-3">{parsed.description}</p>
                        <p className="text-xs text-muted-foreground">{plan.fit_reason || parsed.fit_reason}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/reconciliation/${judgmentId}/${plan.id}`)}>查看詳情</Button>
                          <Button size="sm" onClick={() => handleCommitPlan(plan.id)}>我想試這個</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default ReconciliationList;
