import request from '../request';
import type { ApiResponse } from '@/types/common';
import { env } from '@/config/env';
import { sessionStorage } from '@/utils/storage';
import { getLocale } from '@/utils/i18n';
import type {
  ChatInvite,
  ChatJudgmentResult,
  ChatJudgmentStatus,
  ChatMessage,
  ChatRoom,
  ChatHistoryVisibilityMode,
  ChatStreamEvent,
} from '@/types/chat';

interface ListMessagesResponse {
  messages: ChatMessage[];
  nextCursor: string | null;
}

const ensureData = <T>(value: T | undefined | null, errorMessage: string): T => {
  if (value === undefined || value === null) {
    throw new Error(errorMessage);
  }
  return value;
};

export const createChatRoom = async (
  historyVisibilityMode: ChatHistoryVisibilityMode = 'share_summary_only'
): Promise<ChatRoom> => {
  const response = await request.post<ApiResponse<{ room: ChatRoom }>>('/chat/rooms', {
    history_visibility_mode: historyVisibilityMode,
  });
  return ensureData(
    (response.data as ApiResponse<{ room: ChatRoom }>)?.data?.room,
    'Invalid chat room response from server'
  );
};

export const getChatRoom = async (roomId: string): Promise<ChatRoom> => {
  const response = await request.get<ApiResponse<{ room: ChatRoom }>>(`/chat/rooms/${encodeURIComponent(roomId)}`);
  return ensureData(
    (response.data as ApiResponse<{ room: ChatRoom }>)?.data?.room,
    'Invalid chat room response from server'
  );
};

export const createChatInvite = async (
  roomId: string,
  payload?: { history_visibility_mode?: ChatHistoryVisibilityMode; expires_in_hours?: number }
): Promise<ChatInvite> => {
  const response = await request.post<ApiResponse<{ invite: ChatInvite }>>(
    `/chat/rooms/${encodeURIComponent(roomId)}/invites`,
    payload ?? {}
  );
  return ensureData(
    (response.data as ApiResponse<{ invite: ChatInvite }>)?.data?.invite,
    'Invalid chat invite response from server'
  );
};

export const acceptChatInvite = async (inviteCode: string): Promise<ChatRoom> => {
  const response = await request.post<ApiResponse<{ room: ChatRoom }>>(
    `/chat/invites/${encodeURIComponent(inviteCode)}/accept`
  );
  return ensureData(
    (response.data as ApiResponse<{ room: ChatRoom }>)?.data?.room,
    'Invalid accept invite response from server'
  );
};

export const declineChatInvite = async (inviteCode: string): Promise<ChatInvite> => {
  const response = await request.post<ApiResponse<{ invite: ChatInvite }>>(
    `/chat/invites/${encodeURIComponent(inviteCode)}/decline`
  );
  return ensureData(
    (response.data as ApiResponse<{ invite: ChatInvite }>)?.data?.invite,
    'Invalid decline invite response from server'
  );
};

export const listChatMessages = async (
  roomId: string,
  params?: { cursor?: string; limit?: number }
): Promise<ListMessagesResponse> => {
  const response = await request.get<ApiResponse<ListMessagesResponse>>(
    `/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    {
    params,
    }
  );
  const result = ensureData(
    (response.data as ApiResponse<ListMessagesResponse>)?.data,
    'Invalid chat messages response from server'
  );
  const messages = result.messages;
  return {
    messages: Array.isArray(messages) ? messages : [],
    nextCursor: result.nextCursor ?? null,
  };
};

export const sendChatMessage = async (
  roomId: string,
  payload: { content: string; visibility_scope?: 'all' | 'owner_only' | 'summary_only'; reply_to_message_id?: string }
): Promise<ChatMessage> => {
  const response = await request.post<ApiResponse<{ message: ChatMessage }>>(
    `/chat/rooms/${encodeURIComponent(roomId)}/messages`,
    payload
  );
  return ensureData(
    (response.data as ApiResponse<{ message: ChatMessage }>)?.data?.message,
    'Invalid send message response from server'
  );
};

export const requestChatJudgment = async (
  roomId: string,
  payload?: { included_message_ids?: string[] }
): Promise<ChatJudgmentResult> => {
  const response = await request.post<ApiResponse<ChatJudgmentResult>>(
    `/chat/rooms/${encodeURIComponent(roomId)}/request-judgment`,
    payload ?? {}
  );
  return ensureData(
    (response.data as ApiResponse<ChatJudgmentResult>)?.data,
    'Invalid judgment request response from server'
  );
};

export const getChatJudgmentStatus = async (roomId: string): Promise<ChatJudgmentStatus> => {
  const response = await request.get<ApiResponse<ChatJudgmentStatus>>(
    `/chat/rooms/${encodeURIComponent(roomId)}/judgment-status`
  );
  return ensureData(
    (response.data as ApiResponse<ChatJudgmentStatus>)?.data,
    'Invalid judgment status response from server'
  );
};

export const leaveChatRoom = async (roomId: string): Promise<ChatRoom> => {
  const response = await request.post<ApiResponse<{ room: ChatRoom }>>(
    `/chat/rooms/${encodeURIComponent(roomId)}/leave`
  );
  return ensureData((response.data as ApiResponse<{ room: ChatRoom }>)?.data?.room, 'Invalid leave room response');
};

export const kickChatParticipantB = async (roomId: string): Promise<ChatRoom> => {
  const response = await request.post<ApiResponse<{ room: ChatRoom }>>(
    `/chat/rooms/${encodeURIComponent(roomId)}/kick-b`
  );
  return ensureData((response.data as ApiResponse<{ room: ChatRoom }>)?.data?.room, 'Invalid kick response');
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
  let token: string | null = null;
  try {
    token = localStorage.getItem('token') || globalThis.sessionStorage?.getItem('token') || null;
  } catch {
    token = null;
  }

  const sessionId = sessionStorage.get();
  const response = await fetch(`${env.apiBaseURL}/chat/rooms/${encodeURIComponent(roomId)}/stream`, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      'X-Locale': getLocale(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
    },
    signal: controller.signal,
  });

  if (!response.ok) {
    let code = `HTTP_${response.status}`;
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { error?: { code?: string; message?: string } };
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.message) message = body.error.message;
    } catch {
      // keep fallback
    }
    callbacks.onError?.({ code, message, status: response.status });
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
          const lines = chunk.split('\n');
          const eventLine = lines.find((line) => line.startsWith('event:'));
          const dataLine = lines.find((line) => line.startsWith('data:'));
          if (!eventLine || !dataLine) return;
          try {
            const payload = JSON.parse(dataLine.replace(/^data:\s*/, '')) as ChatStreamEvent;
            callbacks.onEvent?.({
              ...payload,
              type: (eventLine.replace(/^event:\s*/, '').trim() || payload.type) as ChatStreamEvent['type'],
            });
          } catch {
            // ignore parse errors for non-JSON ping lines
          }
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
