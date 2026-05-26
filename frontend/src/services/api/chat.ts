import { createM3ApiClient } from '@cj/api-client';
import request from '../request';
import { env } from '@/config/env';
import { sessionStorage } from '@/utils/storage';
import { getLocale } from '@/utils/i18n';
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
  ChatJudgmentResult,
  ChatJudgmentStatus,
  ChatMessage,
  ChatRoom,
  ChatHistoryVisibilityMode,
  ChatStreamEvent,
} from '@/types/chat';

const sharedChatApi = createM3ApiClient(request).chat;

export const createChatRoom = async (
  historyVisibilityMode: ChatHistoryVisibilityMode = 'share_summary_only'
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

export const sendChatMessage = async (
  roomId: string,
  payload: { content: string; visibility_scope?: 'all' | 'owner_only' | 'summary_only'; reply_to_message_id?: string }
): Promise<ChatMessage> => {
  return sharedChatApi.sendMessage(roomId, payload) as Promise<ChatMessage>;
};

export const requestChatJudgment = async (
  roomId: string,
  payload?: { included_message_ids?: string[] }
): Promise<ChatJudgmentResult> => {
  return sharedChatApi.requestJudgment(roomId, payload ?? {}) as Promise<ChatJudgmentResult>;
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

export const connectChatStream = async (
  roomId: string,
  callbacks: ChatStreamCallbacks
): Promise<() => void> => {
  const controller = new AbortController();
  const token = readChatStreamToken();
  const sessionId = sessionStorage.get();
  const response = await fetch(`${env.apiBaseURL}${chatRoomPath(roomId, '/stream')}`, {
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
    callbacks.onError?.({ code: 'STREAM_BODY_MISSING', message: 'No stream body found' });
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
        callbacks.onError?.({ code: 'STREAM_DISCONNECTED', message: 'SSE disconnected unexpectedly' });
      }
    }
  };

  void run();
  return () => controller.abort();
};
