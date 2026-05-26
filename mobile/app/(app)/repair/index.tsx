import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReconciliationPlan, ReconciliationPlanBundle, ReplanTrackInput } from '@cj/api-client';
import type { AIStreamEvent, AIStreamSnapshot } from '@cj/contracts/ai-stream';

import { connectRepairTrackStream, m4Api, normalizeM4Error } from '@/src/features/m4/api';
import type { AIStreamCallbacks, AIStreamReadyEvent } from '@/src/platform/sse/aiStreamState';
import { isTerminalAIStreamEvent } from '@/src/platform/sse/aiStreamState';
import { useAIStreamSubscription } from '@/src/platform/sse/useAIStreamSubscription';
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

const replanModes: Array<{ label: string; value: ReplanMode; tone: 'teal' | 'blue' | 'amber' }> = [
  { label: '先降壓', value: 'lower_pressure', tone: 'teal' },
  { label: '放慢節奏', value: 'slower_pace', tone: 'blue' },
  { label: '先自己做', value: 'solo_first', tone: 'amber' },
];

const replanReasons: Array<{ label: string; value: ReplanReason; tone: 'teal' | 'blue' | 'amber' | 'coral' }> = [
  { label: '需要幫助', value: 'needs_help', tone: 'teal' },
  { label: '變得更遠', value: 'farther', tone: 'blue' },
  { label: '壓力太高', value: 'high_stress', tone: 'coral' },
  { label: '主動調整', value: 'manual', tone: 'amber' },
];

const replanStreamStatusLabels: Record<ReplanStreamStatus, string> = {
  idle: '待命',
  ready: '已連線',
  streaming: '重新調整中',
  persisted: '已保存',
  failed: '失敗',
};

const replanPhaseLabels: Record<string, string> = {
  collecting_context: '正在讀取脈絡',
  drafting: '正在改寫方案',
  validating: '正在確認可執行性',
  persisted: '已保存',
};

const journeyStatusLabels: Record<string, string> = {
  solo_active: '個人執行中',
  co_active: '雙方執行中',
  paused: '已暫停',
  completed: '已完成',
  replanning: '正在重新調整',
  cancelled: '已停止',
};

const executionStatusLabels: Record<string, string> = {
  pending: '待開始',
  in_progress: '進行中',
  completed: '已完成',
  skipped: '已略過',
  failed: '未完成',
};

const difficultyLabels: Record<string, string> = {
  easy: '容易',
  medium: '中等',
  hard: '較難',
};

const planTypeLabels: Record<string, string> = {
  activity: '一起做一件小事',
  communication: '好好說一段話',
  gift: '用小禮物表達',
  intimacy: '重建親近感',
  service: '用行動分擔',
};

function labelLifecycleStatus(status: string): string {
  if (status === 'active' || status === 'unknown') return '';
  if (status === 'background') return 'App 在背景';
  if (status === 'inactive') return 'App 暫時中斷';
  return 'App 狀態更新中';
}

function labelJourneyStatus(status?: string | null): string {
  if (!status) return '狀態更新中';
  return journeyStatusLabels[status] ?? '狀態更新中';
}

function labelExecutionStatus(status?: string | null): string {
  if (!status) return '進度更新中';
  return executionStatusLabels[status] ?? '進度更新中';
}

function labelDifficulty(value?: string | null): string {
  if (!value) return '未標示';
  return difficultyLabels[value] ?? value;
}

function labelPlanTitle(plan: ReconciliationPlan): string {
  return plan.fit_reason || planTypeLabels[plan.plan_type] || '修復方案';
}

function labelDashboardPlanTitle(status: { plan_summary?: { title?: string | null } | null }): string {
  return status.plan_summary?.title || '修復旅程';
}

function labelPlanRecommendation(isRecommended?: boolean | null): string {
  return isRecommended ? '推薦方案' : '可選方案';
}

function getFirstParam(value?: string | string[]): string {
  return typeof value === 'string' ? value : value?.[0] ?? '';
}

function checkinNotesHelperText(value: string): string {
  const length = value.trim().length;
  if (!length) return '可選填；只按完成也能記錄今日一步。';
  return `${length}/${MAX_CHECKIN_NOTES_LENGTH}，會附在今日進度裡。`;
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
  const status = isRecovering ? '恢復連線中' : replanStreamStatusLabels[state.status];
  const phase = state.phase ? ` / ${replanPhaseLabels[state.phase] ?? '正在更新'}` : '';
  const lifecycle = labelLifecycleStatus(lifecycleStatus);
  return `${status}${phase}${lifecycle ? ` / ${lifecycle}` : ''}`;
}

export default function RepairScreen() {
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
        error: latest.error?.message ?? null,
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
        error: event.error?.message ?? null,
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
      setReplanStreamState((prev) => ({ ...prev, error: error.message }));
    },
    onTerminalError: (error) => {
      setReplanStreamState((prev) => ({ ...prev, status: 'failed', error: error.message }));
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
        eyebrow="修復"
        title="先登入"
        subtitle="修復旅程需要登入後才能讀取方案、承諾與進度回報。"
        testID="repair.auth-gate.screen">
        <Panel title="修復資料">
          <FeatureRow title="從判斷生成" detail="修復方案會依照已完成的判斷結果產生。" tone="teal" />
          <FeatureRow title="保持同步" detail="承諾、暫停、重新調整都會和帳號資料同步。" tone="blue" />
        </Panel>
        <LinkButton href="/auth" label="登入或註冊" tone="teal" testID="repair.auth-gate.login" />
      </Screen>
    );
  }

  return (
    <Screen eyebrow="修復" title="修復旅程" subtitle="把判斷結果變成雙方都能執行的小步計畫。" testID="repair.screen">
      <Panel title="旅程看板">
        <StatusPill label={`${dashboardQuery.data?.length ?? 0} 條旅程`} tone="coral" />
        {(dashboardQuery.data ?? []).slice(0, 4).map((status) => (
          <View key={status.plan_id} style={styles.statusCard}>
            <Text style={styles.statusTitle}>{labelDashboardPlanTitle(status)}</Text>
            <FeatureRow title="狀態" detail={`${labelJourneyStatus(status.journey_status)} / ${labelExecutionStatus(status.status)}`} tone="teal" />
            <FeatureRow title="進度" detail={`${Math.round((status.progress ?? 0) * 100)}%`} tone="blue" />
            {status.current_step ? (
              <FeatureRow title="今日一步" detail={status.current_step.content} tone="coral" />
            ) : null}
            {status.track_id ? (
              <ActionButton
                label="選這條重新調整"
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
          <Text style={styles.emptyText}>還沒有修復旅程。</Text>
        )}
      </Panel>

      <Panel title="方案">
        {activeJudgmentId ? (
          <FeatureRow title="判斷來源" detail="已從案件帶入，可以直接生成修復方案。" tone="teal" />
        ) : (
          <>
            <FeatureRow title="判斷來源" detail="請先從案件頁接受判斷，App 會自動帶你來建立修復方案。" tone="amber" />
            <LinkButton href="/case" label="前往案件" tone="teal" testID="repair.case-from-plans" variant="outline" />
          </>
        )}
        <View style={styles.actions}>
          <ActionButton
            disabled={!activeJudgmentId}
            label="讀取方案"
            loading={getPlansMutation.isPending}
            onPress={() => getPlansMutation.mutate()}
            testID="repair.get-plans"
            tone="blue"
            variant="outline"
          />
          <ActionButton
            disabled={!activeJudgmentId}
            label="生成方案"
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
              title="方案狀態"
              detail={plan.id === activePlanId ? '目前選擇' : labelPlanRecommendation(plan.is_recommended || latestBundle?.recommended_plan_id === plan.id)}
              tone="teal"
            />
            <FeatureRow title="難度" detail={labelDifficulty(plan.difficulty_level)} tone="blue" />
            {plan.first_step ? <FeatureRow title="第一步" detail={plan.first_step} tone="coral" /> : null}
            <View style={styles.actions}>
              <ActionButton
                label={plan.id === activePlanId ? '已選擇' : '選這個方案'}
                loading={selectPlanMutation.isPending}
                onPress={() => selectPlanMutation.mutate(plan.id)}
                testID={`repair.plan.${plan.id}.select`}
                tone="blue"
                variant="outline"
              />
              <ActionButton
                label="開始這個方案"
                loading={confirmExecutionMutation.isPending}
                onPress={() => confirmExecutionMutation.mutate(plan.id)}
                testID={`repair.plan.${plan.id}.start`}
                tone="teal"
              />
            </View>
          </View>
        ))}
      </Panel>

      <Panel title="重新調整">
        <FeatureRow
          title="重新調整狀態"
          detail={getReplanStreamDetail(replanStreamState, replanRecovering, replanLifecycleStatus)}
          tone={replanRecovering ? 'amber' : replanStreamState.status === 'failed' ? 'coral' : 'blue'}
        />
        {activeReplanTrackId ? (
          <FeatureRow title="調整對象" detail="已選擇一條修復旅程。" tone="amber" />
        ) : (
          <FeatureRow title="調整對象" detail="請先在旅程看板選一條旅程。" tone="amber" />
        )}
        <View style={styles.actions}>
          {replanModes.map((option) => (
            <ActionButton
              key={option.value}
              label={option.label}
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
              label={option.label}
              onPress={() => setReplanReason(option.value)}
              testID={`repair.replan-reason.${option.value}`}
              tone={option.tone}
              variant={replanReason === option.value ? 'filled' : 'outline'}
            />
          ))}
        </View>
        <ActionButton
          disabled={!activeReplanTrackId}
          label="重新調整這一輪"
          loading={replanMutation.isPending}
          onPress={() => replanMutation.mutate()}
          testID="repair.replan-submit"
          tone="amber"
        />
        {replanStreamState.phase ? (
          <FeatureRow title="階段" detail={replanPhaseLabels[replanStreamState.phase] ?? '正在更新'} tone="blue" />
        ) : null}
        {replanStreamState.planId ? (
          <FeatureRow title="新方案" detail="已準備好，可在下方開始執行。" tone="teal" />
        ) : null}
        {replanStreamState.text ? (
          <Text style={styles.streamText}>{replanStreamState.text}</Text>
        ) : null}
      </Panel>

      <Panel title="執行">
        <FeatureRow
          title="當前方案"
          detail={activePlanId ? '已選擇修復方案。' : '請先在上方選擇一個方案。'}
          tone={activePlanId ? 'teal' : 'amber'}
        />
        <TextInput
          accessibilityLabel="修復進度備註"
          accessibilityHint="輸入今天做了什麼，或目前卡住的地方"
          maxLength={MAX_CHECKIN_NOTES_LENGTH}
          multiline
          onChangeText={setCheckinNotes}
          placeholder="今天做了什麼，或哪裡卡住。"
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
            label="選擇方案"
            loading={selectPlanMutation.isPending}
            onPress={() => selectPlanMutation.mutate(activePlanId)}
            testID="repair.select-plan"
            tone="blue"
            variant="outline"
          />
          <ActionButton
            disabled={!activePlanId}
            label="開始執行"
            loading={confirmExecutionMutation.isPending}
            onPress={() => confirmExecutionMutation.mutate(activePlanId)}
            testID="repair.confirm-execution"
            tone="teal"
            variant="outline"
          />
          <ActionButton
            disabled={!activePlanId}
            label="完成今日一步"
            loading={checkinMutation.isPending}
            onPress={() => checkinMutation.mutate()}
            testID="repair.checkin"
            tone="coral"
          />
        </View>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      <LinkButton href="/case" label="回到案件" tone="teal" testID="repair.case" variant="outline" />
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
