import { API_CONFIG } from '@/config/api';
import { getStreamHttpFallbackMessage } from '../streamErrorMessages';
import type { ApiResponse } from '@/types/common';
import type { ChatMessage, ChatStreamEvent } from '@/types/chat';

export interface ListMessagesResponse {
  messages: ChatMessage[];
  nextCursor: string | null;
}

export const chatRoomPath = (roomId: string, suffix = ''): string =>
  `/chat/rooms/${encodeURIComponent(roomId)}${suffix}`;

export const chatInvitePath = (inviteCode: string, suffix = ''): string =>
  `/chat/invites/${encodeURIComponent(inviteCode)}${suffix}`;

export const ensureChatApiData = <T>(value: T | undefined | null, errorMessage: string): T => {
  if (value === undefined || value === null) {
    throw new Error(errorMessage);
  }
  return value;
};

export function unwrapChatApiData<T>(response: { data?: ApiResponse<T> | null }, errorMessage: string): T {
  return ensureChatApiData((response.data as ApiResponse<T> | undefined)?.data, errorMessage);
}

export function normalizeListMessagesResponse(result: ListMessagesResponse): ListMessagesResponse {
  return {
    messages: Array.isArray(result.messages) ? result.messages : [],
    nextCursor: result.nextCursor ?? null,
  };
}

export function getChatJudgmentRequestConfig(): { timeout: number } {
  return { timeout: API_CONFIG.chat.judgmentRequestTimeout };
}

export function readChatStreamToken(): string | null {
  try {
    return localStorage.getItem('token') || globalThis.sessionStorage?.getItem('token') || null;
  } catch {
    return null;
  }
}

export function buildChatStreamHeaders({
  token,
  sessionId,
  locale,
}: {
  token?: string | null;
  sessionId?: string | null;
  locale: string;
}): Record<string, string> {
  return {
    Accept: 'text/event-stream',
    'X-Locale': locale,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
  };
}

export async function readChatStreamHttpError(
  response: Pick<Response, 'status' | 'json'>
): Promise<{ code: string; message: string; status: number }> {
  let code = `HTTP_${response.status}`;
  let message = getStreamHttpFallbackMessage(response.status);
  try {
    const body = await response.json() as { error?: { code?: string; message?: string } };
    if (body?.error?.code) code = body.error.code;
    if (body?.error?.message) message = body.error.message;
  } catch {
    // keep HTTP fallback
  }
  return { code, message, status: response.status };
}

export function parseChatStreamEventChunk(chunk: string): ChatStreamEvent | null {
  const lines = chunk.split('\n');
  const eventLine = lines.find((line) => line.startsWith('event:'));
  const dataLine = lines.find((line) => line.startsWith('data:'));
  if (!eventLine || !dataLine) return null;

  try {
    const payload = JSON.parse(dataLine.replace(/^data:\s*/, '')) as ChatStreamEvent;
    return {
      ...payload,
      type: (eventLine.replace(/^event:\s*/, '').trim() || payload.type) as ChatStreamEvent['type'],
    };
  } catch {
    return null;
  }
}
