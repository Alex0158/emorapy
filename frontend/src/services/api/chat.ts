import { createM3ApiClient } from '@emorapy/api-client';
import request from '../request';
import { env } from '@/config/env';
import { sessionStorage } from '@/utils/storage';
import { getLocale } from '@/utils/i18n';
import {
  getStreamBodyMissingMessage,
  getStreamDisconnectedMessage,
} from '../streamErrorMessages';
import {
  buildChatStreamHeaders,
  chatRoomPath,
  parseChatStreamEventChunk,
  readChatStreamHttpError,
  readChatStreamToken,
  type ListMessagesResponse,
} from './chatApiUtils';
import type {
  ChatInvite,
  ChatChannel,
  ChatJudgmentResult,
  ChatJudgmentStatus,
  ChatMessage,
  ChatRoom,
  ChatHistoryVisibilityMode,
  ChatStreamEvent,
  PrivateContextPreference,
  PrivateContextUseMode,
  ChatAnalysisParticipantApproval,
  ChatAnalysisRequest,
  ChatAnalysisRequestListItem,
  ContextAuthorization,
  ContextCapsule,
  ContextCapsuleListItem,
} from '@/types/chat';

const sharedChatApi = createM3ApiClient(request).chat;

export const createChatRoom = async (
  historyVisibilityMode: ChatHistoryVisibilityMode = 'share_from_join_time'
): Promise<ChatRoom> => {
  return sharedChatApi.createRoom(historyVisibilityMode) as Promise<ChatRoom>;
};

export const getChatRoom = async (roomId: string): Promise<ChatRoom> => {
  return sharedChatApi.getRoom(roomId) as Promise<ChatRoom>;
};

export const createChatInvite = async (
  roomId: string,
  payload?: { history_visibility_mode?: ChatHistoryVisibilityMode; expires_in_hours?: number }
): Promise<ChatInvite> => {
  return sharedChatApi.createInvite(roomId, payload ?? {}) as Promise<ChatInvite>;
};

export const acceptChatInvite = async (inviteCode: string): Promise<ChatRoom> => {
  return sharedChatApi.acceptInvite(inviteCode) as Promise<ChatRoom>;
};

export const declineChatInvite = async (inviteCode: string): Promise<ChatInvite> => {
  return sharedChatApi.declineInvite(inviteCode) as Promise<ChatInvite>;
};

export const listChatMessages = async (
  roomId: string,
  params?: { cursor?: string; limit?: number }
): Promise<ListMessagesResponse> => {
  return sharedChatApi.listMessages(roomId, params ?? {}) as Promise<ListMessagesResponse>;
};

export const listChatChannels = async (roomId: string): Promise<ChatChannel[]> => {
  return sharedChatApi.listChannels(roomId) as Promise<ChatChannel[]>;
};

export const listChatChannelMessages = async (
  channelId: string,
  params?: { cursor?: string; limit?: number }
): Promise<ListMessagesResponse> => {
  return sharedChatApi.listChannelMessages(channelId, params ?? {}) as Promise<ListMessagesResponse>;
};

export const getPrivateContextPreference = async (
  roomId: string
): Promise<PrivateContextPreference> => {
  return sharedChatApi.getPrivateContextPreference(roomId) as Promise<PrivateContextPreference>;
};

export const updatePrivateContextPreference = async (
  roomId: string,
  mode: PrivateContextUseMode
): Promise<PrivateContextPreference> => {
  return sharedChatApi.updatePrivateContextPreference(roomId, { mode }) as Promise<PrivateContextPreference>;
};

export const sendChatMessage = async (
  roomId: string,
  payload: { content: string; visibility_scope?: 'all' | 'owner_only' | 'summary_only'; reply_to_message_id?: string }
): Promise<ChatMessage> => {
  return sharedChatApi.sendMessage(roomId, payload) as Promise<ChatMessage>;
};

export const sendChatChannelMessage = async (
  channelId: string,
  payload: { content: string; reply_to_message_id?: string }
): Promise<ChatMessage> => {
  return sharedChatApi.sendChannelMessage(channelId, payload) as Promise<ChatMessage>;
};

export const requestChatJudgment = async (
  roomId: string,
  payload: { analysis_request_id: string }
): Promise<ChatJudgmentResult> => {
  return sharedChatApi.requestJudgment(roomId, payload) as Promise<ChatJudgmentResult>;
};

export const createChatContextCapsule = async (
  roomId: string,
  payload: {
    source_channel_id: string;
    source_message_ids: string[];
    summary: string;
    expires_at?: string | null;
  }
): Promise<ContextCapsule> => {
  return sharedChatApi.createContextCapsule(roomId, payload) as Promise<ContextCapsule>;
};

export const listChatContextCapsules = async (
  roomId: string
): Promise<ContextCapsuleListItem[]> => {
  return sharedChatApi.listContextCapsules(roomId) as Promise<ContextCapsuleListItem[]>;
};

export const grantChatContextAuthorization = async (
  roomId: string,
  capsuleId: string,
  payload: {
    capsule_content_hash: string;
    purpose: 'shared_mediation' | 'formal_analysis_evidence';
    audience: 'room_participants' | 'analysis_participants';
    target_type: 'chat_room';
    target_id: string;
    policy_version: string;
    expires_at?: string | null;
  }
): Promise<ContextAuthorization> => {
  return sharedChatApi.grantContextAuthorization(
    roomId,
    capsuleId,
    payload,
  ) as Promise<ContextAuthorization>;
};

export const revokeChatContextAuthorization = async (
  roomId: string,
  authorizationId: string
): Promise<ContextAuthorization> => {
  return sharedChatApi.revokeContextAuthorization(
    roomId,
    authorizationId,
    { reason_code: 'user_revoked' },
  ) as Promise<ContextAuthorization>;
};

export const createChatAnalysisRequest = async (
  roomId: string,
  selectedMessageIds: string[],
  selectedCapsuleIds: string[] = []
): Promise<ChatAnalysisRequest> => {
  return sharedChatApi.createAnalysisRequest(roomId, {
    selected_message_ids: selectedMessageIds,
    selected_capsule_ids: selectedCapsuleIds,
  }) as Promise<ChatAnalysisRequest>;
};

export const listChatAnalysisRequests = async (
  roomId: string
): Promise<ChatAnalysisRequestListItem[]> => {
  return sharedChatApi.listAnalysisRequests(roomId) as Promise<ChatAnalysisRequestListItem[]>;
};

export const decideChatAnalysisRequest = async (
  roomId: string,
  request: ChatAnalysisRequest,
  decision: 'approved' | 'declined'
): Promise<ChatAnalysisParticipantApproval> => {
  return sharedChatApi.decideAnalysisRequest(roomId, request.id, {
    selection_hash: request.selection_hash,
    policy_version: request.policy_version,
    decision,
  }) as Promise<ChatAnalysisParticipantApproval>;
};

export const submitChatAnalysisRequest = async (
  roomId: string,
  requestId: string
): Promise<ChatAnalysisRequest> => {
  return sharedChatApi.submitAnalysisRequest(roomId, requestId) as Promise<ChatAnalysisRequest>;
};

export const revokeChatAnalysisApproval = async (
  roomId: string,
  request: ChatAnalysisRequest
): Promise<ChatAnalysisParticipantApproval> => {
  return sharedChatApi.revokeAnalysisApproval(roomId, request.id, {
    selection_hash: request.selection_hash,
    policy_version: request.policy_version,
  }) as Promise<ChatAnalysisParticipantApproval>;
};

export const getChatJudgmentStatus = async (roomId: string): Promise<ChatJudgmentStatus> => {
  return sharedChatApi.getJudgmentStatus(roomId) as Promise<ChatJudgmentStatus>;
};

export const leaveChatRoom = async (roomId: string): Promise<ChatRoom> => {
  return sharedChatApi.leaveRoom(roomId) as Promise<ChatRoom>;
};

export const kickChatParticipantB = async (roomId: string): Promise<ChatRoom> => {
  return sharedChatApi.kickParticipantB(roomId) as Promise<ChatRoom>;
};

export interface ChatStreamCallbacks {
  onEvent?: (event: ChatStreamEvent) => void;
  onError?: (error: { code: string; message: string; status?: number }) => void;
  onClose?: () => void;
}

const connectChatEventStream = async (
  path: string,
  callbacks: ChatStreamCallbacks
): Promise<() => void> => {
  const controller = new AbortController();
  const token = readChatStreamToken();
  const sessionId = sessionStorage.get();
  const response = await fetch(`${env.apiBaseURL}${path}`, {
    method: 'GET',
    headers: buildChatStreamHeaders({ token, sessionId, locale: getLocale() }),
    signal: controller.signal,
  });

  if (!response.ok) {
    callbacks.onError?.(await readChatStreamHttpError(response));
    return () => controller.abort();
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.({ code: 'STREAM_BODY_MISSING', message: getStreamBodyMissingMessage() });
    return () => controller.abort();
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const run = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (!controller.signal.aborted) {
            callbacks.onClose?.();
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        chunks.forEach((chunk) => {
          const event = parseChatStreamEventChunk(chunk);
          if (event) callbacks.onEvent?.(event);
        });
      }
    } catch {
      if (!controller.signal.aborted) {
        callbacks.onError?.({ code: 'STREAM_DISCONNECTED', message: getStreamDisconnectedMessage() });
      }
    }
  };

  void run();
  return () => controller.abort();
};

export const connectChatStream = async (
  roomId: string,
  callbacks: ChatStreamCallbacks
): Promise<() => void> => connectChatEventStream(
  chatRoomPath(roomId, '/stream'),
  callbacks
);

export const connectChatChannelStream = async (
  channelId: string,
  callbacks: ChatStreamCallbacks
): Promise<() => void> => connectChatEventStream(
  `/chat/channels/${encodeURIComponent(channelId)}/stream`,
  callbacks
);
