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
import { useAIStreamSubscription } from '@/src/platform/sse/useAIStreamSubscription';
import { sessionStorage, tokenStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';

const visibilityOptions: Array<{ label: string; value: ChatVisibilityScope; tone: 'teal' | 'blue' | 'amber' }> = [
  { label: '全部可見', value: 'all', tone: 'teal' },
  { label: '只給我看', value: 'owner_only', tone: 'blue' },
  { label: '摘要可見', value: 'summary_only', tone: 'amber' },
];

const roomStatusLabels: Record<string, string> = {
  solo_active: '個人整理中',
  invite_pending: '等待對方加入',
  invite_accepted: '對方已加入',
  group_active: '雙方整理中',
  judgment_requested: '判斷中',
  judgment_completed: '已有判斷',
  judgment_failed: '判斷未完成',
  archived: '已封存',
};

const historyVisibilityLabels: Record<ChatHistoryVisibilityMode, string> = {
  share_full_history: '對方加入後可看完整脈絡',
  share_summary_only: '對方加入後只看重點摘要',
  share_from_join_time: '對方只看加入後的新內容',
};

const messageVisibilityLabels: Record<ChatVisibilityScope, string> = {
  all: '可納入判斷',
  owner_only: '只給我看',
  summary_only: '只分享摘要',
};

const roomStreamStatusLabels: Record<'idle' | 'ready' | 'event' | 'failed', string> = {
  idle: '等待同步',
  ready: '已連線',
  event: '剛剛更新',
  failed: '同步失敗',
};

const chatMessageTimeFormatter = new Intl.DateTimeFormat('zh-Hant', {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'numeric',
  year: 'numeric',
});

const chatAIStatusLabels: Record<ChatAIStatus, string> = {
  idle: '等待生成',
  ready: '已連線',
  streaming: '生成中',
  persisted: '已保存',
  failed: '生成失敗',
};

function labelRoomStatus(status?: string | null): string {
  if (!status) return '載入中';
  return roomStatusLabels[status] ?? '狀態更新中';
}

function labelHistoryVisibility(mode?: ChatHistoryVisibilityMode | null): string {
  return historyVisibilityLabels[mode ?? 'share_summary_only'];
}

function labelMessageVisibility(scope?: ChatVisibilityScope | null): string {
  if (!scope) return '可見範圍未定';
  return messageVisibilityLabels[scope] ?? '可見範圍未定';
}

function labelLifecycleStatus(status: string): string {
  if (status === 'active' || status === 'unknown') return 'App 使用中';
  if (status === 'background') return 'App 在背景';
  if (status === 'inactive') return 'App 暫時中斷';
  return 'App 狀態更新中';
}

function labelChatAISyncProgress(status: ChatAIStatus, isRecovering: boolean): string {
  if (isRecovering) return '正在恢復協調草稿，會從最近收到的內容繼續。';
  if (status === 'persisted') return '草稿已保存';
  if (status === 'failed') return '草稿生成需要重試';
  if (status === 'streaming') return '正在生成協調草稿';
  if (status === 'ready') return '已準備同步協調草稿';
  return '等待生成協調草稿';
}

function formatMessageTime(value?: string | null): string {
  if (!value) return '時間待同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '時間待同步';
  return chatMessageTimeFormatter.format(date);
}

function getMessageMeta(message: ChatMessage): { label: string; tone: 'teal' | 'blue' | 'amber' | 'coral' | 'neutral' } {
  const role = message.sender_participant?.role_in_room;
  if (message.message_type === 'safety_notice') return { label: '安全提示', tone: 'coral' };
  if (role === 'roleA') return { label: 'A 方', tone: 'teal' };
  if (role === 'roleB') return { label: 'B 方', tone: 'blue' };
  if (role === 'aiMediator') return { label: 'AI 協調', tone: 'amber' };
  return { label: '系統', tone: 'neutral' };
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
        eyebrow="對話"
        title="載入對話"
        subtitle="正在讀取對話內容。"
        testID="chat.room.loading.screen">
        <Panel title="狀態">
          <StatusPill label="載入中" tone="blue" />
        </Panel>
      </Screen>
    );
  }

  if (!roomId) {
    return (
      <Screen
        eyebrow="對話"
        title="缺少對話"
        subtitle="請先建立新的對話，或從邀請連結進入。"
        testID="chat.room.missing.screen">
        <LinkButton href="/chat" label="回到對話" tone="teal" testID="chat.room.back" />
      </Screen>
    );
  }

  if (actorQuery.isLoading) {
    return (
      <Screen
        eyebrow="對話"
        title="確認身份"
        subtitle="正在確認本機會話或登入狀態。"
        testID="chat.room.actor-loading.screen">
        <Panel title="狀態">
          <StatusPill label="確認中" tone="blue" />
        </Panel>
      </Screen>
    );
  }

  if (!hasActor) {
    return (
      <Screen
        eyebrow="對話"
        title="先建立對話上下文"
        subtitle="對話讀取需要登入帳號，或從對話首頁正常建立新對話。"
        testID="chat.room.auth-gate.screen">
        <Panel title="保護對話">
          <FeatureRow title="不直接打開" detail="沒有有效身份時，不會直接讀取對話內容。" tone="teal" />
          <FeatureRow title="從對話首頁進入" detail="建立新對話後，再回到對話繼續整理。" tone="blue" />
        </Panel>
        <LinkButton href="/chat" label="回到對話" tone="teal" testID="chat.room.auth-gate.back" />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="對話"
      title="對話"
      subtitle="先整理、再邀請，只有明確點擊才會請求判斷。"
      testID="chat.room.screen">
      <Panel title="對話狀態">
        <StatusPill label={labelRoomStatus(roomQuery.data?.status)} tone="blue" />
        <FeatureRow
          title="可見策略"
          detail={labelHistoryVisibility(roomQuery.data?.history_visibility_mode)}
          tone="amber"
        />
        <FeatureRow title="訊息同步" detail={roomStreamStatusLabels[streamStatus]} tone={streamStatus === 'failed' ? 'coral' : 'blue'} />
        <FeatureRow
          title="協調草稿"
          detail={`${labelChatAISyncProgress(aiStreamState.status, aiStreamRecovering)} / ${labelLifecycleStatus(aiStreamLifecycleStatus)}`}
          tone={aiStreamRecovering ? 'amber' : aiStreamState.status === 'failed' ? 'coral' : 'blue'}
        />
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </Panel>

      {aiStreamState.text || aiStreamRecovering ? (
        <Panel title="AI 協調生成">
          <StatusPill
            label={aiStreamRecovering ? '恢復生成中' : chatAIStatusLabels[aiStreamState.status]}
            tone={aiStreamRecovering ? 'amber' : aiStreamState.status === 'failed' ? 'coral' : 'amber'}
          />
          {aiStreamState.text ? <Text style={styles.aiDraftText}>{aiStreamState.text}</Text> : null}
        </Panel>
      ) : null}

      <Panel title="訊息">
        {messages.length ? (
          messages.map((message) => {
            const meta = getMessageMeta(message);
            return (
              <View key={message.id} style={styles.message}>
                <View style={styles.messageHeader}>
                  <StatusPill label={meta.label} tone={meta.tone} />
                  <Text
                    accessibilityLabel={`訊息時間：${formatMessageTime(message.created_at)}`}
                    style={styles.messageTime}
                    testID={`chat.room.message.${message.id}.time`}>
                    訊息時間：{formatMessageTime(message.created_at)}
                  </Text>
                </View>
                <Text style={styles.messageText}>{message.content}</Text>
                <Text style={styles.messageMeta}>{labelMessageVisibility(message.visibility_scope)}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>還沒有訊息。先寫一段你願意放進對話的材料。</Text>
        )}
      </Panel>

      <Panel title="發言">
        <TextInput
          accessibilityLabel="發言"
          accessibilityHint="輸入一段要送進對話的具體材料"
          multiline
          onChangeText={setCompose}
          placeholder="說清楚一個具體片段，不急著定責。"
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
              label={option.label}
              onPress={() => setVisibilityScope(option.value)}
              tone={option.tone}
              variant={visibilityScope === option.value ? 'filled' : 'outline'}
            />
          ))}
        </View>
        <ActionButton
          disabled={compose.trim().length < 2 || sendMessageMutation.isPending}
          label="送出訊息"
          loading={sendMessageMutation.isPending}
          onPress={() => sendMessageMutation.mutate()}
          testID="chat.room.send-message"
          tone="teal"
        />
      </Panel>

      <Panel title="邀請">
        <FeatureRow title="分享方式" detail="先生成邀請碼；對方登入後可以回到這個對話。" tone="blue" />
        {inviteCode ? (
          <>
            <Text style={styles.inviteCode}>{inviteCode}</Text>
            <LinkButton
              href={`/chat/invite?code=${encodeURIComponent(inviteCode)}`}
              label="打開邀請承接頁"
              testID="chat.room.open-invite"
              tone="blue"
              variant="outline"
            />
          </>
        ) : null}
        <ActionButton
          label="生成邀請碼"
          loading={createInviteMutation.isPending}
          onPress={() => createInviteMutation.mutate()}
          testID="chat.room.create-invite"
          tone="blue"
          variant="outline"
        />
      </Panel>

      <Panel title="轉判斷">
        <FeatureRow title="納入範圍" detail={`目前會納入 ${includedMessages.length} 則雙方可見訊息。`} tone="teal" />
        {hasRoleBIncluded ? (
          <ActionButton
            label={roleBConsent ? '已確認 B 方同意' : '確認 B 方同意後納入'}
            onPress={() => setRoleBConsent((value) => !value)}
            testID="chat.room.role-b-consent"
            tone={roleBConsent ? 'teal' : 'amber'}
            variant={roleBConsent ? 'filled' : 'outline'}
          />
        ) : null}
        <ActionButton
          disabled={includedMessages.length === 0 || (hasRoleBIncluded && !roleBConsent)}
          label="請求判斷"
          loading={requestJudgmentMutation.isPending}
          onPress={() => requestJudgmentMutation.mutate()}
          testID="chat.room.request-judgment"
          tone="coral"
        />
        <FeatureRow
          title="判斷狀態"
          detail={judgmentStatusQuery.data?.roomStatus || roomQuery.data?.status
            ? labelRoomStatus(judgmentStatusQuery.data?.roomStatus ?? roomQuery.data?.status)
            : '尚未請求'}
          tone="coral"
        />
      </Panel>

      <View style={styles.actions}>
        <ActionButton
          label="離開對話"
          loading={leaveRoomMutation.isPending}
          onPress={() => leaveRoomMutation.mutate()}
          testID="chat.room.leave"
          tone="neutral"
          variant="outline"
        />
        <LinkButton href="/chat" label="回到對話" tone="teal" testID="chat.room.back" variant="outline" />
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
