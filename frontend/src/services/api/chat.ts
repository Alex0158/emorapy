import request from '../request';
import type { ApiResponse } from '@/types/common';
import { env } from '@/config/env';
import { sessionStorage } from '@/utils/storage';
import { getLocale } from '@/utils/i18n';
import {
  buildChatStreamHeaders,
  chatInvitePath,
  chatRoomPath,
  ensureChatApiData,
  getChatJudgmentRequestConfig,
  normalizeListMessagesResponse,
  parseChatStreamEventChunk,
  readChatStreamHttpError,
  readChatStreamToken,
  unwrapChatApiData,
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

export const createChatRoom = async (
  historyVisibilityMode: ChatHistoryVisibilityMode = 'share_summary_only'
): Promise<ChatRoom> => {
  const response = await request.post<ApiResponse<{ room: ChatRoom }>>('/chat/rooms', {
    history_visibility_mode: historyVisibilityMode,
  });
  return ensureChatApiData(
    unwrapChatApiData(response, 'Invalid chat room response from server').room,
    'Invalid chat room response from server'
  );
};

export const getChatRoom = async (roomId: string): Promise<ChatRoom> => {
  const response = await request.get<ApiResponse<{ room: ChatRoom }>>(chatRoomPath(roomId));
  return ensureChatApiData(
    unwrapChatApiData(response, 'Invalid chat room response from server').room,
    'Invalid chat room response from server'
  );
};

export const createChatInvite = async (
  roomId: string,
  payload?: { history_visibility_mode?: ChatHistoryVisibilityMode; expires_in_hours?: number }
): Promise<ChatInvite> => {
  const response = await request.post<ApiResponse<{ invite: ChatInvite }>>(
    chatRoomPath(roomId, '/invites'),
    payload ?? {}
  );
  return ensureChatApiData(
    unwrapChatApiData(response, 'Invalid chat invite response from server').invite,
    'Invalid chat invite response from server'
  );
};

export const acceptChatInvite = async (inviteCode: string): Promise<ChatRoom> => {
  const response = await request.post<ApiResponse<{ room: ChatRoom }>>(
    chatInvitePath(inviteCode, '/accept')
  );
  return ensureChatApiData(
    unwrapChatApiData(response, 'Invalid accept invite response from server').room,
    'Invalid accept invite response from server'
  );
};

export const declineChatInvite = async (inviteCode: string): Promise<ChatInvite> => {
  const response = await request.post<ApiResponse<{ invite: ChatInvite }>>(
    chatInvitePath(inviteCode, '/decline')
  );
  return ensureChatApiData(
    unwrapChatApiData(response, 'Invalid decline invite response from server').invite,
    'Invalid decline invite response from server'
  );
};

export const listChatMessages = async (
  roomId: string,
  params?: { cursor?: string; limit?: number }
): Promise<ListMessagesResponse> => {
  const response = await request.get<ApiResponse<ListMessagesResponse>>(
    chatRoomPath(roomId, '/messages'),
    {
      params,
    }
  );
  const result = unwrapChatApiData(
    response,
    'Invalid chat messages response from server'
  );
  return normalizeListMessagesResponse(result);
};

export const sendChatMessage = async (
  roomId: string,
  payload: { content: string; visibility_scope?: 'all' | 'owner_only' | 'summary_only'; reply_to_message_id?: string }
): Promise<ChatMessage> => {
  const response = await request.post<ApiResponse<{ message: ChatMessage }>>(
    chatRoomPath(roomId, '/messages'),
    payload
  );
  return ensureChatApiData(
    unwrapChatApiData(response, 'Invalid send message response from server').message,
    'Invalid send message response from server'
  );
};

export const requestChatJudgment = async (
  roomId: string,
  payload?: { included_message_ids?: string[] }
): Promise<ChatJudgmentResult> => {
  const response = await request.post<ApiResponse<ChatJudgmentResult>>(
    chatRoomPath(roomId, '/request-judgment'),
    payload ?? {},
    getChatJudgmentRequestConfig()
  );
  return unwrapChatApiData(response, 'Invalid judgment request response from server');
};

export const getChatJudgmentStatus = async (roomId: string): Promise<ChatJudgmentStatus> => {
  const response = await request.get<ApiResponse<ChatJudgmentStatus>>(
    chatRoomPath(roomId, '/judgment-status')
  );
  return unwrapChatApiData(response, 'Invalid judgment status response from server');
};

export const leaveChatRoom = async (roomId: string): Promise<ChatRoom> => {
  const response = await request.post<ApiResponse<{ room: ChatRoom }>>(
    chatRoomPath(roomId, '/leave')
  );
  return ensureChatApiData(unwrapChatApiData(response, 'Invalid leave room response').room, 'Invalid leave room response');
};

export const kickChatParticipantB = async (roomId: string): Promise<ChatRoom> => {
  const response = await request.post<ApiResponse<{ room: ChatRoom }>>(
    chatRoomPath(roomId, '/kick-b')
  );
  return ensureChatApiData(unwrapChatApiData(response, 'Invalid kick response').room, 'Invalid kick response');
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
