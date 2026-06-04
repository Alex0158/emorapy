import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AIStreamEvent } from '@cj/contracts/ai-stream';

import { connectInterviewStream, m2Api, normalizeM2Error } from '@/src/features/m2/api';
import { labelPsychDomains } from '@/src/features/m2/labels';
import { t, useLocale } from '@/src/i18n';
import {
  getLatestAIStreamSnapshot,
  type AIStreamCallbacks,
  isTerminalAIStreamEvent,
} from '@/src/platform/sse/aiStreamState';
import { useAIStreamSubscription } from '@/src/platform/sse/useAIStreamSubscription';
import { formatAIStreamDisplayError } from '@/src/platform/sse/streamErrorDisplay';
import { tokenStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

type StreamStatus = 'idle' | 'ready' | 'streaming' | 'persisted' | 'failed';

interface InterviewStreamState {
  status: StreamStatus;
  text: string;
  error: string | null;
}

const initialInterviewStreamState: InterviewStreamState = {
  status: 'idle',
  text: '',
  error: null,
};

const streamStatusLabelKeys: Record<StreamStatus, string> = {
  idle: 'profileInterview.stream.idle',
  ready: 'profileInterview.stream.ready',
  streaming: 'profileInterview.stream.streaming',
  persisted: 'profileInterview.stream.persisted',
  failed: 'profileInterview.stream.failed',
};

const sessionStatusLabelKeys: Record<string, string> = {
  active: 'profileInterview.session.active',
  processing: 'profileInterview.session.processing',
  completed: 'profileInterview.session.completed',
  abandoned: 'profileInterview.session.abandoned',
  processing_failed: 'profileInterview.session.processingFailed',
};

function labelSessionStatus(status?: string | null): string {
  if (!status) return t('profileInterview.session.loading');
  return t(sessionStatusLabelKeys[status] ?? 'profileInterview.session.updated');
}

function labelLifecycleStatus(status: string): string {
  if (status === 'active' || status === 'unknown') return t('profileInterview.lifecycle.active');
  if (status === 'background') return t('profileInterview.lifecycle.background');
  if (status === 'inactive') return t('profileInterview.lifecycle.inactive');
  return t('profileInterview.lifecycle.updated');
}

function labelInterviewSyncProgress(status: StreamStatus, isRecovering: boolean): string {
  if (isRecovering) return t('profileInterview.sync.recovering');
  if (status === 'persisted') return t('profileInterview.sync.persisted');
  if (status === 'failed') return t('profileInterview.sync.failed');
  if (status === 'streaming') return t('profileInterview.sync.streaming');
  if (status === 'ready') return t('profileInterview.sync.ready');
  return t('profileInterview.sync.idle');
}

function statusFromStreamEvent(event: AIStreamEvent): StreamStatus {
  if (event.eventType === 'stream.failed' || event.eventType === 'stream.cancelled') return 'failed';
  if (event.eventType === 'stream.persisted' || event.eventType === 'stream.completed') return 'persisted';
  if (event.eventType === 'stream.delta' || event.eventType === 'stream.started' || event.eventType === 'stream.phase') {
    return 'streaming';
  }
  return 'ready';
}

function statusFromSnapshot(status: string): StreamStatus {
  if (status === 'failed' || status === 'cancelled') return 'failed';
  if (status === 'persisted' || status === 'completed') return 'persisted';
  if (status === 'started' || status === 'streaming' || status === 'created' || status === 'queued') return 'streaming';
  return 'ready';
}

export default function InterviewScreen() {
  const locale = useLocale();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : null;
  const [message, setMessage] = useState('');
  const authQuery = useQuery({
    queryKey: ['app', 'auth-token'],
    queryFn: () => tokenStorage.getToken(),
  });
  const isAuthenticated = Boolean(authQuery.data);

  const sessionQuery = useQuery({
    queryKey: ['m2', 'interview-session', sessionId],
    queryFn: () => m2Api.interview.getSession(sessionId as string),
    enabled: Boolean(sessionId && isAuthenticated),
  });

  const connectInterview = useCallback((callbacks: AIStreamCallbacks, options: { afterSeq?: number; signal?: AbortSignal }) => {
    if (!sessionId) return Promise.resolve();
    return connectInterviewStream(sessionId, callbacks, options);
  }, [sessionId]);

  const {
    state: streamState,
    setState: setStreamState,
    isRecovering,
    lifecycleStatus,
  } = useAIStreamSubscription<InterviewStreamState>({
    scopeKey: sessionId ? `interview_session:${sessionId}` : null,
    enabled: Boolean(sessionId && isAuthenticated),
    initialState: initialInterviewStreamState,
    connect: connectInterview,
    normalizeError: normalizeM2Error,
    reduceReady: (prev, ready) => {
      const latest = getLatestAIStreamSnapshot(ready.snapshots);
      if (!latest) return { ...prev, status: 'ready', error: null };
      return {
        status: statusFromSnapshot(latest.status),
        text: latest.text ?? '',
        error: formatAIStreamDisplayError(latest.error),
      };
    },
    reduceEvent: (prev, event) => {
      const nextText = event.fullText
        ?? (event.eventType === 'stream.delta' ? `${prev.text}${event.deltaText ?? ''}` : prev.text);
      return {
        status: statusFromStreamEvent(event),
        text: nextText,
        error: formatAIStreamDisplayError(event.error),
      };
    },
    hasRecoverableState: (value) => Boolean(value.text) && value.status !== 'persisted' && value.status !== 'failed',
    shouldClearRecoveringOnEvent: (event) => event.eventType === 'stream.delta' || isTerminalAIStreamEvent(event),
    onEvent: (event) => {
      if (event.eventType === 'stream.persisted' || event.eventType === 'stream.completed') {
        void sessionQuery.refetch();
      }
    },
    onConnectionError: (error) => {
      setStreamState((prev) => ({ ...prev, error: formatAIStreamDisplayError(error) }));
    },
    onTerminalError: (error) => {
      setStreamState((prev) => ({ ...prev, status: 'failed', error: formatAIStreamDisplayError(error) }));
    },
  });

  const respondMutation = useMutation({
    mutationFn: () => m2Api.interview.respond(sessionId as string, message.trim()),
    onSuccess: () => {
      setMessage('');
      setStreamState({ status: 'streaming', text: '', error: null });
      void sessionQuery.refetch();
    },
  });
  const skipMutation = useMutation({
    mutationFn: () => m2Api.interview.skip(sessionId as string),
    onSuccess: () => {
      setStreamState({ status: 'streaming', text: '', error: null });
      void sessionQuery.refetch();
    },
  });
  const endMutation = useMutation({
    mutationFn: () => m2Api.interview.endSession(sessionId as string),
    onSuccess: () => {
      setStreamState((prev) => ({ ...prev, status: 'persisted' }));
      void sessionQuery.refetch();
    },
  });
  const cancelMutation = useMutation({
    mutationFn: () => m2Api.interview.cancel(sessionId as string),
    onSuccess: () => setStreamState(initialInterviewStreamState),
  });
  const retryMutation = useMutation({
    mutationFn: () => m2Api.interview.retryFailed(sessionId as string),
    onSuccess: () => {
      setStreamState({ status: 'streaming', text: '', error: null });
      void sessionQuery.refetch();
    },
  });

  const sessionStatus = sessionQuery.data?.status ?? null;
  const isFailedSession = sessionStatus === 'processing_failed';
  const isProcessingSession = sessionStatus === 'processing';
  const isCompletedSession = sessionStatus === 'completed';
  const isReadOnlySession = isFailedSession || isProcessingSession || isCompletedSession || sessionStatus === 'abandoned';
  const latestAiMessage = useMemo(() => {
    const turns = sessionQuery.data?.turns ?? [];
    return turns.at(-1)?.ai_message ?? t('profileInterview.defaultPrompt');
  }, [locale, sessionQuery.data?.turns]);
  const errorMessage = streamState.error
    ?? (sessionQuery.error ? normalizeM2Error(sessionQuery.error).message : null)
    ?? (respondMutation.error ? normalizeM2Error(respondMutation.error).message : null)
    ?? (skipMutation.error ? normalizeM2Error(skipMutation.error).message : null)
    ?? (endMutation.error ? normalizeM2Error(endMutation.error).message : null)
    ?? (cancelMutation.error ? normalizeM2Error(cancelMutation.error).message : null)
    ?? (retryMutation.error ? normalizeM2Error(retryMutation.error).message : null);

  if (!isAuthenticated) {
    return (
      <Screen
        eyebrow={t('profileInterview.eyebrow')}
        title={t('profileInterview.authGate.title')}
        subtitle={t('profileInterview.authGate.subtitle')}
        testID="profile.interview.auth-gate.screen">
        <Panel title={t('profileInterview.authGate.panel')}>
          <FeatureRow
            title={t('profileInterview.authGate.noAnonymous.title')}
            detail={t('profileInterview.authGate.noAnonymous.detail')}
            tone="teal"
          />
          <FeatureRow
            title={t('profileInterview.authGate.resume.title')}
            detail={t('profileInterview.authGate.resume.detail')}
            tone="blue"
          />
        </Panel>
        <LinkButton href="/auth" label={t('profile.authGate.login')} tone="teal" testID="profile.interview.auth-gate.login" />
      </Screen>
    );
  }

  if (!sessionId) {
    return (
      <Screen
        eyebrow={t('profileInterview.eyebrow')}
        title={t('profileInterview.missing.title')}
        subtitle={t('profileInterview.missing.subtitle')}
        testID="profile.interview.missing-session.screen">
        <LinkButton href="/profile" label={t('profileInterview.missing.back')} tone="teal" testID="profile.interview.back" />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow={t('profileInterview.eyebrow')}
      title={t('profileInterview.title')}
      subtitle={t('profileInterview.subtitle')}
      testID="profile.interview.screen">
      <Panel title={t('profileInterview.questionPanel')}>
        <StatusPill
          label={isRecovering
            ? t('profileInterview.recoveringLabel')
            : streamState.status === 'idle'
              ? labelSessionStatus(sessionQuery.data?.status)
              : t(streamStatusLabelKeys[streamState.status])}
          tone={isRecovering ? 'amber' : 'blue'}
        />
        <Text style={styles.aiText}>{streamState.text || latestAiMessage}</Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      {isReadOnlySession ? (
        <Panel
          title={isFailedSession
            ? t('profileInterview.readonly.failedTitle')
            : isProcessingSession
              ? t('profileInterview.readonly.processingTitle')
              : t('profileInterview.readonly.completedTitle')}>
          <Text style={styles.helperText}>
            {isFailedSession
              ? t('profileInterview.readonly.failedDetail')
              : isProcessingSession
                ? t('profileInterview.readonly.processingDetail')
                : t('profileInterview.readonly.completedDetail')}
          </Text>
          {sessionQuery.data?.partial_success ? (
            <Text style={styles.helperText}>{t('profileInterview.readonly.partialSuccess')}</Text>
          ) : null}
          {isFailedSession ? (
            <ActionButton
              label={t('profileInterview.retry')}
              loading={retryMutation.isPending}
              onPress={() => retryMutation.mutate()}
              testID="profile.interview.retry"
              tone="amber"
              variant="outline"
            />
          ) : null}
          <LinkButton href="/profile/story" label={t('profileInterview.story')} tone="blue" testID="profile.interview.story.readonly" />
        </Panel>
      ) : (
        <Panel title={t('profileInterview.responsePanel')}>
          <TextInput
            accessibilityLabel={t('profileInterview.response.label')}
            accessibilityHint={t('profileInterview.response.hint')}
            multiline
            onChangeText={setMessage}
            placeholder={t('profileInterview.response.placeholder')}
            placeholderTextColor={palette.muted}
            style={styles.textArea}
            testID="profile.interview.message.input"
            textAlignVertical="top"
            value={message}
          />
          <ActionButton
            disabled={message.trim().length < 2 || respondMutation.isPending}
            label={t('profileInterview.send')}
            loading={respondMutation.isPending}
            onPress={() => respondMutation.mutate()}
            testID="profile.interview.respond"
            tone="teal"
          />
        </Panel>
      )}

      <View style={styles.actions}>
        {!isReadOnlySession ? (
          <>
            <ActionButton
              label={t('profileInterview.skip')}
              loading={skipMutation.isPending}
              onPress={() => skipMutation.mutate()}
              testID="profile.interview.skip"
              tone="amber"
              variant="outline"
            />
            <ActionButton
              label={t('profileInterview.cancel')}
              loading={cancelMutation.isPending}
              onPress={() => cancelMutation.mutate()}
              testID="profile.interview.cancel"
              tone="coral"
              variant="outline"
            />
            <ActionButton
              label={t('profileInterview.end')}
              loading={endMutation.isPending}
              onPress={() => endMutation.mutate()}
              testID="profile.interview.end"
              tone="teal"
              variant="outline"
            />
          </>
        ) : null}
        <LinkButton href="/profile/story" label={t('profileInterview.story')} tone="blue" testID="profile.interview.story" />
      </View>

      <Panel title={t('profileInterview.statusPanel')}>
        <FeatureRow title={t('profileInterview.rounds')} detail={`${sessionQuery.data?.turns?.length ?? 0}`} tone="teal" />
        <FeatureRow title={t('profileInterview.touchedDomains')} detail={labelPsychDomains(sessionQuery.data?.domains_touched)} tone="blue" />
        <FeatureRow title={t('profileInterview.syncStatus')} detail={labelInterviewSyncProgress(streamState.status, isRecovering)} tone="coral" />
        <FeatureRow
          title={t('profileInterview.lifecycleStatus')}
          detail={`${labelLifecycleStatus(lifecycleStatus)}${isRecovering ? t('profileInterview.recoveringSuffix') : ''}`}
          tone={isRecovering ? 'amber' : 'neutral'}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  aiText: {
    ...typography.body,
    color: palette.ink,
  },
  errorText: {
    ...typography.small,
    color: palette.coral,
  },
  helperText: {
    ...typography.small,
    color: palette.muted,
  },
  textArea: {
    ...typography.body,
    color: palette.ink,
    minHeight: 120,
    padding: 0,
  },
  actions: {
    gap: spacing.sm,
  },
});
