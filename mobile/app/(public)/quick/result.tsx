import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { Case, CaseStatus } from '@emorapy/contracts/case';
import type { AIStreamEvent, AIStreamSnapshot } from '@emorapy/contracts/ai-stream';

import { connectQuickJudgmentStream, normalizeM1Error, m1Api } from '@/src/features/m1/api';
import { clearQuickSessionForRecoverableError } from '@/src/features/m1/session';
import { getCaseTypeLabel } from '@/src/features/m4/caseTypeLabels';
import { t, useLocale } from '@/src/i18n';
import {
  getLatestAIStreamSnapshot,
  type AIStreamCallbacks,
} from '@/src/platform/sse/aiStreamState';
import { useAIStreamSubscription } from '@/src/platform/sse/useAIStreamSubscription';
import {
  formatAIStreamDisplayError,
  type StreamErrorDisplayLike,
} from '@/src/platform/sse/streamErrorDisplay';
import { sessionStorage } from '@/src/platform/storage/secureStore';
import {
  ActionButton,
  FeatureRow,
  LinkButton,
  Panel,
  Screen,
  StatusPill,
} from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';
import {
  identityScopedQueryKey,
  useIdentityQueryScope,
} from '@/src/providers/identityQueryScope';

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

const quickJudgmentStatusLabelKeys: Record<QuickJudgmentStreamStatus, string> = {
  idle: 'quick.result.judgment.idle',
  ready: 'quick.result.judgment.ready',
  streaming: 'quick.result.judgment.streaming',
  persisted: 'quick.result.judgment.persisted',
  failed: 'quick.result.judgment.failed',
};

const quickCaseStatusLabelKeys: Record<CaseStatus, string> = {
  draft: 'quick.result.caseStatus.draft',
  submitted: 'quick.result.caseStatus.submitted',
  in_progress: 'quick.result.caseStatus.inProgress',
  completed: 'quick.result.caseStatus.completed',
  cancelled: 'quick.result.caseStatus.cancelled',
  judgment_failed: 'quick.result.caseStatus.judgmentFailed',
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
  return (
    status === 'completed'
    || status === 'persisted'
    || status === 'failed'
    || status === 'cancelled'
  );
}

function isTerminalStreamEvent(eventType?: AIStreamEvent['eventType']): boolean {
  return (
    eventType === 'stream.completed'
    || eventType === 'stream.persisted'
    || eventType === 'stream.failed'
    || eventType === 'stream.cancelled'
  );
}

export function formatQuickResultStreamError(error?: StreamErrorDisplayLike | null): string | null {
  return formatAIStreamDisplayError(error, 'quick.result.stream.error');
}

export function describeStreamStatus(input: AIStreamEvent | AIStreamSnapshot | null): string | null {
  if (!input) return null;
  if ('eventType' in input) {
    if (input.error) return formatQuickResultStreamError(input.error);
    if (input.fullText) return input.fullText;
    if (input.deltaText) return t('quick.result.stream.delta');
    if (input.phase) return t('quick.result.stream.phase');
    return t('quick.result.stream.updated');
  }
  if (input.error) return formatQuickResultStreamError(input.error);
  if (input.text) return input.text;
  if (input.phase) return t('quick.result.stream.phase');
  return t(quickJudgmentStatusLabelKeys[statusFromStreamStatus(input.status)]);
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
  if (
    event.eventType === 'stream.delta'
    || event.eventType === 'stream.started'
    || event.eventType === 'stream.phase'
  ) {
    return 'streaming';
  }
  return 'ready';
}

function summarizeCase(caseItem: Case | null): string {
  if (!caseItem) {
    return t('quick.result.summary.notFound');
  }

  if (caseItem.judgment?.summary) {
    return caseItem.judgment.summary;
  }

  if (caseItem.status === 'judgment_failed') {
    return caseItem.judgment_failure_reason || t('quick.result.summary.failed');
  }

  return t('quick.result.summary.pending');
}

function labelQuickCaseStatus(caseItem: Case | null, isFetching: boolean): string {
  if (isFetching) return t('quick.result.caseStatus.syncing');
  if (!caseItem) return t('quick.result.caseStatus.pendingSubmit');
  return t(quickCaseStatusLabelKeys[caseItem.status]);
}

export default function QuickResultScreen() {
  useLocale();
  const params = useLocalSearchParams();
  const caseId = readFirstParam(params.caseId as string | string[] | undefined);
  const [sessionWarningText, setSessionWarningText] = useState<string | null>(null);
  const identityScope = useIdentityQueryScope();
  const identityQueriesEnabled = identityScope.privateDataEnabled && !identityScope.transitioning;

  const resultQuery = useQuery({
    queryKey: identityScopedQueryKey(
      identityScope.epoch,
      'quick-result',
      caseId ?? 'session',
    ),
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
          setSessionWarningText(t('quick.result.sessionExpired'));
          return null;
        }
        throw error;
      }
    },
    enabled: identityQueriesEnabled,
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
    enabled: identityQueriesEnabled && shouldConnectStream,
    initialState: initialQuickJudgmentStreamState,
    connect: connectQuickJudgment,
    normalizeError: normalizeM1Error,
    reduceReady: (prev, ready) => {
      const latestSnapshot = getLatestAIStreamSnapshot(ready.snapshots);
      if (!latestSnapshot) {
        return { ...prev, status: 'ready', text: t('quick.result.stream.ready'), error: null };
      }
      return {
        status: statusFromStreamStatus(latestSnapshot.status),
        text: describeStreamStatus(latestSnapshot),
        error: formatQuickResultStreamError(latestSnapshot.error),
      };
    },
    reduceEvent: (_prev, event) => ({
      status: statusFromStreamEvent(event),
      text: describeStreamStatus(event),
      error: formatQuickResultStreamError(event.error),
    }),
    hasRecoverableState: (value) => (
      Boolean(value.text)
      && value.status !== 'persisted'
      && value.status !== 'failed'
    ),
    shouldClearRecoveringOnEvent: (event) => (
      event.eventType === 'stream.delta'
      || isTerminalStreamEvent(event.eventType)
    ),
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
      setStreamState((prev) => ({ ...prev, error: formatQuickResultStreamError(error) }));
    },
    onTerminalError: (error) => {
      setStreamState((prev) => ({ ...prev, status: 'failed', error: formatQuickResultStreamError(error) }));
    },
  });

  const streamRecoveryText = lastSeq > 0
    ? t('quick.result.stream.recoveringAfterSeq')
    : t('quick.result.stream.recovering');
  const streamLifecycleText = lifecycleStatus === 'active' || lifecycleStatus === 'unknown'
    ? streamRecoveryText
    : t('quick.result.stream.backgroundRecovery');
  const shouldShowRecoveryDetail = (
    isRecovering
    && lifecycleStatus !== 'active'
    && lifecycleStatus !== 'unknown'
  );
  const streamDetailText = streamState.error
    ?? (shouldShowRecoveryDetail
      ? [streamState.text, streamLifecycleText].filter(Boolean).join('；')
      : streamState.text ?? t('quick.result.stream.resumeFromLast'));
  const shouldShowStreamStatus = (
    shouldConnectStream
    || Boolean(streamState.text || streamState.error || shouldShowRecoveryDetail)
  );

  return (
    <Screen
      eyebrow={t('quick.result.eyebrow')}
      title={t('quick.result.title')}
      subtitle={t('quick.result.subtitle')}
      testID="quick.result.screen">
      <Panel title={t('quick.result.panel')}>
        <StatusPill
          label={labelQuickCaseStatus(caseItem, resultQuery.isFetching)}
          tone={caseItem ? 'blue' : 'amber'}
        />
        <Text style={styles.summary}>
          {errorMessage ?? sessionWarningText ?? summarizeCase(caseItem)}
        </Text>
        {caseItem ? (
          <View style={styles.caseMeta}>
            <Text style={styles.metaText}>{t('quick.result.meta.created')}</Text>
            <Text style={styles.metaText}>
              {t('quick.result.meta.type', {
                type: getCaseTypeLabel(caseItem.type) || t('quick.result.meta.unclassified'),
              })}
            </Text>
          </View>
        ) : null}
        <ActionButton
          label={t('quick.result.refresh')}
          loading={resultQuery.isFetching}
          onPress={() => resultQuery.refetch()}
          tone="blue"
          variant="outline"
        />
      </Panel>

      <Panel title={t('quick.result.nextPanel')}>
        {shouldPollQuickResult(caseItem) ? (
          <FeatureRow
            title={t('quick.result.autoRefresh.title')}
            detail={t('quick.result.autoRefresh.detail')}
            tone="amber"
          />
        ) : null}
        {shouldShowStreamStatus ? (
          <FeatureRow
            title={t('quick.result.stream.title')}
            detail={streamDetailText}
            tone={streamState.error ? 'coral' : shouldShowRecoveryDetail ? 'amber' : 'blue'}
          />
        ) : null}
        <FeatureRow
          title={t('quick.result.login.title')}
          detail={t('quick.result.login.detail')}
          tone="teal"
        />
        <FeatureRow
          title={t('quick.result.invite.title')}
          detail={t('quick.result.invite.detail')}
          tone="blue"
        />
        <FeatureRow
          title={t('quick.result.repair.title')}
          detail={t('quick.result.repair.detail')}
          tone="coral"
        />
      </Panel>

      <View style={styles.actions}>
        <LinkButton href="/auth" label={t('quick.auth')} tone="teal" />
        <LinkButton
          href="/quick"
          label={t('quick.result.restart')}
          tone="neutral"
          variant="outline"
        />
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
