import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatHistoryVisibilityMode, ChatMessage, ChatVisibilityScope } from '@cj/api-client';
import type { AIStreamEvent } from '@cj/contracts/ai-stream';

import { connectChatAIStream, connectChatRoomStream, m3Api, normalizeM3Error } from '@/src/features/m3/api';
import {
  getLatestActiveAIStreamSnapshot,
  type AIStreamCallbacks,
  isTerminalAIStreamEvent,
} from '@/src/platform/sse/aiStreamState';
import { getLocale, t, useLocale } from '@/src/i18n';
import { useAIStreamSubscription } from '@/src/platform/sse/useAIStreamSubscription';
import { sessionStorage, tokenStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

const visibilityOptions: Array<{ labelKey: string; value: ChatVisibilityScope; tone: 'teal' | 'blue' | 'amber' }> = [
  { labelKey: 'chatRoom.visibility.all', value: 'all', tone: 'teal' },
  { labelKey: 'chatRoom.visibility.ownerOnly', value: 'owner_only', tone: 'blue' },
  { labelKey: 'chatRoom.visibility.summaryOnly', value: 'summary_only', tone: 'amber' },
];

const roomStatusLabelKeys: Record<string, string> = {
  solo_active: 'chatRoom.roomStatus.soloActive',
  invite_pending: 'chatRoom.roomStatus.invitePending',
  invite_accepted: 'chatRoom.roomStatus.inviteAccepted',
  group_active: 'chatRoom.roomStatus.groupActive',
  judgment_requested: 'chatRoom.roomStatus.analysisRequested',
  judgment_completed: 'chatRoom.roomStatus.analysisCompleted',
  judgment_failed: 'chatRoom.roomStatus.analysisFailed',
  archived: 'chatRoom.roomStatus.archived',
};

const historyVisibilityLabelKeys: Record<ChatHistoryVisibilityMode, string> = {
  share_full_history: 'chatRoom.history.full',
  share_summary_only: 'chatRoom.history.summaryOnly',
  share_from_join_time: 'chatRoom.history.fromJoin',
};

const messageVisibilityLabelKeys: Record<ChatVisibilityScope, string> = {
  all: 'chatRoom.messageVisibility.all',
  owner_only: 'chatRoom.messageVisibility.ownerOnly',
  summary_only: 'chatRoom.messageVisibility.summaryOnly',
};

const roomStreamStatusLabelKeys: Record<'idle' | 'ready' | 'event' | 'failed', string> = {
  idle: 'chatRoom.roomStream.idle',
  ready: 'chatRoom.roomStream.ready',
  event: 'chatRoom.roomStream.event',
  failed: 'chatRoom.roomStream.failed',
};

const chatAIStatusLabelKeys: Record<ChatAIStatus, string> = {
  idle: 'chatRoom.aiStatus.idle',
  ready: 'chatRoom.aiStatus.ready',
  streaming: 'chatRoom.aiStatus.streaming',
  persisted: 'chatRoom.aiStatus.persisted',
  failed: 'chatRoom.aiStatus.failed',
};

function labelRoomStatus(status?: string | null): string {
  if (!status) return t('chatRoom.roomStatus.loading');
  return t(roomStatusLabelKeys[status] ?? 'chatRoom.roomStatus.updated');
}

function labelHistoryVisibility(mode?: ChatHistoryVisibilityMode | null): string {
  return t(historyVisibilityLabelKeys[mode ?? 'share_summary_only']);
}

function labelMessageVisibility(scope?: ChatVisibilityScope | null): string {
  if (!scope) return t('chatRoom.messageVisibility.unknown');
  return t(messageVisibilityLabelKeys[scope] ?? 'chatRoom.messageVisibility.unknown');
}

function labelLifecycleStatus(status: string): string {
  if (status === 'active' || status === 'unknown') return t('chatRoom.lifecycle.active');
  if (status === 'background') return t('chatRoom.lifecycle.background');
  if (status === 'inactive') return t('chatRoom.lifecycle.inactive');
  return t('chatRoom.lifecycle.updated');
}

function labelChatAISyncProgress(status: ChatAIStatus, isRecovering: boolean): string {
  if (isRecovering) return t('chatRoom.aiSync.recovering');
  if (status === 'persisted') return t('chatRoom.aiSync.persisted');
  if (status === 'failed') return t('chatRoom.aiSync.failed');
  if (status === 'streaming') return t('chatRoom.aiSync.streaming');
  if (status === 'ready') return t('chatRoom.aiSync.ready');
  return t('chatRoom.aiSync.idle');
}

function formatMessageTime(value?: string | null): string {
  if (!value) return t('chatRoom.time.unsynced');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('chatRoom.time.unsynced');
  return new Intl.DateTimeFormat(getLocale() === 'en-US' ? 'en-US' : 'zh-Hant', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    year: 'numeric',
  }).format(date);
}

function getMessageMeta(message: ChatMessage): { label: string; tone: 'teal' | 'blue' | 'amber' | 'coral' | 'neutral' } {
  const role = message.sender_participant?.role_in_room;
  if (message.message_type === 'safety_notice') return { label: t('chatRoom.messageMeta.safety'), tone: 'coral' };
  if (role === 'roleA') return { label: t('chatRoom.messageMeta.roleA'), tone: 'teal' };
  if (role === 'roleB') return { label: t('chatRoom.messageMeta.roleB'), tone: 'blue' };
  if (role === 'aiMediator') return { label: t('chatRoom.messageMeta.aiMediator'), tone: 'amber' };
  return { label: t('chatRoom.messageMeta.system'), tone: 'neutral' };
}

type ChatAIStatus = 'idle' | 'ready' | 'streaming' | 'persisted' | 'failed';

interface ChatAIStreamState {
  status: ChatAIStatus;
  text: string;
  error: string | null;
}

const initialChatAIStreamState: ChatAIStreamState = {
  status: 'idle',
  text: '',
  error: null,
};

function chatAIStatusFromEvent(event: AIStreamEvent): ChatAIStatus {
  if (event.eventType === 'stream.failed' || event.eventType === 'stream.cancelled') return 'failed';
  if (event.eventType === 'stream.persisted' || event.eventType === 'stream.completed') return 'persisted';
  if (event.eventType === 'stream.delta' || event.eventType === 'stream.started' || event.eventType === 'stream.phase') {
    return 'streaming';
  }
  return 'ready';
}

export default function ChatRoomScreen() {
  useLocale();
  const params = useLocalSearchParams<{ roomId?: string }>();
  const roomId = typeof params.roomId === 'string' ? params.roomId : null;
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [compose, setCompose] = useState('');
  const [visibilityScope, setVisibilityScope] = useState<ChatVisibilityScope>('all');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [roleBConsent, setRoleBConsent] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'ready' | 'event' | 'failed'>('idle');
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const actorQuery = useQuery({
    queryKey: ['m3', 'chat-actor'],
    queryFn: async () => {
      const [token, sessionId] = await Promise.all([
        tokenStorage.getToken(),
        sessionStorage.getSessionId(),
      ]);
      return {
        hasActor: Boolean(token || sessionId),
        isAuthenticated: Boolean(token),
      };
    },
    enabled: mounted,
  });
  const hasActor = actorQuery.data?.hasActor === true;

  const roomQuery = useQuery({
    queryKey: ['m3', 'chat-room', roomId],
    queryFn: () => m3Api.chat.getRoom(roomId as string),
    enabled: mounted && hasActor && Boolean(roomId),
  });

  const messagesQuery = useQuery({
    queryKey: ['m3', 'chat-messages', roomId],
    queryFn: () => m3Api.chat.listMessages(roomId as string, { limit: 50 }),
    enabled: mounted && hasActor && Boolean(roomId),
  });

  const judgmentStatusQuery = useQuery({
    queryKey: ['m3', 'chat-judgment-status', roomId],
    queryFn: () => m3Api.chat.getJudgmentStatus(roomId as string),
    enabled: mounted && hasActor && Boolean(roomId),
  });

  useEffect(() => {
    if (!mounted || !hasActor || !roomId || !roomQuery.data?.id) return undefined;
    const controller = new AbortController();
    setStreamStatus('idle');
    setStreamError(null);
    void connectChatRoomStream(
      roomId,
      {
        onReady: () => setStreamStatus('ready'),
        onEvent: () => {
          setStreamStatus('event');
          void queryClient.invalidateQueries({ queryKey: ['m3', 'chat-room', roomId] });
          void queryClient.invalidateQueries({ queryKey: ['m3', 'chat-messages', roomId] });
          void queryClient.invalidateQueries({ queryKey: ['m3', 'chat-judgment-status', roomId] });
        },
        onError: (error) => {
          if (!controller.signal.aborted) {
            setStreamStatus('failed');
            setStreamError(normalizeM3Error(error).message);
          }
        },
      },
      { signal: controller.signal }
    ).catch((error) => {
      if (!controller.signal.aborted) {
        setStreamStatus('failed');
        setStreamError(normalizeM3Error(error).message);
      }
    });

    return () => controller.abort();
  }, [hasActor, mounted, queryClient, roomId, roomQuery.data?.id]);

  const connectChatAI = useCallback((callbacks: AIStreamCallbacks, options: { afterSeq?: number; signal?: AbortSignal }) => {
    if (!roomId) return Promise.resolve();
    return connectChatAIStream(roomId, callbacks, options);
  }, [roomId]);

  const {
    state: aiStreamState,
    setState: setAIStreamState,
    isRecovering: aiStreamRecovering,
    lifecycleStatus: aiStreamLifecycleStatus,
  } = useAIStreamSubscription<ChatAIStreamState>({
    scopeKey: roomId ? `chat_room:${roomId}` : null,
    enabled: mounted && hasActor && Boolean(roomId),
    initialState: initialChatAIStreamState,
    connect: connectChatAI,
    normalizeError: normalizeM3Error,
    reduceReady: (prev, ready) => {
      const latestActive = getLatestActiveAIStreamSnapshot(ready.snapshots);
      if (!latestActive) return { ...prev, status: 'ready', error: null };
      return {
        status: latestActive.status === 'failed' || latestActive.status === 'cancelled' ? 'failed' : 'streaming',
        text: latestActive.text ?? '',
        error: latestActive.error?.message ?? null,
      };
    },
    reduceEvent: (prev, event) => ({
      status: chatAIStatusFromEvent(event),
      text: event.fullText
        ?? (event.eventType === 'stream.delta' ? `${prev.text}${event.deltaText ?? ''}` : prev.text),
      error: event.error?.message ?? null,
    }),
    hasRecoverableState: (value) => Boolean(value.text) && value.status !== 'persisted' && value.status !== 'failed',
    shouldClearRecoveringOnEvent: (event) => event.eventType === 'stream.delta' || isTerminalAIStreamEvent(event),
    onEvent: (event) => {
      if (event.eventType === 'stream.persisted') {
        void queryClient.invalidateQueries({ queryKey: ['m3', 'chat-room', roomId] });
        void queryClient.invalidateQueries({ queryKey: ['m3', 'chat-messages', roomId] });
        void queryClient.invalidateQueries({ queryKey: ['m3', 'chat-judgment-status', roomId] });
      }
    },
    onConnectionError: (error) => {
      setAIStreamState((prev) => ({ ...prev, error: error.message }));
    },
    onTerminalError: (error) => {
      setAIStreamState((prev) => ({ ...prev, status: 'failed', error: error.message }));
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: () => m3Api.chat.sendMessage(roomId as string, {
      content: compose.trim(),
      visibility_scope: visibilityScope,
    }),
    onSuccess: async () => {
      setCompose('');
      await queryClient.invalidateQueries({ queryKey: ['m3', 'chat-messages', roomId] });
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: () => m3Api.chat.createInvite(roomId as string, {
      history_visibility_mode: roomQuery.data?.history_visibility_mode ?? 'share_summary_only',
      expires_in_hours: 24,
    }),
    onSuccess: async (invite) => {
      setInviteCode(invite.invite_code ?? null);
      await queryClient.invalidateQueries({ queryKey: ['m3', 'chat-room', roomId] });
    },
  });

  const requestJudgmentMutation = useMutation({
    mutationFn: () => {
      const includedIds = includedMessages.map((message) => message.id);
      return m3Api.chat.requestJudgment(roomId as string, {
        included_message_ids: includedIds,
        participant_consent: hasRoleBIncluded ? { role_b_included_messages: roleBConsent } : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['m3', 'chat-room', roomId] });
      await queryClient.invalidateQueries({ queryKey: ['m3', 'chat-judgment-status', roomId] });
    },
  });

  const leaveRoomMutation = useMutation({
    mutationFn: () => m3Api.chat.leaveRoom(roomId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['m3', 'chat-room', roomId] });
    },
  });

  const messages = messagesQuery.data?.messages ?? [];
  const includedMessages = useMemo(
    () => messages.filter((message) => message.message_type === 'user_text' && message.visibility_scope === 'all'),
    [messages]
  );
  const hasRoleBIncluded = includedMessages.some((message) => message.sender_participant?.role_in_room === 'roleB');

  const errorMessage = roomQuery.error
    ? normalizeM3Error(roomQuery.error).message
    : messagesQuery.error
      ? normalizeM3Error(messagesQuery.error).message
      : judgmentStatusQuery.error
        ? normalizeM3Error(judgmentStatusQuery.error).message
        : sendMessageMutation.error
          ? normalizeM3Error(sendMessageMutation.error).message
          : createInviteMutation.error
            ? normalizeM3Error(createInviteMutation.error).message
            : requestJudgmentMutation.error
              ? normalizeM3Error(requestJudgmentMutation.error).message
              : leaveRoomMutation.error
              ? normalizeM3Error(leaveRoomMutation.error).message
                : (streamError ?? aiStreamState.error);

  if (!mounted) {
    return (
      <Screen
        eyebrow={t('chatRoom.eyebrow')}
        title={t('chatRoom.loading.title')}
        subtitle={t('chatRoom.loading.subtitle')}
        testID="chat.room.loading.screen">
        <Panel title={t('chatRoom.statusPanel')}>
          <StatusPill label={t('chatRoom.loading.pill')} tone="blue" />
        </Panel>
      </Screen>
    );
  }

  if (!roomId) {
    return (
      <Screen
        eyebrow={t('chatRoom.eyebrow')}
        title={t('chatRoom.missing.title')}
        subtitle={t('chatRoom.missing.subtitle')}
        testID="chat.room.missing.screen">
        <LinkButton href="/chat" label={t('chatRoom.back')} tone="teal" testID="chat.room.back" />
      </Screen>
    );
  }

  if (actorQuery.isLoading) {
    return (
      <Screen
        eyebrow={t('chatRoom.eyebrow')}
        title={t('chatRoom.actorLoading.title')}
        subtitle={t('chatRoom.actorLoading.subtitle')}
        testID="chat.room.actor-loading.screen">
        <Panel title={t('chatRoom.statusPanel')}>
          <StatusPill label={t('chatRoom.actorLoading.pill')} tone="blue" />
        </Panel>
      </Screen>
    );
  }

  if (!hasActor) {
    return (
      <Screen
        eyebrow={t('chatRoom.eyebrow')}
        title={t('chatRoom.authGate.title')}
        subtitle={t('chatRoom.authGate.subtitle')}
        testID="chat.room.auth-gate.screen">
        <Panel title={t('chatRoom.authGate.panel')}>
          <FeatureRow title={t('chatRoom.authGate.noDirect.title')} detail={t('chatRoom.authGate.noDirect.detail')} tone="teal" />
          <FeatureRow title={t('chatRoom.authGate.fromHome.title')} detail={t('chatRoom.authGate.fromHome.detail')} tone="blue" />
        </Panel>
        <LinkButton href="/chat" label={t('chatRoom.back')} tone="teal" testID="chat.room.auth-gate.back" />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow={t('chatRoom.eyebrow')}
      title={t('chatRoom.title')}
      subtitle={t('chatRoom.subtitle')}
      testID="chat.room.screen">
      <Panel title={t('chatRoom.roomStatusPanel')}>
        <StatusPill label={labelRoomStatus(roomQuery.data?.status)} tone="blue" />
        <FeatureRow
          title={t('chatRoom.historyVisibility')}
          detail={labelHistoryVisibility(roomQuery.data?.history_visibility_mode)}
          tone="amber"
        />
        <FeatureRow title={t('chatRoom.messageSync')} detail={t(roomStreamStatusLabelKeys[streamStatus])} tone={streamStatus === 'failed' ? 'coral' : 'blue'} />
        <FeatureRow
          title={t('chatRoom.aiDraftStatus')}
          detail={`${labelChatAISyncProgress(aiStreamState.status, aiStreamRecovering)} / ${labelLifecycleStatus(aiStreamLifecycleStatus)}`}
          tone={aiStreamRecovering ? 'amber' : aiStreamState.status === 'failed' ? 'coral' : 'blue'}
        />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      {aiStreamState.text || aiStreamRecovering ? (
        <Panel title={t('chatRoom.aiDraftPanel')}>
          <StatusPill
            label={aiStreamRecovering ? t('chatRoom.aiRecoveringLabel') : t(chatAIStatusLabelKeys[aiStreamState.status])}
            tone={aiStreamRecovering ? 'amber' : aiStreamState.status === 'failed' ? 'coral' : 'amber'}
          />
          {aiStreamState.text ? <Text style={styles.aiDraftText}>{aiStreamState.text}</Text> : null}
        </Panel>
      ) : null}

      <Panel title={t('chatRoom.messagesPanel')}>
        {messages.length ? (
          messages.map((message) => {
            const meta = getMessageMeta(message);
            return (
              <View key={message.id} style={styles.message}>
                <View style={styles.messageHeader}>
                  <StatusPill label={meta.label} tone={meta.tone} />
                  <Text
                    accessibilityLabel={t('chatRoom.time.accessibility', { time: formatMessageTime(message.created_at) })}
                    style={styles.messageTime}
                    testID={`chat.room.message.${message.id}.time`}>
                    {t('chatRoom.time.prefix', { time: formatMessageTime(message.created_at) })}
                  </Text>
                </View>
                <Text style={styles.messageText}>{message.content}</Text>
                <Text style={styles.messageMeta}>{labelMessageVisibility(message.visibility_scope)}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>{t('chatRoom.emptyMessages')}</Text>
        )}
      </Panel>

      <Panel title={t('chatRoom.composePanel')}>
        <TextInput
          accessibilityLabel={t('chatRoom.compose.label')}
          accessibilityHint={t('chatRoom.compose.hint')}
          multiline
          onChangeText={setCompose}
          placeholder={t('chatRoom.compose.placeholder')}
          placeholderTextColor={palette.muted}
          style={styles.textArea}
          testID="chat.room.compose.input"
          textAlignVertical="top"
          value={compose}
        />
        <View style={styles.optionRow}>
          {visibilityOptions.map((option) => (
            <ActionButton
              key={option.value}
              label={t(option.labelKey)}
              onPress={() => setVisibilityScope(option.value)}
              tone={option.tone}
              variant={visibilityScope === option.value ? 'filled' : 'outline'}
            />
          ))}
        </View>
        <ActionButton
          disabled={compose.trim().length < 2 || sendMessageMutation.isPending}
          label={t('chatRoom.sendMessage')}
          loading={sendMessageMutation.isPending}
          onPress={() => sendMessageMutation.mutate()}
          testID="chat.room.send-message"
          tone="teal"
        />
      </Panel>

      <Panel title={t('chatRoom.invitePanel')}>
        <FeatureRow title={t('chatRoom.inviteShare.title')} detail={t('chatRoom.inviteShare.detail')} tone="blue" />
        {inviteCode ? (
          <>
            <Text style={styles.inviteCode}>{inviteCode}</Text>
            <LinkButton
              href={`/chat/invite?code=${encodeURIComponent(inviteCode)}`}
              label={t('chatRoom.openInvite')}
              testID="chat.room.open-invite"
              tone="blue"
              variant="outline"
            />
          </>
        ) : null}
        <ActionButton
          label={t('chatRoom.createInvite')}
          loading={createInviteMutation.isPending}
          onPress={() => createInviteMutation.mutate()}
          testID="chat.room.create-invite"
          tone="blue"
          variant="outline"
        />
      </Panel>

      <Panel title={t('chatRoom.analysisPanel')}>
        <FeatureRow title={t('chatRoom.includedScope')} detail={t('chatRoom.includedScope.detail', { count: includedMessages.length })} tone="teal" />
        {hasRoleBIncluded ? (
          <ActionButton
            label={roleBConsent ? t('chatRoom.roleBConsent.confirmed') : t('chatRoom.roleBConsent.pending')}
            onPress={() => setRoleBConsent((value) => !value)}
            testID="chat.room.role-b-consent"
            tone={roleBConsent ? 'teal' : 'amber'}
            variant={roleBConsent ? 'filled' : 'outline'}
          />
        ) : null}
        <ActionButton
          disabled={includedMessages.length === 0 || (hasRoleBIncluded && !roleBConsent)}
          label={t('chatRoom.requestAnalysis')}
          loading={requestJudgmentMutation.isPending}
          onPress={() => requestJudgmentMutation.mutate()}
          testID="chat.room.request-judgment"
          tone="coral"
        />
        <FeatureRow
          title={t('chatRoom.analysisStatus')}
          detail={judgmentStatusQuery.data?.roomStatus || roomQuery.data?.status
            ? labelRoomStatus(judgmentStatusQuery.data?.roomStatus ?? roomQuery.data?.status)
            : t('chatRoom.analysisNotRequested')}
          tone="coral"
        />
      </Panel>

      <View style={styles.actions}>
        <ActionButton
          label={t('chatRoom.leave')}
          loading={leaveRoomMutation.isPending}
          onPress={() => leaveRoomMutation.mutate()}
          testID="chat.room.leave"
          tone="neutral"
          variant="outline"
        />
        <LinkButton href="/chat" label={t('chatRoom.back')} tone="teal" testID="chat.room.back" variant="outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    gap: spacing.xs,
    borderRadius: 8,
    backgroundColor: palette.panel,
    padding: spacing.md,
  },
  messageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  messageTime: {
    ...typography.caption,
    color: palette.muted,
  },
  messageText: {
    ...typography.body,
    color: palette.ink,
  },
  messageMeta: {
    ...typography.caption,
    color: palette.muted,
  },
  emptyText: {
    ...typography.small,
    color: palette.muted,
  },
  textArea: {
    ...typography.body,
    color: palette.ink,
    minHeight: 108,
    padding: 0,
  },
  optionRow: {
    gap: spacing.sm,
  },
  inviteCode: {
    ...typography.hero,
    color: palette.ink,
  },
  errorText: {
    ...typography.small,
    color: palette.coral,
  },
  aiDraftText: {
    ...typography.body,
    color: palette.ink,
  },
  actions: {
    gap: spacing.sm,
  },
});
