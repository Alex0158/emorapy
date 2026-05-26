import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { Case, CaseStatus } from '@cj/contracts/case';
import type { AIStreamEvent, AIStreamSnapshot } from '@cj/contracts/ai-stream';

import { connectQuickJudgmentStream, normalizeM1Error, m1Api } from '@/src/features/m1/api';
import { clearQuickSessionForRecoverableError } from '@/src/features/m1/session';
import {
  getLatestAIStreamSnapshot,
  type AIStreamCallbacks,
} from '@/src/platform/sse/aiStreamState';
import { useAIStreamSubscription } from '@/src/platform/sse/useAIStreamSubscription';
import { sessionStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

const QUICK_RESULT_REFETCH_MS = 3500;

type QuickJudgmentStreamStatus = 'idle' | 'ready' | 'streaming' | 'persisted' | 'failed';

interface QuickJudgmentStreamState {
  status: QuickJudgmentStreamStatus;
  text: string | null;
  error: string | null;
}

const initialQuickJudgmentStreamState: QuickJudgmentStreamState = {
  status: 'idle',
  text: null,
  error: null,
};

const quickJudgmentStatusLabels: Record<QuickJudgmentStreamStatus, string> = {
  idle: '等待判斷',
  ready: '已連線',
  streaming: '判斷中',
  persisted: '已保存',
  failed: '判斷失敗',
};

const quickCaseStatusLabels: Record<CaseStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  in_progress: '判斷中',
  completed: '已完成',
  cancelled: '已取消',
  judgment_failed: '判斷未完成',
};

function readFirstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function shouldPollQuickResult(caseItem: Case | null): boolean {
  if (!caseItem || caseItem.judgment?.summary || caseItem.status === 'judgment_failed') {
    return false;
  }
  return caseItem.status === 'submitted' || caseItem.status === 'in_progress';
}

function isTerminalStreamStatus(status?: AIStreamSnapshot['status']): boolean {
  return status === 'completed' || status === 'persisted' || status === 'failed' || status === 'cancelled';
}

function isTerminalStreamEvent(eventType?: AIStreamEvent['eventType']): boolean {
  return (
    eventType === 'stream.completed'
    || eventType === 'stream.persisted'
    || eventType === 'stream.failed'
    || eventType === 'stream.cancelled'
  );
}

function describeStreamStatus(input: AIStreamEvent | AIStreamSnapshot | null): string | null {
  if (!input) return null;
  if ('eventType' in input) {
    if (input.error?.message) return input.error.message;
    if (input.fullText) return input.fullText;
    if (input.deltaText) return 'AI 判斷正在更新。';
    if (input.phase) return 'AI 判斷進度已更新。';
    return 'AI 判斷狀態已更新。';
  }
  if (input.error?.message) return input.error.message;
  if (input.text) return input.text;
  if (input.phase) return 'AI 判斷進度已更新。';
  return quickJudgmentStatusLabels[statusFromStreamStatus(input.status)];
}

function statusFromStreamStatus(status?: AIStreamSnapshot['status']): QuickJudgmentStreamStatus {
  if (status === 'failed' || status === 'cancelled') return 'failed';
  if (status === 'completed' || status === 'persisted') return 'persisted';
  if (status === 'created' || status === 'queued' || status === 'started' || status === 'streaming') {
    return 'streaming';
  }
  return 'ready';
}

function statusFromStreamEvent(event: AIStreamEvent): QuickJudgmentStreamStatus {
  if (event.eventType === 'stream.failed' || event.eventType === 'stream.cancelled') return 'failed';
  if (event.eventType === 'stream.completed' || event.eventType === 'stream.persisted') return 'persisted';
  if (event.eventType === 'stream.delta' || event.eventType === 'stream.started' || event.eventType === 'stream.phase') {
    return 'streaming';
  }
  return 'ready';
}

function summarizeCase(caseItem: Case | null): string {
  if (!caseItem) {
    return '還沒有找到快速整理結果。可以回到 quick 重新提交，或稍後再試。';
  }

  if (caseItem.judgment?.summary) {
    return caseItem.judgment.summary;
  }

  if (caseItem.status === 'judgment_failed') {
    return caseItem.judgment_failure_reason || '判斷暫時失敗，請稍後重試或重新整理內容。';
  }

  return '已收到快速整理，AI 判斷可能仍在生成中。稍後刷新可以看到更新結果。';
}

function labelQuickCaseStatus(caseItem: Case | null, isFetching: boolean): string {
  if (isFetching) return '同步中';
  if (!caseItem) return '待提交';
  return quickCaseStatusLabels[caseItem.status];
}

export default function QuickResultScreen() {
  const params = useLocalSearchParams();
  const caseId = readFirstParam(params.caseId as string | string[] | undefined);
  const [sessionWarningText, setSessionWarningText] = useState<string | null>(null);

  const resultQuery = useQuery({
    queryKey: ['quick-result', caseId ?? 'session'],
    queryFn: async () => {
      try {
        const sessionId = await sessionStorage.getSessionId();
        if (caseId) {
          const result = await m1Api.quick.getCase(caseId, sessionId);
          setSessionWarningText(null);
          return result;
        }
        if (!sessionId) return null;
        const result = await m1Api.quick.getCaseBySessionId(sessionId);
        setSessionWarningText(null);
        return result;
      } catch (error) {
        const sessionError = await clearQuickSessionForRecoverableError(error, '/quick/result');
        if (sessionError) {
          setSessionWarningText('匿名進度已過期或無法讀取。請重新提交快速整理，或登入後查看已保存內容。');
          return null;
        }
        throw error;
      }
    },
    refetchInterval: (query) => (
      shouldPollQuickResult((query.state.data ?? null) as Case | null)
        ? QUICK_RESULT_REFETCH_MS
        : false
    ),
  });

  const caseItem = resultQuery.data ?? null;
  const errorMessage = resultQuery.error ? normalizeM1Error(resultQuery.error).message : null;
  const streamCaseId = caseItem?.id ?? caseId;
  const shouldConnectStream = Boolean(streamCaseId) && shouldPollQuickResult(caseItem);

  const connectQuickJudgment = useCallback((
    callbacks: AIStreamCallbacks,
    options: { afterSeq?: number; signal?: AbortSignal }
  ) => {
    if (!streamCaseId) return Promise.resolve();
    return connectQuickJudgmentStream(streamCaseId, callbacks, options);
  }, [streamCaseId]);

  const {
    state: streamState,
    setState: setStreamState,
    isRecovering,
    lifecycleStatus,
    lastSeq,
  } = useAIStreamSubscription<QuickJudgmentStreamState>({
    scopeKey: streamCaseId ? `case_judgment:${streamCaseId}` : null,
    enabled: shouldConnectStream,
    initialState: initialQuickJudgmentStreamState,
    connect: connectQuickJudgment,
    normalizeError: normalizeM1Error,
    reduceReady: (prev, ready) => {
      const latestSnapshot = getLatestAIStreamSnapshot(ready.snapshots);
      if (!latestSnapshot) {
        return { ...prev, status: 'ready', text: '已接上判斷同步。', error: null };
      }
      return {
        status: statusFromStreamStatus(latestSnapshot.status),
        text: describeStreamStatus(latestSnapshot),
        error: latestSnapshot.error?.message ?? null,
      };
    },
    reduceEvent: (_prev, event) => ({
      status: statusFromStreamEvent(event),
      text: describeStreamStatus(event),
      error: event.error?.message ?? null,
    }),
    hasRecoverableState: (value) => Boolean(value.text) && value.status !== 'persisted' && value.status !== 'failed',
    shouldClearRecoveringOnEvent: (event) => event.eventType === 'stream.delta' || isTerminalStreamEvent(event.eventType),
    onReady: (ready) => {
      const latestSnapshot = getLatestAIStreamSnapshot(ready.snapshots);
      if (latestSnapshot && isTerminalStreamStatus(latestSnapshot.status)) {
        void resultQuery.refetch();
      }
    },
    onEvent: (event) => {
      if (isTerminalStreamEvent(event.eventType)) {
        void resultQuery.refetch();
      }
    },
    onConnectionError: (error) => {
      setStreamState((prev) => ({ ...prev, error: error.message }));
    },
    onTerminalError: (error) => {
      setStreamState((prev) => ({ ...prev, status: 'failed', error: error.message }));
    },
  });

  const streamRecoveryText = lastSeq > 0
    ? '恢復判斷同步中，會從最近收到的進度繼續。'
    : '恢復判斷同步中，會從最近進度繼續。';
  const streamLifecycleText = lifecycleStatus === 'active' || lifecycleStatus === 'unknown'
    ? streamRecoveryText
    : 'App 回到前景後會恢復判斷同步，並從最近收到的進度繼續。';
  const shouldShowRecoveryDetail = isRecovering && lifecycleStatus !== 'active' && lifecycleStatus !== 'unknown';
  const streamDetailText = streamState.error
    ?? (shouldShowRecoveryDetail
      ? [streamState.text, streamLifecycleText].filter(Boolean).join('；')
      : streamState.text ?? '會從最後收到的判斷進度恢復。');
  const shouldShowStreamStatus = shouldConnectStream || Boolean(streamState.text || streamState.error || shouldShowRecoveryDetail);

  return (
    <Screen
      eyebrow="整理結果"
      title="結果承接"
      subtitle="這裡會同步爭點、責任比例與下一步行動。"
      testID="quick.result.screen">
      <Panel title="整理結果">
        <StatusPill
          label={labelQuickCaseStatus(caseItem, resultQuery.isFetching)}
          tone={caseItem ? 'blue' : 'amber'}
        />
        <Text style={styles.summary}>
          {errorMessage ?? sessionWarningText ?? summarizeCase(caseItem)}
        </Text>
        {caseItem ? (
          <View style={styles.caseMeta}>
            <Text style={styles.metaText}>整理狀態：已建立</Text>
            <Text style={styles.metaText}>類型：{caseItem.type || '待分類'}</Text>
          </View>
        ) : null}
        <ActionButton
          label="刷新結果"
          loading={resultQuery.isFetching}
          onPress={() => resultQuery.refetch()}
          tone="blue"
          variant="outline"
        />
      </Panel>

      <Panel title="下一步">
        {shouldPollQuickResult(caseItem) ? (
          <FeatureRow title="自動刷新" detail="AI 判斷生成中時會定期同步；完成或失敗後停止。" tone="amber" />
        ) : null}
        {shouldShowStreamStatus ? (
          <FeatureRow
            title="判斷同步"
            detail={streamDetailText}
            tone={streamState.error ? 'coral' : shouldShowRecoveryDetail ? 'amber' : 'blue'}
          />
        ) : null}
        <FeatureRow title="登入保存" detail="登入後會保存到個人案件。" tone="teal" />
        <FeatureRow title="邀請對方" detail="雙方補充材料後再判斷。" tone="blue" />
        <FeatureRow title="進入修復" detail="有判斷後承接修復旅程。" tone="coral" />
      </Panel>

      <View style={styles.actions}>
        <LinkButton href="/auth" label="登入保存進度" tone="teal" />
        <LinkButton href="/quick" label="重新整理" tone="neutral" variant="outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    ...typography.body,
    color: palette.ink,
  },
  caseMeta: {
    gap: spacing.xs,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  metaText: {
    ...typography.small,
    color: palette.muted,
  },
  actions: {
    gap: spacing.sm,
  },
});
