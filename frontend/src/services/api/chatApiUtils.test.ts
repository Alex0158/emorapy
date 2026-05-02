import { beforeEach, describe, expect, it, vi } from 'vitest';
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
} from './chatApiUtils';

describe('chat API utils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('聊天室與邀請路徑應統一路徑參數 encode', () => {
    expect(chatRoomPath('room/a', '/messages')).toBe('/chat/rooms/room%2Fa/messages');
    expect(chatInvitePath('CODE/01', '/accept')).toBe('/chat/invites/CODE%2F01/accept');
  });

  it('ensureChatApiData 與 unwrapChatApiData 應拒絕 nullish data', () => {
    expect(ensureChatApiData({ id: 'r1' }, 'invalid')).toEqual({ id: 'r1' });
    expect(() => ensureChatApiData(null, 'invalid')).toThrow('invalid');
    expect(unwrapChatApiData({ data: { success: true, data: { id: 'r1' } } }, 'invalid')).toEqual({ id: 'r1' });
    expect(() => unwrapChatApiData({ data: { success: true, data: null as never } }, 'invalid')).toThrow('invalid');
  });

  it('list messages response 應正規化 messages 與 nextCursor', () => {
    expect(normalizeListMessagesResponse({
      messages: [{ id: 'm1' } as never],
      nextCursor: undefined as never,
    })).toEqual({
      messages: [{ id: 'm1' }],
      nextCursor: null,
    });
    expect(normalizeListMessagesResponse({
      messages: { items: [] } as never,
      nextCursor: 'cursor-1',
    })).toEqual({
      messages: [],
      nextCursor: 'cursor-1',
    });
  });

  it('判決請求使用專用長 timeout', () => {
    expect(getChatJudgmentRequestConfig()).toEqual({ timeout: 180000 });
  });

  it('readChatStreamToken 應優先 localStorage，其次 sessionStorage，storage 失敗時返回 null', () => {
    sessionStorage.setItem('token', 'session-token');
    expect(readChatStreamToken()).toBe('session-token');

    localStorage.setItem('token', 'local-token');
    expect(readChatStreamToken()).toBe('local-token');

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage unavailable');
      },
    });
    expect(readChatStreamToken()).toBeNull();
  });

  it('buildChatStreamHeaders 應只在有 token/sessionId 時附加對應 header', () => {
    expect(buildChatStreamHeaders({ token: null, sessionId: null, locale: 'zh-TW' })).toEqual({
      Accept: 'text/event-stream',
      'X-Locale': 'zh-TW',
    });
    expect(buildChatStreamHeaders({ token: 'token-1', sessionId: 'session-1', locale: 'en-US' })).toEqual({
      Accept: 'text/event-stream',
      'X-Locale': 'en-US',
      Authorization: 'Bearer token-1',
      'X-Session-Id': 'session-1',
    });
  });

  it('readChatStreamHttpError 應優先使用後端 error body，json 失敗時回退 HTTP 狀態', async () => {
    await expect(readChatStreamHttpError({
      status: 403,
      json: () => Promise.resolve({ error: { code: 'FORBIDDEN', message: '無權限' } }),
    })).resolves.toEqual({ code: 'FORBIDDEN', message: '無權限', status: 403 });

    await expect(readChatStreamHttpError({
      status: 500,
      json: () => Promise.reject(new Error('invalid json')),
    })).resolves.toEqual({ code: 'HTTP_500', message: 'HTTP 500', status: 500 });
  });

  it('parseChatStreamEventChunk 應忽略非 JSON chunk，並用 event line 覆蓋 payload type', () => {
    expect(parseChatStreamEventChunk('event: ping\ndata: not-json')).toBeNull();
    expect(parseChatStreamEventChunk('data: {"roomId":"r1"}')).toBeNull();
    expect(parseChatStreamEventChunk('event: message.created\ndata: {"type":"raw","roomId":"r1"}')).toEqual({
      type: 'message.created',
      roomId: 'r1',
    });
  });
});
