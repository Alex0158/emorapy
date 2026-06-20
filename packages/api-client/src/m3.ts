import type {
  ChatHistoryVisibilityMode,
  ChatInvite,
  ChatJudgmentResult,
  ChatJudgmentStatus,
  ChatMessage,
  ChatRoom,
  ChatVisibilityScope,
} from '@emorapy/contracts/chat';

import {
  isApiResponseEnvelope,
  readApiResponseError,
  toRequestError,
  type ApiResponseEnvelope,
} from './apiResponse.js';
import type { HttpResponse, M1HttpClient } from './m1.js';

export type {
  ChatHistoryVisibilityMode,
  ChatInvite,
  ChatJudgmentResult,
  ChatJudgmentStatus,
  ChatMessage,
  ChatRoom,
  ChatStreamEvent,
  ChatVisibilityScope,
} from '@emorapy/contracts/chat';

export const CHAT_JUDGMENT_REQUEST_TIMEOUT_MS = 180_000;

export interface ListChatMessagesResponse {
  messages: ChatMessage[];
  nextCursor: string | null;
}

export interface CreateChatInviteInput {
  history_visibility_mode?: ChatHistoryVisibilityMode;
  expires_in_hours?: number;
}

export interface SendChatMessageInput {
  content: string;
  visibility_scope?: ChatVisibilityScope;
  reply_to_message_id?: string | null;
}

export interface RequestChatJudgmentInput {
  included_message_ids?: string[];
  participant_consent?: {
    role_b_included_messages?: boolean;
  };
}

export function chatRoomPath(roomId: string, suffix = ''): string {
  return `/chat/rooms/${encodeURIComponent(roomId)}${suffix}`;
}

export function chatInvitePath(inviteCode: string, suffix = ''): string {
  return `/chat/invites/${encodeURIComponent(inviteCode)}${suffix}`;
}

function unwrapResponse<T>(
  response: HttpResponse<ApiResponseEnvelope<T>>,
  fallbackMessage: string
): T {
  const body = response.data;
  if (!isApiResponseEnvelope(body)) {
    return body as T;
  }

  if (body.success) {
    if (body.data !== undefined && body.data !== null) return body.data as T;
    throw toRequestError('EMPTY_RESPONSE', fallbackMessage);
  }

  const bodyError = readApiResponseError(body);
  throw toRequestError(
    bodyError.code ?? 'API_ERROR',
    bodyError.message ?? fallbackMessage,
    bodyError.details
  );
}

function ensureValue<T>(value: T | null | undefined, code: string, message: string): T {
  if (value === undefined || value === null) {
    throw toRequestError(code, message);
  }
  return value;
}

export function normalizeListChatMessagesResponse(
  result: ListChatMessagesResponse
): ListChatMessagesResponse {
  return {
    messages: Array.isArray(result.messages) ? result.messages : [],
    nextCursor: result.nextCursor ?? null,
  };
}

export function createChatApi(http: M1HttpClient) {
  return {
    async createRoom(
      historyVisibilityMode: ChatHistoryVisibilityMode = 'share_summary_only'
    ): Promise<ChatRoom> {
      const response = await http.post<ApiResponseEnvelope<{ room: ChatRoom }>>('/chat/rooms', {
        history_visibility_mode: historyVisibilityMode,
      });
      const data = unwrapResponse(response, 'Invalid chat room response from server');
      return ensureValue(data.room, 'INVALID_CHAT_ROOM_RESPONSE', 'Invalid chat room response from server');
    },

    async getRoom(roomId: string): Promise<ChatRoom> {
      const response = await http.get<ApiResponseEnvelope<{ room: ChatRoom }>>(chatRoomPath(roomId));
      const data = unwrapResponse(response, 'Invalid chat room response from server');
      return ensureValue(data.room, 'INVALID_CHAT_ROOM_RESPONSE', 'Invalid chat room response from server');
    },

    async createInvite(roomId: string, input: CreateChatInviteInput = {}): Promise<ChatInvite> {
      const response = await http.post<ApiResponseEnvelope<{ invite: ChatInvite }>>(
        chatRoomPath(roomId, '/invites'),
        input
      );
      const data = unwrapResponse(response, 'Invalid chat invite response from server');
      return ensureValue(data.invite, 'INVALID_CHAT_INVITE_RESPONSE', 'Invalid chat invite response from server');
    },

    async acceptInvite(inviteCode: string): Promise<ChatRoom> {
      const response = await http.post<ApiResponseEnvelope<{ room: ChatRoom }>>(
        chatInvitePath(inviteCode, '/accept')
      );
      const data = unwrapResponse(response, 'Invalid accept invite response from server');
      return ensureValue(data.room, 'INVALID_ACCEPT_INVITE_RESPONSE', 'Invalid accept invite response from server');
    },

    async declineInvite(inviteCode: string): Promise<ChatInvite> {
      const response = await http.post<ApiResponseEnvelope<{ invite: ChatInvite }>>(
        chatInvitePath(inviteCode, '/decline')
      );
      const data = unwrapResponse(response, 'Invalid decline invite response from server');
      return ensureValue(data.invite, 'INVALID_DECLINE_INVITE_RESPONSE', 'Invalid decline invite response from server');
    },

    async listMessages(
      roomId: string,
      params: { cursor?: string; limit?: number } = {}
    ): Promise<ListChatMessagesResponse> {
      const response = await http.get<ApiResponseEnvelope<ListChatMessagesResponse>>(
        chatRoomPath(roomId, '/messages'),
        { params }
      );
      const data = unwrapResponse(response, 'Invalid chat messages response from server');
      return normalizeListChatMessagesResponse(data);
    },

    async sendMessage(roomId: string, input: SendChatMessageInput): Promise<ChatMessage> {
      const response = await http.post<ApiResponseEnvelope<{ message: ChatMessage }>>(
        chatRoomPath(roomId, '/messages'),
        input
      );
      const data = unwrapResponse(response, 'Invalid send message response from server');
      return ensureValue(data.message, 'INVALID_CHAT_MESSAGE_RESPONSE', 'Invalid send message response from server');
    },

    async requestJudgment(
      roomId: string,
      input: RequestChatJudgmentInput = {}
    ): Promise<ChatJudgmentResult> {
      const response = await http.post<ApiResponseEnvelope<ChatJudgmentResult>>(
        chatRoomPath(roomId, '/request-judgment'),
        input,
        { timeout: CHAT_JUDGMENT_REQUEST_TIMEOUT_MS }
      );
      return unwrapResponse(response, 'Invalid judgment request response from server');
    },

    async getJudgmentStatus(roomId: string): Promise<ChatJudgmentStatus> {
      const response = await http.get<ApiResponseEnvelope<ChatJudgmentStatus>>(
        chatRoomPath(roomId, '/judgment-status')
      );
      return unwrapResponse(response, 'Invalid judgment status response from server');
    },

    async leaveRoom(roomId: string): Promise<ChatRoom> {
      const response = await http.post<ApiResponseEnvelope<{ room: ChatRoom }>>(chatRoomPath(roomId, '/leave'));
      const data = unwrapResponse(response, 'Invalid leave room response from server');
      return ensureValue(data.room, 'INVALID_LEAVE_ROOM_RESPONSE', 'Invalid leave room response from server');
    },

    async kickParticipantB(roomId: string): Promise<ChatRoom> {
      const response = await http.post<ApiResponseEnvelope<{ room: ChatRoom }>>(chatRoomPath(roomId, '/kick-b'));
      const data = unwrapResponse(response, 'Invalid kick response from server');
      return ensureValue(data.room, 'INVALID_KICK_RESPONSE', 'Invalid kick response from server');
    },
  };
}

export function createM3ApiClient(http: M1HttpClient) {
  return {
    chat: createChatApi(http),
  };
}
