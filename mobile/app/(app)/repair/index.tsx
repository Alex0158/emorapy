import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReconciliationPlan, ReconciliationPlanBundle, ReplanTrackInput } from '@cj/api-client';
import type { AIStreamEvent, AIStreamSnapshot } from '@cj/contracts/ai-stream';

import { connectRepairTrackStream, m4Api, normalizeM4Error } from '@/src/features/m4/api';
import { t, useLocale } from '@/src/i18n';
import type { AIStreamCallbacks, AIStreamReadyEvent } from '@/src/platform/sse/aiStreamState';
import { isTerminalAIStreamEvent } from '@/src/platform/sse/aiStreamState';
import { useAIStreamSubscription } from '@/src/platform/sse/useAIStreamSubscription';
import { formatAIStreamDisplayError } from '@/src/platform/sse/streamErrorDisplay';
import { tokenStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

type ReplanMode = ReplanTrackInput['mode'];
type ReplanReason = ReplanTrackInput['reason'];
type ReplanStreamStatus = 'idle' | 'ready' | 'streaming' | 'persisted' | 'failed';

const MAX_CHECKIN_NOTES_LENGTH = 600;

interface ReplanStreamState {
  status: ReplanStreamStatus;
  text: string;
  phase: string | null;
  planId: string | null;
  error: string | null;
}

const initialReplanStreamState: ReplanStreamState = {
  status: 'idle',
  text: '',
  phase: null,
  planId: null,
  error: null,
};

const replanModes: Array<{ labelKey: string; value: ReplanMode; tone: 'teal' | 'blue' | 'amber' }> = [
  { labelKey: 'repair.replanMode.lowerPressure', value: 'lower_pressure', tone: 'teal' },
  { labelKey: 'repair.replanMode.slowerPace', value: 'slower_pace', tone: 'blue' },
  { labelKey: 'repair.replanMode.soloFirst', value: 'solo_first', tone: 'amber' },
];

const replanReasons: Array<{ labelKey: string; value: ReplanReason; tone: 'teal' | 'blue' | 'amber' | 'coral' }> = [
  { labelKey: 'repair.replanReason.needsHelp', value: 'needs_help', tone: 'teal' },
  { labelKey: 'repair.replanReason.farther', value: 'farther', tone: 'blue' },
  { labelKey: 'repair.replanReason.highStress', value: 'high_stress', tone: 'coral' },
  { labelKey: 'repair.replanReason.manual', value: 'manual', tone: 'amber' },
];

const replanStreamStatusLabels: Record<ReplanStreamStatus, string> = {
  idle: 'repair.replanStatus.idle',
  ready: 'repair.replanStatus.ready',
  streaming: 'repair.replanStatus.streaming',
  persisted: 'repair.replanStatus.persisted',
  failed: 'repair.replanStatus.failed',
};

const replanPhaseLabels: Record<string, string> = {
  collecting_context: 'repair.replanPhase.collectingContext',
  drafting: 'repair.replanPhase.drafting',
  validating: 'repair.replanPhase.validating',
  persisted: 'repair.replanPhase.persisted',
};

const journeyStatusLabels: Record<string, string> = {
  solo_active: 'repair.journeyStatus.soloActive',
  co_active: 'repair.journeyStatus.coActive',
  paused: 'repair.journeyStatus.paused',
  completed: 'repair.journeyStatus.completed',
  replanning: 'repair.journeyStatus.replanning',
  cancelled: 'repair.journeyStatus.cancelled',
};

const executionStatusLabels: Record<string, string> = {
  pending: 'repair.executionStatus.pending',
  in_progress: 'repair.executionStatus.inProgress',
  completed: 'repair.executionStatus.completed',
  skipped: 'repair.executionStatus.skipped',
  failed: 'repair.executionStatus.failed',
};

const difficultyLabels: Record<string, string> = {
  easy: 'repair.difficulty.easy',
  medium: 'repair.difficulty.medium',
  hard: 'repair.difficulty.hard',
};

const planTypeLabels: Record<string, string> = {
  activity: 'repair.planType.activity',
  communication: 'repair.planType.communication',
  gift: 'repair.planType.gift',
  intimacy: 'repair.planType.intimacy',
  service: 'repair.planType.service',
};

function labelLifecycleStatus(status: string): string {
  if (status === 'active' || status === 'unknown') return '';
  if (status === 'background') return t('repair.lifecycle.background');
  if (status === 'inactive') return t('repair.lifecycle.inactive');
  return t('repair.lifecycle.updating');
}

function labelJourneyStatus(status?: string | null): string {
  if (!status) return t('repair.journeyStatus.updating');
  return t(journeyStatusLabels[status] ?? 'repair.journeyStatus.updating');
}

function labelExecutionStatus(status?: string | null): string {
  if (!status) return t('repair.executionStatus.updating');
  return t(executionStatusLabels[status] ?? 'repair.executionStatus.updating');
}

function labelDifficulty(value?: string | null): string {
  if (!value) return t('repair.difficulty.unknown');
  return t(difficultyLabels[value] ?? 'repair.difficulty.unknown');
}

function labelPlanTitle(plan: ReconciliationPlan): string {
  return plan.fit_reason || t(planTypeLabels[plan.plan_type] ?? 'repair.planTitle.fallback');
}

function labelDashboardPlanTitle(status: { plan_summary?: { title?: string | null } | null }): string {
  return status.plan_summary?.title || t('repair.dashboard.titleFallback');
}

function labelPlanRecommendation(isRecommended?: boolean | null): string {
  return isRecommended ? t('repair.planRecommendation.recommended') : t('repair.planRecommendation.optional');
}

function getFirstParam(value?: string | string[]): string {
  return typeof value === 'string' ? value : value?.[0] ?? '';
}

function checkinNotesHelperText(value: string): string {
  const length = value.trim().length;
  if (!length) return t('repair.checkinNotes.empty');
  return t('repair.checkinNotes.ready', { length, max: MAX_CHECKIN_NOTES_LENGTH });
}

function isRepairReplanStreamPayload(value: { metadata?: Record<string, unknown> | undefined }): boolean {
  return value.metadata?.task_type === 'repair_replan';
}

function pickLatestReplanSnapshot(ready: AIStreamReadyEvent): AIStreamSnapshot | null {
  const snapshots = Array.isArray(ready.snapshots) ? ready.snapshots : [];
  return [...snapshots]
    .filter(isRepairReplanStreamPayload)
    .sort((a, b) => b.lastSeq - a.lastSeq)[0] ?? null;
}

function replanStatusFromEvent(event: AIStreamEvent): ReplanStreamStatus {
  if (event.eventType === 'stream.failed' || event.eventType === 'stream.cancelled') return 'failed';
  if (event.eventType === 'stream.persisted' || event.eventType === 'stream.completed') return 'persisted';
  if (event.eventType === 'stream.delta' || event.eventType === 'stream.phase' || event.eventType === 'stream.started') {
    return 'streaming';
  }
  return 'ready';
}

function replanStatusFromSnapshot(snapshot: AIStreamSnapshot): ReplanStreamStatus {
  if (snapshot.status === 'failed' || snapshot.status === 'cancelled') return 'failed';
  if (snapshot.status === 'persisted' || snapshot.status === 'completed') return 'persisted';
  if (snapshot.status === 'streaming' || snapshot.status === 'started' || snapshot.status === 'queued') return 'streaming';
  return 'ready';
}

function getReplanStreamDetail(
  state: ReplanStreamState,
  isRecovering: boolean,
  lifecycleStatus: string
): string {
  const status = isRecovering ? t('repair.replanStatus.recovering') : t(replanStreamStatusLabels[state.status]);
  const phase = state.phase ? ` / ${t(replanPhaseLabels[state.phase] ?? 'repair.replanPhase.updating')}` : '';
  const lifecycle = labelLifecycleStatus(lifecycleStatus);
  return `${status}${phase}${lifecycle ? ` / ${lifecycle}` : ''}`;
}

export default function RepairScreen() {
  useLocale();
  const params = useLocalSearchParams<{ judgmentId?: string | string[]; planId?: string | string[]; trackId?: string | string[] }>();
  const queryClient = useQueryClient();
  const [judgmentId, setJudgmentId] = useState(() => getFirstParam(params.judgmentId));
  const [planId, setPlanId] = useState(() => getFirstParam(params.planId));
  const [replanTrackId, setReplanTrackId] = useState(() => getFirstParam(params.trackId));
  const [replanMode, setReplanMode] = useState<ReplanMode>('lower_pressure');
  const [replanReason, setReplanReason] = useState<ReplanReason>('manual');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [latestBundle, setLatestBundle] = useState<ReconciliationPlanBundle | null>(null);

  const authQuery = useQuery({
    queryKey: ['app', 'auth-token'],
    queryFn: () => tokenStorage.getToken(),
  });
  const isAuthenticated = Boolean(authQuery.data);

  const dashboardQuery = useQuery({
    queryKey: ['m4', 'execution-dashboard'],
    queryFn: () => m4Api.execution.getDashboard(),
    enabled: isAuthenticated,
  });

  const refreshRepair = async () => {
    await queryClient.invalidateQueries({ queryKey: ['m4', 'execution-dashboard'] });
  };

  const activeReplanTrackId = replanTrackId.trim();
  const activeJudgmentId = judgmentId.trim();
  const activePlanId = planId.trim();

  const connectReplanStream = useCallback((callbacks: AIStreamCallbacks, options: { afterSeq?: number; signal?: AbortSignal }) => {
    if (!activeReplanTrackId) return Promise.resolve();
    return connectRepairTrackStream(activeReplanTrackId, callbacks, options);
  }, [activeReplanTrackId]);

  const {
    state: replanStreamState,
    setState: setReplanStreamState,
    isRecovering: replanRecovering,
    lifecycleStatus: replanLifecycleStatus,
  } = useAIStreamSubscription<ReplanStreamState>({
    scopeKey: activeReplanTrackId ? `repair_track:${activeReplanTrackId}` : null,
    enabled: isAuthenticated && Boolean(activeReplanTrackId),
    initialState: initialReplanStreamState,
    connect: connectReplanStream,
    normalizeError: normalizeM4Error,
    reduceReady: (prev, ready) => {
      const latest = pickLatestReplanSnapshot(ready);
      if (!latest) return { ...prev, status: 'ready', error: null };
      return {
        status: replanStatusFromSnapshot(latest),
        text: latest.text ?? '',
        phase: latest.phase ?? null,
        planId: typeof latest.metadata?.plan_id === 'string' ? latest.metadata.plan_id : prev.planId,
        error: formatAIStreamDisplayError(latest.error),
      };
    },
    reduceEvent: (prev, event) => {
      if (!isRepairReplanStreamPayload(event)) return prev;
      return {
        status: replanStatusFromEvent(event),
        text: event.fullText
          ?? (event.eventType === 'stream.delta' ? `${prev.text}${event.deltaText ?? ''}` : prev.text),
        phase: event.phase ?? prev.phase,
        planId: typeof event.metadata?.plan_id === 'string' ? event.metadata.plan_id : prev.planId,
        error: formatAIStreamDisplayError(event.error),
      };
    },
    hasRecoverableState: (value) => Boolean(value.text || value.phase) && value.status !== 'persisted' && value.status !== 'failed',
    shouldClearRecoveringOnEvent: (event) => isRepairReplanStreamPayload(event) && (event.eventType === 'stream.delta' || isTerminalAIStreamEvent(event)),
    onEvent: (event) => {
      if (isRepairReplanStreamPayload(event) && event.eventType === 'stream.persisted') {
        void refreshRepair();
      }
    },
    onConnectionError: (error) => {
      setReplanStreamState((prev) => ({ ...prev, error: formatAIStreamDisplayError(error) }));
    },
    onTerminalError: (error) => {
      setReplanStreamState((prev) => ({ ...prev, status: 'failed', error: formatAIStreamDisplayError(error) }));
    },
  });

  const getPlansMutation = useMutation({
    mutationFn: () => m4Api.reconciliation.getPlans(activeJudgmentId, { intent: 'repair' }),
    onSuccess: (bundle) => {
      setLatestBundle(bundle);
      if (bundle.recommended_plan_id) setPlanId(bundle.recommended_plan_id);
    },
  });
  const generatePlansMutation = useMutation({
    mutationFn: () => m4Api.reconciliation.generatePlans(activeJudgmentId, { intent: 'repair' }),
    onSuccess: (bundle) => {
      setLatestBundle(bundle);
      if (bundle.recommended_plan_id) setPlanId(bundle.recommended_plan_id);
    },
  });
  const selectPlanMutation = useMutation({
    mutationFn: (targetPlanId: string) => m4Api.reconciliation.selectPlan(targetPlanId),
    onSuccess: async (plan) => {
      setPlanId(plan.id);
      await refreshRepair();
    },
  });
  const confirmExecutionMutation = useMutation({
    mutationFn: (targetPlanId: string) => m4Api.execution.confirm(targetPlanId),
    onSuccess: async (_result, targetPlanId) => {
      setPlanId(targetPlanId);
      await refreshRepair();
    },
  });
  const checkinMutation = useMutation({
    mutationFn: () => m4Api.execution.checkin({
      plan_id: activePlanId,
      notes: checkinNotes.trim() || undefined,
      step_result: 'done',
      closeness: 'same',
      stress: 'medium',
      needs_help: false,
    }),
    onSuccess: async () => {
      setCheckinNotes('');
      await refreshRepair();
    },
  });
  const replanMutation = useMutation({
    mutationFn: () => m4Api.execution.replanTrack(activeReplanTrackId, {
      mode: replanMode,
      reason: replanReason,
    }),
    onSuccess: async (accepted) => {
      setReplanTrackId(accepted.scope_id);
      setReplanStreamState({
        status: 'streaming',
        text: '',
        phase: 'collecting_context',
        planId: null,
        error: null,
      });
      await refreshRepair();
    },
  });

  const errorMessage = dashboardQuery.error
    ? normalizeM4Error(dashboardQuery.error).message
    : getPlansMutation.error
      ? normalizeM4Error(getPlansMutation.error).message
      : generatePlansMutation.error
        ? normalizeM4Error(generatePlansMutation.error).message
        : selectPlanMutation.error
          ? normalizeM4Error(selectPlanMutation.error).message
          : confirmExecutionMutation.error
            ? normalizeM4Error(confirmExecutionMutation.error).message
            : checkinMutation.error
              ? normalizeM4Error(checkinMutation.error).message
              : replanMutation.error
                ? normalizeM4Error(replanMutation.error).message
                : replanStreamState.error;

  useEffect(() => {
    const nextJudgmentId = getFirstParam(params.judgmentId);
    if (nextJudgmentId) setJudgmentId(nextJudgmentId);
  }, [params.judgmentId]);

  useEffect(() => {
    const nextPlanId = getFirstParam(params.planId);
    if (nextPlanId) setPlanId(nextPlanId);
  }, [params.planId]);

  useEffect(() => {
    const nextTrackId = getFirstParam(params.trackId);
    if (nextTrackId) setReplanTrackId(nextTrackId);
  }, [params.trackId]);

  if (!isAuthenticated) {
    return (
      <Screen
        eyebrow={t('repair.eyebrow')}
        title={t('repair.authGate.title')}
        subtitle={t('repair.authGate.subtitle')}
        testID="repair.auth-gate.screen">
        <Panel title={t('repair.authGate.panel')}>
          <FeatureRow title={t('repair.authGate.fromAnalysis.title')} detail={t('repair.authGate.fromAnalysis.detail')} tone="teal" />
          <FeatureRow title={t('repair.authGate.sync.title')} detail={t('repair.authGate.sync.detail')} tone="blue" />
        </Panel>
        <LinkButton href="/auth" label={t('profile.authGate.login')} tone="teal" testID="repair.auth-gate.login" />
      </Screen>
    );
  }

  return (
    <Screen eyebrow={t('repair.eyebrow')} title={t('repair.title')} subtitle={t('repair.subtitle')} testID="repair.screen">
      <Panel title={t('repair.dashboardPanel')}>
        <StatusPill label={t('repair.dashboard.count', { count: dashboardQuery.data?.length ?? 0 })} tone="coral" />
        {(dashboardQuery.data ?? []).slice(0, 4).map((status) => (
          <View key={status.plan_id} style={styles.statusCard}>
            <Text style={styles.statusTitle}>{labelDashboardPlanTitle(status)}</Text>
            <FeatureRow title={t('repair.dashboard.status')} detail={`${labelJourneyStatus(status.journey_status)} / ${labelExecutionStatus(status.status)}`} tone="teal" />
            <FeatureRow title={t('repair.dashboard.progress')} detail={`${Math.round((status.progress ?? 0) * 100)}%`} tone="blue" />
            {status.current_step ? (
              <FeatureRow title={t('repair.dashboard.todayStep')} detail={status.current_step.content} tone="coral" />
            ) : null}
            {status.track_id ? (
              <ActionButton
                label={t('repair.dashboard.selectReplan')}
                onPress={() => {
                  setReplanTrackId(status.track_id ?? '');
                  setPlanId(status.plan_id);
                }}
                testID={`repair.track.${status.track_id}.select-replan`}
                tone="amber"
                variant="outline"
              />
            ) : null}
          </View>
        ))}
        {dashboardQuery.data?.length ? null : (
          <Text style={styles.emptyText}>{t('repair.dashboard.empty')}</Text>
        )}
      </Panel>

      <Panel title={t('repair.plansPanel')}>
        {activeJudgmentId ? (
          <FeatureRow title={t('repair.plans.analysisSource')} detail={t('repair.plans.sourceReady')} tone="teal" />
        ) : (
          <>
            <FeatureRow title={t('repair.plans.analysisSource')} detail={t('repair.plans.sourceMissing')} tone="amber" />
            <LinkButton href="/case" label={t('repair.plans.goCase')} tone="teal" testID="repair.case-from-plans" variant="outline" />
          </>
        )}
        <View style={styles.actions}>
          <ActionButton
            disabled={!activeJudgmentId}
            label={t('repair.plans.load')}
            loading={getPlansMutation.isPending}
            onPress={() => getPlansMutation.mutate()}
            testID="repair.get-plans"
            tone="blue"
            variant="outline"
          />
          <ActionButton
            disabled={!activeJudgmentId}
            label={t('repair.plans.generate')}
            loading={generatePlansMutation.isPending}
            onPress={() => generatePlansMutation.mutate()}
            testID="repair.generate-plans"
            tone="teal"
          />
        </View>
        {(latestBundle?.plans ?? []).slice(0, 3).map((plan) => (
          <View key={plan.id} style={styles.statusCard}>
            <Text style={styles.statusTitle}>{labelPlanTitle(plan)}</Text>
            <FeatureRow
              title={t('repair.plans.status')}
              detail={plan.id === activePlanId ? t('repair.plans.current') : labelPlanRecommendation(plan.is_recommended || latestBundle?.recommended_plan_id === plan.id)}
              tone="teal"
            />
            <FeatureRow title={t('repair.plans.difficulty')} detail={labelDifficulty(plan.difficulty_level)} tone="blue" />
            {plan.first_step ? <FeatureRow title={t('repair.plans.firstStep')} detail={plan.first_step} tone="coral" /> : null}
            <View style={styles.actions}>
              <ActionButton
                label={plan.id === activePlanId ? t('repair.plans.selected') : t('repair.plans.select')}
                loading={selectPlanMutation.isPending}
                onPress={() => selectPlanMutation.mutate(plan.id)}
                testID={`repair.plan.${plan.id}.select`}
                tone="blue"
                variant="outline"
              />
              <ActionButton
                label={t('repair.plans.start')}
                loading={confirmExecutionMutation.isPending}
                onPress={() => confirmExecutionMutation.mutate(plan.id)}
                testID={`repair.plan.${plan.id}.start`}
                tone="teal"
              />
            </View>
          </View>
        ))}
      </Panel>

      <Panel title={t('repair.replanPanel')}>
        <FeatureRow
          title={t('repair.replan.status')}
          detail={getReplanStreamDetail(replanStreamState, replanRecovering, replanLifecycleStatus)}
          tone={replanRecovering ? 'amber' : replanStreamState.status === 'failed' ? 'coral' : 'blue'}
        />
        {activeReplanTrackId ? (
          <FeatureRow title={t('repair.replan.target')} detail={t('repair.replan.targetReady')} tone="amber" />
        ) : (
          <FeatureRow title={t('repair.replan.target')} detail={t('repair.replan.targetMissing')} tone="amber" />
        )}
        <View style={styles.actions}>
          {replanModes.map((option) => (
            <ActionButton
              key={option.value}
              label={t(option.labelKey)}
              onPress={() => setReplanMode(option.value)}
              testID={`repair.replan-mode.${option.value}`}
              tone={option.tone}
              variant={replanMode === option.value ? 'filled' : 'outline'}
            />
          ))}
        </View>
        <View style={styles.actions}>
          {replanReasons.map((option) => (
            <ActionButton
              key={option.value}
              label={t(option.labelKey)}
              onPress={() => setReplanReason(option.value)}
              testID={`repair.replan-reason.${option.value}`}
              tone={option.tone}
              variant={replanReason === option.value ? 'filled' : 'outline'}
            />
          ))}
        </View>
        <ActionButton
          disabled={!activeReplanTrackId}
          label={t('repair.replan.submit')}
          loading={replanMutation.isPending}
          onPress={() => replanMutation.mutate()}
          testID="repair.replan-submit"
          tone="amber"
        />
        {replanStreamState.phase ? (
          <FeatureRow title={t('repair.replan.phase')} detail={t(replanPhaseLabels[replanStreamState.phase] ?? 'repair.replanPhase.updating')} tone="blue" />
        ) : null}
        {replanStreamState.planId ? (
          <FeatureRow title={t('repair.replan.newPlan')} detail={t('repair.replan.newPlanReady')} tone="teal" />
        ) : null}
        {replanStreamState.text ? (
          <Text style={styles.streamText}>{replanStreamState.text}</Text>
        ) : null}
      </Panel>

      <Panel title={t('repair.executionPanel')}>
        <FeatureRow
          title={t('repair.execution.currentPlan')}
          detail={activePlanId ? t('repair.execution.planReady') : t('repair.execution.planMissing')}
          tone={activePlanId ? 'teal' : 'amber'}
        />
        <TextInput
          accessibilityLabel={t('repair.execution.notesLabel')}
          accessibilityHint={t('repair.execution.notesHint')}
          maxLength={MAX_CHECKIN_NOTES_LENGTH}
          multiline
          onChangeText={setCheckinNotes}
          placeholder={t('repair.execution.notesPlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.textArea}
          testID="repair.checkin-notes.input"
          textAlignVertical="top"
          value={checkinNotes}
        />
        <Text style={styles.fieldHelper} testID="repair.checkin-notes.helper">
          {checkinNotesHelperText(checkinNotes)}
        </Text>
        <View style={styles.actions}>
          <ActionButton
            disabled={!activePlanId}
            label={t('repair.execution.selectPlan')}
            loading={selectPlanMutation.isPending}
            onPress={() => selectPlanMutation.mutate(activePlanId)}
            testID="repair.select-plan"
            tone="blue"
            variant="outline"
          />
          <ActionButton
            disabled={!activePlanId}
            label={t('repair.execution.start')}
            loading={confirmExecutionMutation.isPending}
            onPress={() => confirmExecutionMutation.mutate(activePlanId)}
            testID="repair.confirm-execution"
            tone="teal"
            variant="outline"
          />
          <ActionButton
            disabled={!activePlanId}
            label={t('repair.execution.checkin')}
            loading={checkinMutation.isPending}
            onPress={() => checkinMutation.mutate()}
            testID="repair.checkin"
            tone="coral"
          />
        </View>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      <LinkButton href="/case" label={t('repair.backCase')} tone="teal" testID="repair.case" variant="outline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    gap: spacing.sm,
    borderRadius: 8,
    backgroundColor: palette.panel,
    padding: spacing.md,
  },
  statusTitle: {
    ...typography.bodyStrong,
    color: palette.ink,
  },
  input: {
    ...typography.body,
    color: palette.ink,
    minHeight: 44,
    padding: 0,
  },
  textArea: {
    ...typography.body,
    color: palette.ink,
    minHeight: 92,
    padding: 0,
  },
  fieldHelper: {
    ...typography.small,
    color: palette.muted,
  },
  actions: {
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.small,
    color: palette.muted,
  },
  errorText: {
    ...typography.small,
    color: palette.coral,
  },
  streamText: {
    ...typography.body,
    color: palette.ink,
  },
});
