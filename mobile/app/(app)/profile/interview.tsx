import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AIStreamEvent } from '@cj/contracts/ai-stream';

import { connectInterviewStream, m2Api, normalizeM2Error } from '@/src/features/m2/api';
import { labelPsychDomains } from '@/src/features/m2/labels';
import {
  getLatestAIStreamSnapshot,
  type AIStreamCallbacks,
  isTerminalAIStreamEvent,
} from '@/src/platform/sse/aiStreamState';
import { useAIStreamSubscription } from '@/src/platform/sse/useAIStreamSubscription';
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

const streamStatusLabels: Record<StreamStatus, string> = {
  idle: '等待生成',
  ready: '已連線',
  streaming: '生成中',
  persisted: '已保存',
  failed: '整理失敗',
};

const sessionStatusLabels: Record<string, string> = {
  active: '訪談中',
  processing: '正在整理',
  completed: '已完成',
  abandoned: '已停止',
  processing_failed: '整理失敗',
};

function labelSessionStatus(status?: string | null): string {
  if (!status) return '連線中';
  return sessionStatusLabels[status] ?? '狀態更新中';
}

function labelLifecycleStatus(status: string): string {
  if (status === 'active' || status === 'unknown') return 'App 使用中';
  if (status === 'background') return 'App 在背景';
  if (status === 'inactive') return 'App 暫時中斷';
  return 'App 狀態更新中';
}

function labelInterviewSyncProgress(status: StreamStatus, isRecovering: boolean): string {
  if (isRecovering) return '正在恢復訪談整理，會從最近收到的內容繼續。';
  if (status === 'persisted') return '訪談整理已保存。';
  if (status === 'failed') return '訪談整理需要重試。';
  if (status === 'streaming') return '正在同步訪談整理。';
  if (status === 'ready') return '已準備同步訪談內容。';
  return '等待新的訪談內容。';
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
        error: latest.error?.message ?? null,
      };
    },
    reduceEvent: (prev, event) => {
      const nextText = event.fullText
        ?? (event.eventType === 'stream.delta' ? `${prev.text}${event.deltaText ?? ''}` : prev.text);
      return {
        status: statusFromStreamEvent(event),
        text: nextText,
        error: event.error?.message ?? null,
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
      setStreamState((prev) => ({ ...prev, error: error.message }));
    },
    onTerminalError: (error) => {
      setStreamState((prev) => ({ ...prev, status: 'failed', error: error.message }));
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
    return turns.at(-1)?.ai_message ?? '開始說一點你現在最想被理解的事。';
  }, [sessionQuery.data?.turns]);
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
        eyebrow="心理訪談"
        title="先登入"
        subtitle="訪談需要登入後才會讀取並同步。"
        testID="profile.interview.auth-gate.screen">
        <Panel title="保護你的脈絡">
          <FeatureRow title="不匿名同步" detail="心理訪談只跟登入帳號綁定。" tone="teal" />
          <FeatureRow title="可回到個人脈絡" detail="登入後可恢復未完成訪談。" tone="blue" />
        </Panel>
        <LinkButton href="/auth" label="登入或註冊" tone="teal" testID="profile.interview.auth-gate.login" />
      </Screen>
    );
  }

  if (!sessionId) {
    return (
      <Screen eyebrow="心理訪談" title="訪談" subtitle="缺少訪談上下文。" testID="profile.interview.missing-session.screen">
        <LinkButton href="/profile" label="回到個人脈絡" tone="teal" testID="profile.interview.back" />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="心理訪談"
      title="慢慢說"
      subtitle="離開 App 後回來，會從最近同步的內容繼續。"
      testID="profile.interview.screen">
      <Panel title="目前問題">
        <StatusPill
          label={isRecovering ? '正在恢復' : streamState.status === 'idle' ? labelSessionStatus(sessionQuery.data?.status) : streamStatusLabels[streamState.status]}
          tone={isRecovering ? 'amber' : 'blue'}
        />
        <Text style={styles.aiText}>{streamState.text || latestAiMessage}</Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      {isReadOnlySession ? (
        <Panel title={isFailedSession ? '整理失敗' : isProcessingSession ? '正在整理' : '訪談已結束'}>
          <Text style={styles.helperText}>
            {isFailedSession
              ? '這次訪談的整理流程沒有完成，可以直接重試整理，不需要重新作答。'
              : isProcessingSession
                ? '你的回覆已送出，系統正在整理我的故事與回饋。'
                : '這次訪談已結束，可以回到我的故事查看整理後的內容。'}
          </Text>
          {sessionQuery.data?.partial_success ? (
            <Text style={styles.helperText}>核心脈絡已整理完成，但回饋卡仍在補齊；稍後可回到我的故事查看。</Text>
          ) : null}
          {isFailedSession ? (
            <ActionButton
              label="重試整理"
              loading={retryMutation.isPending}
              onPress={() => retryMutation.mutate()}
              testID="profile.interview.retry"
              tone="amber"
              variant="outline"
            />
          ) : null}
          <LinkButton href="/profile/story" label="查看我的故事" tone="blue" testID="profile.interview.story.readonly" />
        </Panel>
      ) : (
        <Panel title="你的回覆">
          <TextInput
            accessibilityLabel="訪談回覆"
            accessibilityHint="輸入你願意提供給個人脈絡訪談的回答"
            multiline
            onChangeText={setMessage}
            placeholder="說你願意說的部分就好。"
            placeholderTextColor={palette.muted}
            style={styles.textArea}
            testID="profile.interview.message.input"
            textAlignVertical="top"
            value={message}
          />
          <ActionButton
            disabled={message.trim().length < 2 || respondMutation.isPending}
            label="送出"
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
              label="跳過這題"
              loading={skipMutation.isPending}
              onPress={() => skipMutation.mutate()}
              testID="profile.interview.skip"
              tone="amber"
              variant="outline"
            />
            <ActionButton
              label="停止生成"
              loading={cancelMutation.isPending}
              onPress={() => cancelMutation.mutate()}
              testID="profile.interview.cancel"
              tone="coral"
              variant="outline"
            />
            <ActionButton
              label="結束訪談"
              loading={endMutation.isPending}
              onPress={() => endMutation.mutate()}
              testID="profile.interview.end"
              tone="teal"
              variant="outline"
            />
          </>
        ) : null}
        <LinkButton href="/profile/story" label="查看我的故事" tone="blue" testID="profile.interview.story" />
      </View>

      <Panel title="狀態">
        <FeatureRow title="輪次" detail={`${sessionQuery.data?.turns?.length ?? 0}`} tone="teal" />
        <FeatureRow title="已觸及領域" detail={labelPsychDomains(sessionQuery.data?.domains_touched)} tone="blue" />
        <FeatureRow title="同步狀態" detail={labelInterviewSyncProgress(streamState.status, isRecovering)} tone="coral" />
        <FeatureRow
          title="目前狀態"
          detail={`${labelLifecycleStatus(lifecycleStatus)}${isRecovering ? ' / 正在恢復' : ''}`}
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
