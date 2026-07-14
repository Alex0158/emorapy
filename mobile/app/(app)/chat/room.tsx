import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChatMessage,
  ChatVisibilityScope,
  PrivateContextUseMode,
} from '@emorapy/api-client';
import type { AIStreamEvent } from '@emorapy/contracts/ai-stream';

import {
  connectChatAIStream,
  connectChatChannelStream,
  connectChatRoomStream,
  m3Api,
  normalizeM3Error,
} from '@/src/features/m3/api';
import {
  getLatestActiveAIStreamSnapshot,
  type AIStreamCallbacks,
  isTerminalAIStreamEvent,
} from '@/src/platform/sse/aiStreamState';
import { getLocale, t, useLocale } from '@/src/i18n';
import { useAIStreamSubscription } from '@/src/platform/sse/useAIStreamSubscription';
import { formatAIStreamDisplayError } from '@/src/platform/sse/streamErrorDisplay';
import { sessionStorage, tokenStorage } from '@/src/platform/storage/secureStore';
import { ActionButton, FeatureRow, LinkButton, Panel, Screen, StatusPill } from '@/src/ui/components';
import { palette, spacing, typography } from '@/src/ui/theme';
import { ChatConversationLaneSelector } from '@/src/features/m3/ChatConversationLaneSelector';
import { useChatConversationLane } from '@/src/features/m3/useChatConversationLane';
import { ChatAnalysisConsentPanel } from '@/src/features/m3/ChatAnalysisConsentPanel';
import { ChatContextCapsuleComposer } from '@/src/features/m3/ChatContextCapsuleComposer';
import { ChatContextUsageReceipts } from '@/src/features/m3/ChatContextUsageReceipts';
import { ChatSharedSafetyStatusNotice } from '@/src/features/m3/ChatSharedSafetyStatusNotice';
import { ChatSharedContextManager } from '@/src/features/m3/ChatSharedContextManager';
import { useChatAnalysisConsent } from '@/src/features/m3/useChatAnalysisConsent';
import { useChatRoomSafetyStatus } from '@/src/features/m3/useChatRoomSafetyStatus';
import { chatQueryKeys } from '@/src/features/m3/chatQueryKeys';
import { useIdentityQueryScope } from '@/src/providers/identityQueryScope';

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
  const identityScope = useIdentityQueryScope();
  const identityQueriesEnabled = identityScope.privateDataEnabled && !identityScope.transitioning;
  const identityEpoch = identityScope.epoch;
  const [mounted, setMounted] = useState(false);
  const { activeLane, clearCompose, compose, setActiveLane, setCompose } = useChatConversationLane(roomId);
  const initializedLaneRoomIdRef = useRef<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'ready' | 'event' | 'failed'>('idle');
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const actorQuery = useQuery({
    queryKey: chatQueryKeys.actor(identityEpoch),
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
    enabled: mounted && identityQueriesEnabled,
  });
  const hasActor = actorQuery.data?.hasActor === true;

  const roomQuery = useQuery({
    queryKey: chatQueryKeys.room(identityEpoch, roomId),
    queryFn: () => m3Api.chat.getRoom(roomId as string),
    enabled: mounted && identityQueriesEnabled && hasActor && Boolean(roomId),
  });

  const messagesQuery = useQuery({
    queryKey: chatQueryKeys.messages(identityEpoch, roomId),
    queryFn: () => m3Api.chat.listMessages(roomId as string, { limit: 50 }),
    enabled: mounted && identityQueriesEnabled && hasActor && Boolean(roomId),
  });

  const channelsQuery = useQuery({
    queryKey: chatQueryKeys.channels(identityEpoch, roomId),
    queryFn: () => m3Api.chat.listChannels(roomId as string),
    enabled: mounted && identityQueriesEnabled && hasActor && Boolean(roomId),
  });
  const privateChannel = channelsQuery.data?.find((channel) => channel.kind === 'private') ?? null;
  const sharedChannel = channelsQuery.data?.find((channel) => channel.kind === 'shared') ?? null;
  const activeChannel = activeLane === 'private' ? privateChannel : sharedChannel;

  const contextPreferenceQuery = useQuery({
    queryKey: chatQueryKeys.contextPreference(identityEpoch, roomId),
    queryFn: () => m3Api.chat.getPrivateContextPreference(roomId as string),
    enabled: mounted && identityQueriesEnabled && hasActor && Boolean(roomId),
  });
  const sharedSafety = useChatRoomSafetyStatus({
    enabled: mounted && identityQueriesEnabled && hasActor,
    roomId,
  });

  const judgmentStatusQuery = useQuery({
    queryKey: chatQueryKeys.judgmentStatus(identityEpoch, roomId),
    queryFn: () => m3Api.chat.getJudgmentStatus(roomId as string),
    enabled: mounted && identityQueriesEnabled && hasActor && Boolean(roomId),
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
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.room(identityEpoch, roomId) });
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.messages(identityEpoch, roomId) });
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.contextPreference(identityEpoch, roomId) });
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.contextUsageReceipts(identityEpoch, roomId) });
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.safetyStatus(identityEpoch, roomId) });
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.judgmentStatus(identityEpoch, roomId) });
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
  }, [hasActor, identityEpoch, mounted, queryClient, roomId, roomQuery.data?.id]);

  useEffect(() => {
    if (!mounted || !hasActor || !roomId || !privateChannel?.id) return undefined;
    const controller = new AbortController();
    void connectChatChannelStream(
      privateChannel.id,
      {
        onEvent: () => {
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.messages(identityEpoch, roomId) });
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.contextUsageReceipts(identityEpoch, roomId) });
          void queryClient.invalidateQueries({ queryKey: chatQueryKeys.safetyStatus(identityEpoch, roomId) });
        },
        onError: (error) => {
          if (!controller.signal.aborted) setStreamError(normalizeM3Error(error).message);
        },
      },
      { signal: controller.signal },
    ).catch((error) => {
      if (!controller.signal.aborted) setStreamError(normalizeM3Error(error).message);
    });
    return () => controller.abort();
  }, [hasActor, identityEpoch, mounted, privateChannel?.id, queryClient, roomId]);

  const connectChatAI = useCallback((callbacks: AIStreamCallbacks, options: { afterSeq?: number; signal?: AbortSignal }) => {
    if (!roomId || !activeChannel?.id) return Promise.resolve();
    return connectChatAIStream(
      activeLane === 'private' ? 'chat_channel' : 'chat_room',
      activeLane === 'private' ? activeChannel.id : roomId,
      callbacks,
      options,
    );
  }, [activeChannel?.id, activeLane, roomId]);

  const {
    state: aiStreamState,
    setState: setAIStreamState,
    isRecovering: aiStreamRecovering,
    lifecycleStatus: aiStreamLifecycleStatus,
  } = useAIStreamSubscription<ChatAIStreamState>({
    scopeKey: roomId && activeChannel?.id
      ? `${activeLane === 'private' ? 'chat_channel' : 'chat_room'}:${activeLane === 'private' ? activeChannel.id : roomId}`
      : null,
    enabled: mounted && identityQueriesEnabled && hasActor && Boolean(roomId && activeChannel?.id),
    initialState: initialChatAIStreamState,
    connect: connectChatAI,
    normalizeError: normalizeM3Error,
    reduceReady: (prev, ready) => {
      const latestActive = getLatestActiveAIStreamSnapshot(ready.snapshots);
      if (!latestActive) return { ...prev, status: 'ready', error: null };
      return {
        status: latestActive.status === 'failed' || latestActive.status === 'cancelled' ? 'failed' : 'streaming',
        text: latestActive.text ?? '',
        error: formatAIStreamDisplayError(latestActive.error),
      };
    },
    reduceEvent: (prev, event) => ({
      status: chatAIStatusFromEvent(event),
      text: event.fullText
        ?? (event.eventType === 'stream.delta' ? `${prev.text}${event.deltaText ?? ''}` : prev.text),
      error: formatAIStreamDisplayError(event.error),
    }),
    hasRecoverableState: (value) => Boolean(value.text) && value.status !== 'persisted' && value.status !== 'failed',
    shouldClearRecoveringOnEvent: (event) => event.eventType === 'stream.delta' || isTerminalAIStreamEvent(event),
    onEvent: (event) => {
      if (event.eventType === 'stream.persisted') {
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.room(identityEpoch, roomId) });
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.messages(identityEpoch, roomId) });
        void queryClient.invalidateQueries({ queryKey: chatQueryKeys.judgmentStatus(identityEpoch, roomId) });
      }
    },
    onConnectionError: (error) => {
      setAIStreamState((prev) => ({ ...prev, error: formatAIStreamDisplayError(error) }));
    },
    onTerminalError: (error) => {
      setAIStreamState((prev) => ({ ...prev, status: 'failed', error: formatAIStreamDisplayError(error) }));
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: () => m3Api.chat.sendChannelMessage(activeChannel?.id as string, {
      content: compose.trim(),
    }),
    onSuccess: async () => {
      clearCompose();
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.messages(identityEpoch, roomId) });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: chatQueryKeys.safetyStatus(identityEpoch, roomId),
      });
    },
  });

  const contextPreferenceMutation = useMutation({
    mutationFn: (mode: PrivateContextUseMode) => {
      const policyVersion = contextPreferenceQuery.data?.room_adaptation?.policy_version;
      if (!policyVersion) throw new Error('Chat adaptation policy is unavailable');
      return m3Api.chat.updatePrivateContextPreference(roomId as string, {
        mode,
        policy_version: policyVersion,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.contextPreference(identityEpoch, roomId) });
    },
  });

  const adaptationConsentMutation = useMutation({
    mutationFn: (decision: 'accepted' | 'declined') => {
      const policyVersion = contextPreferenceQuery.data?.room_adaptation?.policy_version;
      if (!policyVersion) throw new Error('Chat adaptation policy is unavailable');
      return m3Api.chat.updateSharedAdaptationConsent(roomId as string, {
        decision,
        policy_version: policyVersion,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.contextPreference(identityEpoch, roomId) });
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: () => m3Api.chat.createInvite(roomId as string, {
      history_visibility_mode: 'share_from_join_time',
      expires_in_hours: 24,
    }),
    onSuccess: async (invite) => {
      setInviteCode(invite.invite_code ?? null);
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.room(identityEpoch, roomId) });
    },
  });

  const leaveRoomMutation = useMutation({
    mutationFn: () => m3Api.chat.leaveRoom(roomId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chatQueryKeys.room(identityEpoch, roomId) });
    },
  });

  const messages = messagesQuery.data?.messages ?? [];
  const hasActiveRoleB = Boolean(roomQuery.data?.participants?.some(
    (participant) => participant.role_in_room === 'roleB' && participant.is_active
  ));
  const hasSharedMessages = messages.some((message) => (
    message.visibility_scope === 'all'
    && message.message_type !== 'safety_notice'
    && message.message_type !== 'system_event'
  ));
  const sharedAvailable = hasActiveRoleB || hasSharedMessages;
  const requiresSharedGovernance = (roomQuery.data?.participants?.filter(
    (participant) => participant.is_active
      && (participant.role_in_room === 'roleA' || participant.role_in_room === 'roleB'),
  ).length ?? 0) >= 2;
  const trustCheckpointRequired = (
    requiresSharedGovernance
    && contextPreferenceQuery.data?.adaptation_decision === 'not_set'
  );
  const contextGovernanceReady = Boolean(contextPreferenceQuery.data)
    && !contextPreferenceQuery.isPending
    && !contextPreferenceQuery.isError
    && !contextPreferenceQuery.isFetching;
  const sharedGovernanceBlocked = sharedAvailable && (
    !contextGovernanceReady || trustCheckpointRequired
  );
  const mustExitSharedLane = sharedAvailable && (
    !contextPreferenceQuery.data
    || contextPreferenceQuery.isError
    || trustCheckpointRequired
  );
  const formalActionsBlocked = sharedSafety.blocked || sharedGovernanceBlocked;
  const laneMessages = useMemo(
    () => messages.filter((message) => (
      message.channel_id
        ? message.channel_id === activeChannel?.id
        : activeLane === 'shared'
          ? message.visibility_scope === 'all'
          : message.visibility_scope !== 'all'
    )),
    [activeChannel?.id, activeLane, messages]
  );

  useEffect(() => {
    if (!roomId || !messagesQuery.isFetched || initializedLaneRoomIdRef.current === roomId) return;
    if (sharedAvailable && !contextGovernanceReady) return;
    initializedLaneRoomIdRef.current = roomId;
    setActiveLane(hasSharedMessages && !sharedGovernanceBlocked ? 'shared' : 'private');
  }, [
    contextGovernanceReady,
    hasSharedMessages,
    messagesQuery.isFetched,
    roomId,
    setActiveLane,
    sharedAvailable,
    sharedGovernanceBlocked,
  ]);

  useEffect(() => {
    if (!sharedAvailable && activeLane === 'shared') setActiveLane('private');
  }, [activeLane, setActiveLane, sharedAvailable]);

  useEffect(() => {
    if (mustExitSharedLane && activeLane === 'shared') setActiveLane('private');
  }, [activeLane, mustExitSharedLane, setActiveLane]);

  const viewerParticipantId = privateChannel?.owner_participant_id ?? null;
  const viewerParticipant = roomQuery.data?.participants?.find(
    (participant) => participant.id === viewerParticipantId && participant.is_active,
  );
  const canCreateAnalysisRequest = viewerParticipant?.role_in_room === 'roleA';
  const analysisConsent = useChatAnalysisConsent({
    canCreateAnalysisRequest,
    enabled: mounted && identityQueriesEnabled && hasActor,
    messages,
    roomId,
    sharedChannelId: sharedChannel?.id ?? null,
    viewerParticipantId,
  });

  const errorMessage = roomQuery.error
    ? normalizeM3Error(roomQuery.error).message
    : messagesQuery.error
      ? normalizeM3Error(messagesQuery.error).message
      : channelsQuery.error
        ? normalizeM3Error(channelsQuery.error).message
          : contextPreferenceQuery.error
          ? normalizeM3Error(contextPreferenceQuery.error).message
          : analysisConsent.capsulesError
            ? normalizeM3Error(analysisConsent.capsulesError).message
          : analysisConsent.requestsError
            ? normalizeM3Error(analysisConsent.requestsError).message
      : judgmentStatusQuery.error
        ? normalizeM3Error(judgmentStatusQuery.error).message
        : sendMessageMutation.error
          ? normalizeM3Error(sendMessageMutation.error).message
          : createInviteMutation.error
            ? normalizeM3Error(createInviteMutation.error).message
            : analysisConsent.createMutation.error
              ? normalizeM3Error(analysisConsent.createMutation.error).message
            : analysisConsent.decideMutation.error
              ? normalizeM3Error(analysisConsent.decideMutation.error).message
            : analysisConsent.submitMutation.error
              ? normalizeM3Error(analysisConsent.submitMutation.error).message
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

      {trustCheckpointRequired ? (
        <Panel title={t('chatRoom.trust.title')}>
          <FeatureRow title={t('chatRoom.trust.shared.title')} detail={t('chatRoom.trust.shared.detail')} tone="teal" />
          <FeatureRow title={t('chatRoom.trust.private.title')} detail={t('chatRoom.trust.private.detail')} tone="blue" />
          <FeatureRow title={t('chatRoom.trust.formal.title')} detail={t('chatRoom.trust.formal.detail')} tone="amber" />
          <FeatureRow title={t('chatRoom.trust.choice.title')} detail={t('chatRoom.trust.choice.detail')} tone="neutral" />
          <ActionButton
            label={t('chatRoom.trust.accept')}
            loading={adaptationConsentMutation.isPending}
            onPress={() => adaptationConsentMutation.mutate('accepted')}
            testID="chat.room.trust.accepted"
            tone="teal"
          />
          <ActionButton
            label={t('chatRoom.trust.decline')}
            disabled={adaptationConsentMutation.isPending}
            onPress={() => adaptationConsentMutation.mutate('declined')}
            testID="chat.room.trust.declined"
            tone="neutral"
            variant="outline"
          />
          {adaptationConsentMutation.error ? (
            <FeatureRow
              title={t('chatRoom.contextPreference.saveError')}
              detail={t('chatRoom.contextPreference.saveError.detail')}
              tone="coral"
            />
          ) : null}
        </Panel>
      ) : null}

      <Panel title={t('chatRoom.lane.panel')}>
        <ChatConversationLaneSelector
          activeLane={activeLane}
          sharedAvailable={sharedAvailable}
          sharedBlockedByTrust={sharedGovernanceBlocked}
          sharedReadOnly={!hasActiveRoleB && hasSharedMessages}
          onLaneChange={setActiveLane}
        />
        {activeLane === 'shared' ? (
          <ChatSharedSafetyStatusNotice state={sharedSafety} />
        ) : null}
        {activeLane === 'private' ? (
          <>
            <FeatureRow
              title={t('chatRoom.contextPreference.title')}
              detail={t('chatRoom.contextPreference.detail')}
              tone="blue"
            />
            {contextPreferenceQuery.isError ? (
              <>
                <FeatureRow
                  title={t('chatRoom.contextPreference.loadError')}
                  detail={t('chatRoom.contextPreference.loadError.detail')}
                  tone="coral"
                />
                <ActionButton
                  label={t('appError.retry')}
                  loading={contextPreferenceQuery.isFetching}
                  onPress={() => { void contextPreferenceQuery.refetch(); }}
                  testID="chat.room.context-preference.retry"
                  tone="blue"
                  variant="outline"
                />
              </>
            ) : contextPreferenceQuery.data ? (
              <>
                <ActionButton
                  label={t('chatRoom.contextPreference.privateOnly')}
                  disabled={contextPreferenceQuery.data.mode === 'private_only'}
                  loading={contextPreferenceMutation.isPending}
                  onPress={() => contextPreferenceMutation.mutate('private_only')}
                  selected={contextPreferenceQuery.data.mode === 'private_only'}
                  testID="chat.room.context-preference.private-only"
                  tone="blue"
                  variant={contextPreferenceQuery.data.mode === 'private_only' ? 'filled' : 'outline'}
                />
                <ActionButton
                  label={t('chatRoom.contextPreference.processControls')}
                  disabled={contextPreferenceQuery.data.mode === 'shared_process_controls'}
                  loading={contextPreferenceMutation.isPending}
                  onPress={() => contextPreferenceMutation.mutate('shared_process_controls')}
                  selected={contextPreferenceQuery.data.mode === 'shared_process_controls'}
                  testID="chat.room.context-preference.process-controls"
                  tone="teal"
                  variant={contextPreferenceQuery.data.mode === 'shared_process_controls' ? 'filled' : 'outline'}
                />
              </>
            ) : null}
            {contextPreferenceMutation.error ? (
              <FeatureRow
                title={t('chatRoom.contextPreference.saveError')}
                detail={t('chatRoom.contextPreference.saveError.detail')}
                tone="coral"
              />
            ) : null}
          </>
        ) : (
          <>
            <FeatureRow
              title={t('chatRoom.contextPreference.sharedBoundaryTitle')}
              detail={t('chatRoom.contextPreference.sharedBoundaryDetail')}
              tone="teal"
            />
            {(contextPreferenceQuery.data?.room_adaptation?.active_participant_count ?? 0) >= 2 ? (
              <>
                <FeatureRow
                  title={contextPreferenceQuery.data?.room_adaptation?.enabled
                    ? t('chatRoom.contextPreference.adaptationActive')
                    : t('chatRoom.contextPreference.universalBaseline')}
                  detail={t('chatRoom.contextPreference.adaptationProgress', {
                    accepted: contextPreferenceQuery.data?.room_adaptation?.accepted_participant_count ?? 0,
                    total: contextPreferenceQuery.data?.room_adaptation?.active_participant_count ?? 0,
                  })}
                  tone={contextPreferenceQuery.data?.room_adaptation?.enabled ? 'teal' : 'amber'}
                />
                <ActionButton
                  label={t('chatRoom.contextPreference.acceptAdaptation')}
                  disabled={contextPreferenceQuery.data?.adaptation_decision === 'accepted'}
                  loading={adaptationConsentMutation.isPending}
                  onPress={() => adaptationConsentMutation.mutate('accepted')}
                  selected={contextPreferenceQuery.data?.adaptation_decision === 'accepted'}
                  testID="chat.room.adaptation-consent.accepted"
                  tone="teal"
                  variant={contextPreferenceQuery.data?.adaptation_decision === 'accepted' ? 'filled' : 'outline'}
                />
                <ActionButton
                  label={t('chatRoom.contextPreference.declineAdaptation')}
                  disabled={contextPreferenceQuery.data?.adaptation_decision === 'declined'}
                  loading={adaptationConsentMutation.isPending}
                  onPress={() => adaptationConsentMutation.mutate('declined')}
                  selected={contextPreferenceQuery.data?.adaptation_decision === 'declined'}
                  testID="chat.room.adaptation-consent.declined"
                  tone="neutral"
                  variant={contextPreferenceQuery.data?.adaptation_decision === 'declined' ? 'filled' : 'outline'}
                />
                {adaptationConsentMutation.error ? (
                  <FeatureRow
                    title={t('chatRoom.contextPreference.saveError')}
                    detail={t('chatRoom.contextPreference.saveError.detail')}
                    tone="coral"
                  />
                ) : null}
              </>
            ) : null}
          </>
        )}
      </Panel>

      <Panel title={activeLane === 'private' ? t('chatRoom.lane.private') : t('chatRoom.lane.shared')}>
        {laneMessages.length ? (
          laneMessages.map((message) => {
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
          <Text style={styles.emptyText}>{t(activeLane === 'private' ? 'chatRoom.lane.privateEmpty' : 'chatRoom.lane.sharedEmpty')}</Text>
        )}
      </Panel>

      {activeLane === 'private' && privateChannel?.id ? (
        <>
          <ChatContextCapsuleComposer
            messages={messages}
            privateChannelId={privateChannel.id}
            roomId={roomId}
          />
          {viewerParticipantId ? (
            <ChatSharedContextManager
              capsules={analysisConsent.allCapsules}
              formalActionsBlocked={formalActionsBlocked}
              roomId={roomId}
              viewerParticipantId={viewerParticipantId}
            />
          ) : null}
          <ChatContextUsageReceipts
            enabled={identityQueriesEnabled && hasActor}
            roomId={roomId}
          />
        </>
      ) : null}

      <Panel title={t('chatRoom.composePanel')}>
        <TextInput
          accessibilityLabel={t('chatRoom.compose.label')}
          accessibilityState={{
            disabled: activeLane === 'shared' && (
              sharedSafety.blocked || sharedGovernanceBlocked
            ),
          }}
          accessibilityHint={t(activeLane === 'private'
            ? 'chatRoom.lane.privateAudience'
            : sharedGovernanceBlocked
              ? 'chatRoom.lane.sharedTrustRequired'
              : sharedSafety.blocked
              ? 'chatRoom.safety.sharedComposerBlocked'
              : 'chatRoom.lane.sharedAudience')}
          editable={activeLane === 'private' || (
            !sharedSafety.blocked && !sharedGovernanceBlocked
          )}
          multiline
          onChangeText={setCompose}
          placeholder={t(activeLane === 'private'
            ? 'chatRoom.lane.privatePlaceholder'
            : sharedGovernanceBlocked
              ? 'chatRoom.lane.sharedTrustRequired'
              : sharedSafety.blocked
              ? 'chatRoom.safety.sharedComposerBlocked'
              : 'chatRoom.lane.sharedPlaceholder')}
          placeholderTextColor={palette.muted}
          style={styles.textArea}
          testID="chat.room.compose.input"
          textAlignVertical="top"
          value={compose}
        />
        <FeatureRow
          title={t('chatRoom.lane.audience')}
          detail={t(activeLane === 'private' ? 'chatRoom.lane.privateAudience' : 'chatRoom.lane.sharedAudience')}
          tone={activeLane === 'private' ? 'blue' : 'teal'}
        />
        <ActionButton
          disabled={
            !activeChannel?.id
            || compose.trim().length < 2
            || sendMessageMutation.isPending
            || (activeLane === 'shared' && (
              !hasActiveRoleB || sharedSafety.blocked || sharedGovernanceBlocked
            ))
          }
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

      <ChatAnalysisConsentPanel
        activeRequest={analysisConsent.activeRequest}
        allParticipantsApproved={analysisConsent.allParticipantsApproved}
        analysisStatusLabel={judgmentStatusQuery.data?.roomStatus || roomQuery.data?.status
          ? labelRoomStatus(judgmentStatusQuery.data?.roomStatus ?? roomQuery.data?.status)
          : t('chatRoom.analysisNotRequested')}
        approvalRecoveryPending={analysisConsent.approvalRecoveryPending}
        approvedParticipantCount={analysisConsent.approvedParticipantCount}
        canCreateAnalysisRequest={canCreateAnalysisRequest}
        createPending={analysisConsent.createMutation.isPending}
        decidePending={analysisConsent.decideMutation.isPending}
        eligibleMessages={analysisConsent.eligibleMessages}
        formalCapsules={analysisConsent.formalCapsules}
        onCloseSelectionReview={analysisConsent.closeSelectionReview}
        onCreateReviewedSelection={(selection) => analysisConsent.createMutation.mutate(selection)}
        onDecision={analysisConsent.decideRequest}
        onOpenSelectionReview={analysisConsent.openSelectionReview}
        onRevokeApproval={analysisConsent.revokeApproval}
        onSubmit={analysisConsent.submitRequest}
        onToggleCapsule={analysisConsent.toggleCapsule}
        onToggleMessage={analysisConsent.toggleMessage}
        selectedCapsuleIds={analysisConsent.selectedCapsuleIds}
        selectedMessageIds={analysisConsent.selectedMessageIds}
        sharedSafety={sharedSafety}
        formalActionsBlocked={formalActionsBlocked}
        selectionReview={analysisConsent.selectionReview}
        sourceSetComplete={analysisConsent.sourceSetComplete}
        revokeError={Boolean(analysisConsent.revokeApprovalMutation.error)}
        revokePending={analysisConsent.revokeApprovalMutation.isPending}
        submitPending={analysisConsent.submitMutation.isPending}
        viewerApproval={analysisConsent.viewerApproval}
        viewerIsRequester={analysisConsent.viewerIsRequester}
        workingRequestId={analysisConsent.workingRequestId}
      />

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
