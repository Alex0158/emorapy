import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptChatInvite,
  connectChatStream,
  createChatInvite,
  createChatRoom,
  declineChatInvite,
  getChatJudgmentStatus,
  getChatRoom,
  kickChatParticipantB,
  leaveChatRoom,
  listChatMessages,
  requestChatJudgment,
  sendChatMessage,
} from './chat';

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('../request', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createChatRoom 應 POST /chat/rooms', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: { id: 'r1' } } } });
    const result = await createChatRoom();
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms', {
      history_visibility_mode: 'share_summary_only',
    });
    expect(result).toMatchObject({ id: 'r1' });
  });

  it('createChatRoom 回應缺少 room 時應拋錯', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: {} } });
    await expect(createChatRoom()).rejects.toThrow('Invalid chat room response from server');
  });

  it('createChatRoom 後端回傳 room 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: null } } });
    await expect(createChatRoom()).rejects.toThrow('Invalid chat room response from server');
  });

  it('getChatRoom 應 GET /chat/rooms/:id', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { room: { id: 'r2' } } } });
    const result = await getChatRoom('r2');
    expect(mockGet).toHaveBeenCalledWith('/chat/rooms/r2');
    expect(result).toMatchObject({ id: 'r2' });
  });

  it('getChatRoom 後端回傳 room 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { room: null } } });
    await expect(getChatRoom('r2')).rejects.toThrow('Invalid chat room response from server');
  });

  it('createChatInvite 應 POST /chat/rooms/:id/invites', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { invite: { id: 'i1', invite_code: 'ABC123' } } } });
    const result = await createChatInvite('r1', { expires_in_hours: 12 });
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms/r1/invites', { expires_in_hours: 12 });
    expect(result).toMatchObject({ id: 'i1', invite_code: 'ABC123' });
  });

  it('createChatInvite 後端回傳 invite 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { invite: null } } });
    await expect(createChatInvite('r1')).rejects.toThrow('Invalid chat invite response from server');
  });

  it('acceptChatInvite 應 POST /chat/invites/:code/accept', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: { id: 'r3' } } } });
    const result = await acceptChatInvite('CODE01');
    expect(mockPost).toHaveBeenCalledWith('/chat/invites/CODE01/accept');
    expect(result).toMatchObject({ id: 'r3' });
  });

  it('acceptChatInvite 後端回傳 room 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: null } } });
    await expect(acceptChatInvite('CODE01')).rejects.toThrow('Invalid accept invite response from server');
  });

  it('API 路徑參數應做 encodeURIComponent', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { room: { id: 'r/a' } } } });
    await getChatRoom('r/a');
    expect(mockGet).toHaveBeenCalledWith('/chat/rooms/r%2Fa');
  });

  it('declineChatInvite 應 POST /chat/invites/:code/decline', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { invite: { id: 'i2', status: 'declined' } } } });
    const result = await declineChatInvite('CODE02');
    expect(mockPost).toHaveBeenCalledWith('/chat/invites/CODE02/decline');
    expect(result).toMatchObject({ id: 'i2', status: 'declined' });
  });

  it('declineChatInvite 後端回傳 invite 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { invite: null } } });
    await expect(declineChatInvite('CODE02')).rejects.toThrow('Invalid decline invite response from server');
  });

  it('leaveChatRoom 應 POST /chat/rooms/:id/leave 並返回 room', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: { id: 'r1', status: 'left' } } } });
    const result = await leaveChatRoom('r1');
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms/r1/leave');
    expect(result).toMatchObject({ id: 'r1', status: 'left' });
  });

  it('leaveChatRoom 後端回傳 room 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: null } } });
    await expect(leaveChatRoom('r1')).rejects.toThrow('Invalid leave room response');
  });

  it('kickChatParticipantB 應 POST /chat/rooms/:id/kick-b 並返回 room', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: { id: 'r1', status: 'active' } } } });
    const result = await kickChatParticipantB('r1');
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms/r1/kick-b');
    expect(result).toMatchObject({ id: 'r1', status: 'active' });
  });

  it('kickChatParticipantB 後端回傳 room 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { room: null } } });
    await expect(kickChatParticipantB('r1')).rejects.toThrow('Invalid kick response');
  });

  it('listChatMessages 應返回 messages 與 nextCursor', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: { messages: [{ id: 'm1', content: 'hello' }], nextCursor: 'cursor-1' } },
    });
    const result = await listChatMessages('r1', { limit: 30 });
    expect(mockGet).toHaveBeenCalledWith('/chat/rooms/r1/messages', { params: { limit: 30 } });
    expect(result.messages).toHaveLength(1);
    expect(result.nextCursor).toBe('cursor-1');
  });

  it('listChatMessages 後端回傳 messages 為非陣列時應返回空陣列（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: { messages: { items: [] }, nextCursor: null } },
    });
    const result = await listChatMessages('r1');
    expect(result.messages).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('listChatMessages 後端回傳 nextCursor 為 undefined 時應正規化為 null（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: { messages: [], nextCursor: undefined } },
    });
    const result = await listChatMessages('r1');
    expect(result.messages).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('listChatMessages 後端回傳 data 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: null } });
    await expect(listChatMessages('r1')).rejects.toThrow('Invalid chat messages response from server');
  });

  it('sendChatMessage 應 POST /chat/rooms/:id/messages', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { message: { id: 'm2', content: 'ok' } } } });
    const result = await sendChatMessage('r1', { content: 'ok' });
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms/r1/messages', { content: 'ok' });
    expect(result).toMatchObject({ id: 'm2' });
  });

  it('sendChatMessage 後端回傳 message 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { message: null } } });
    await expect(sendChatMessage('r1', { content: 'hi' })).rejects.toThrow(
      'Invalid send message response from server'
    );
  });

  it('sendChatMessage 後端回傳 message 為 undefined 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { message: undefined } } });
    await expect(sendChatMessage('r1', { content: 'hi' })).rejects.toThrow(
      'Invalid send message response from server'
    );
  });

  it('requestChatJudgment 應 POST /chat/rooms/:id/request-judgment', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { roomId: 'r1', caseId: 'c1', status: 'judgment_requested' } } });
    const result = await requestChatJudgment('r1', { included_message_ids: ['m1', 'm2'] });
    expect(mockPost).toHaveBeenCalledWith('/chat/rooms/r1/request-judgment', { included_message_ids: ['m1', 'm2'] });
    expect(result).toMatchObject({ roomId: 'r1', caseId: 'c1' });
  });

  it('requestChatJudgment 後端回傳 data 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: null } });
    await expect(requestChatJudgment('r1')).rejects.toThrow('Invalid judgment request response from server');
  });

  it('getChatJudgmentStatus 應 GET /chat/rooms/:id/judgment-status', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: { roomStatus: 'judgment_requested' } } });
    const result = await getChatJudgmentStatus('r1');
    expect(mockGet).toHaveBeenCalledWith('/chat/rooms/r1/judgment-status');
    expect(result).toMatchObject({ roomStatus: 'judgment_requested' });
  });

  it('getChatJudgmentStatus 後端回傳 data 為 null 時應拋錯（F07 邊界：API 回傳不完整時防禦）', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: null } });
    await expect(getChatJudgmentStatus('r1')).rejects.toThrow('Invalid judgment status response from server');
  });

  it('connectChatStream 當 localStorage 拋錯時應以 token=null 繼續請求', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      if (key === 'token' || key.includes('token')) throw new Error('storage unavailable');
      return null;
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    }));
    const onClose = vi.fn();
    await connectChatStream('r1', { onClose });
    await new Promise((r) => setTimeout(r, 50));
    expect(onClose).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      })
    );
    getItemSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('connectChatStream 當 localStorage 拋錯時應繼續以無 token 發送請求', async () => {
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'token') throw new Error('storage quota');
      return originalGetItem.call(this, key);
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('event: ready\ndata: {"roomId":"r1"}\n\n') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    });
    vi.stubGlobal('fetch', fetchMock);
    const onClose = vi.fn();
    await connectChatStream('r1', { onClose });
    await Promise.resolve();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.not.objectContaining({ Authorization: expect.anything() }) })
    );
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('connectChatStream 在串流正常結束時應觸發 onClose', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('event: ready\ndata: {"roomId":"r1"}\n\n') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const onClose = vi.fn();
    await connectChatStream('r1', {
      onClose,
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('connectChatStream 當 localStorage.getItem 拋錯時應繼續以無 token 發起請求', async () => {
    const origGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === 'token' || this === localStorage) throw new Error('storage unavailable');
      return origGetItem.call(this, key);
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('event: ready\ndata: {"roomId":"r1"}\n\n') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    }));
    const onClose = vi.fn();
    await connectChatStream('r1', { onClose });
    await new Promise((r) => setTimeout(r, 50));
    expect(onClose).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.not.objectContaining({
      headers: expect.objectContaining({ Authorization: expect.any(String) }),
    }));
    vi.unstubAllGlobals();
  });

  it('connectChatStream 當 response.ok 為 false 且 json() 拋錯時應使用 fallback 並呼叫 onError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('Invalid JSON')),
    }));
    const onError = vi.fn();
    await connectChatStream('r1', { onError });
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'HTTP_500', message: 'HTTP 500', status: 500 })
    );
    vi.unstubAllGlobals();
  });

  it('connectChatStream 當 response.ok 為 false 時應呼叫 onError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { code: 'FORBIDDEN', message: '無權限' } }),
    }));
    const onError = vi.fn();
    await connectChatStream('r1', { onError });
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN', message: '無權限', status: 403 })
    );
    vi.unstubAllGlobals();
  });

  it('connectChatStream 當 SSE data 非 JSON 時應忽略該行不拋錯', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('event: ping\ndata: not-valid-json\n\n'),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    }));
    const onEvent = vi.fn();
    const onClose = vi.fn();
    await connectChatStream('r1', { onEvent, onClose });
    await new Promise((r) => setTimeout(r, 50));
    expect(onEvent).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('connectChatStream 當 SSE 混雜非 JSON 與有效 JSON 時應只觸發有效事件的 onEvent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('event: ping\ndata: ping\n\nevent: ready\ndata: {"roomId":"r1"}\n\n'),
            })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    }));
    const onEvent = vi.fn();
    const onClose = vi.fn();
    await connectChatStream('r1', { onEvent, onClose });
    await new Promise((r) => setTimeout(r, 50));
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'r1' }));
    expect(onClose).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('connectChatStream 當 response.body 為 null 時應呼叫 onError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: null }));
    const onError = vi.fn();
    await connectChatStream('r1', { onError });
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'STREAM_BODY_MISSING', message: 'No stream body found' })
    );
    vi.unstubAllGlobals();
  });

  it('connectChatStream 當 reader.read 拋錯時應呼叫 onError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockRejectedValue(new Error('network error')),
        }),
      },
    }));
    const onError = vi.fn();
    await connectChatStream('r1', { onError });
    await new Promise((r) => setTimeout(r, 50));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'STREAM_DISCONNECTED', message: 'SSE disconnected unexpectedly' })
    );
    vi.unstubAllGlobals();
  });

  it('connectChatStream 當 localStorage 拋錯時應以 token=null 繼續並正常串流', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('event: ready\ndata: {"roomId":"r1"}\n\n') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        }),
      },
    }));
    const onClose = vi.fn();
    await connectChatStream('r1', { onClose });
    await new Promise((r) => setTimeout(r, 50));
    expect(onClose).toHaveBeenCalled();
    getItemSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
