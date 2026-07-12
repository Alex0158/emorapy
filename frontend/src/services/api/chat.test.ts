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
import { setLocale } from '@/utils/i18n';

const mocks = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  createInvite: vi.fn(),
  createRoom: vi.fn(),
  declineInvite: vi.fn(),
  getJudgmentStatus: vi.fn(),
  getRoom: vi.fn(),
  kickParticipantB: vi.fn(),
  leaveRoom: vi.fn(),
  listMessages: vi.fn(),
  requestJudgment: vi.fn(),
  sendMessage: vi.fn(),
  createM3ApiClient: vi.fn(() => ({
    chat: {
      acceptInvite: mocks.acceptInvite,
      createInvite: mocks.createInvite,
      createRoom: mocks.createRoom,
      declineInvite: mocks.declineInvite,
      getJudgmentStatus: mocks.getJudgmentStatus,
      getRoom: mocks.getRoom,
      kickParticipantB: mocks.kickParticipantB,
      leaveRoom: mocks.leaveRoom,
      listMessages: mocks.listMessages,
      requestJudgment: mocks.requestJudgment,
      sendMessage: mocks.sendMessage,
    },
  })),
}));

vi.mock('@emorapy/api-client', () => ({
  createM3ApiClient: (...args: unknown[]) => mocks.createM3ApiClient(...args),
}));

vi.mock('../request', () => ({
  default: { requestName: 'web-request-adapter' },
}));

async function setLocaleReady(locale: 'zh-TW' | 'en-US'): Promise<void> {
  setLocale(locale);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('chat API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setLocale('zh-TW');
    mocks.createM3ApiClient.mockReturnValue({
      chat: {
        acceptInvite: mocks.acceptInvite,
        createInvite: mocks.createInvite,
        createRoom: mocks.createRoom,
        declineInvite: mocks.declineInvite,
        getJudgmentStatus: mocks.getJudgmentStatus,
        getRoom: mocks.getRoom,
        kickParticipantB: mocks.kickParticipantB,
        leaveRoom: mocks.leaveRoom,
        listMessages: mocks.listMessages,
        requestJudgment: mocks.requestJudgment,
        sendMessage: mocks.sendMessage,
      },
    });
  });

  it('createChatRoom 應委派 shared M3 chat client 並保留預設 history_visibility_mode', async () => {
    mocks.createRoom.mockResolvedValueOnce({ id: 'r1' });
    const result = await createChatRoom();
    expect(mocks.createRoom).toHaveBeenCalledWith('share_summary_only');
    expect(result).toMatchObject({ id: 'r1' });
  });

  it('createChatRoom 應保留呼叫端指定的 history_visibility_mode', async () => {
    mocks.createRoom.mockResolvedValueOnce({ id: 'r1' });
    await createChatRoom('share_full_history');
    expect(mocks.createRoom).toHaveBeenCalledWith('share_full_history');
  });

  it('createChatRoom 應透傳 shared client 錯誤', async () => {
    mocks.createRoom.mockRejectedValueOnce(new Error('Invalid chat room response from server'));
    await expect(createChatRoom()).rejects.toThrow('Invalid chat room response from server');
  });

  it('getChatRoom 應委派 shared M3 getRoom', async () => {
    mocks.getRoom.mockResolvedValueOnce({ id: 'r2' });
    const result = await getChatRoom('r2');
    expect(mocks.getRoom).toHaveBeenCalledWith('r2');
    expect(result).toMatchObject({ id: 'r2' });
  });

  it('createChatInvite 應委派 shared M3 createInvite', async () => {
    mocks.createInvite.mockResolvedValueOnce({ id: 'i1', invite_code: 'ABC123' });
    const result = await createChatInvite('r1', { expires_in_hours: 12 });
    expect(mocks.createInvite).toHaveBeenCalledWith('r1', { expires_in_hours: 12 });
    expect(result).toMatchObject({ id: 'i1', invite_code: 'ABC123' });
  });

  it('createChatInvite 未傳 payload 時應委派空物件', async () => {
    mocks.createInvite.mockResolvedValueOnce({ id: 'i1' });
    await createChatInvite('r1');
    expect(mocks.createInvite).toHaveBeenCalledWith('r1', {});
  });

  it('acceptChatInvite 應委派 shared M3 acceptInvite', async () => {
    mocks.acceptInvite.mockResolvedValueOnce({ id: 'r3' });
    const result = await acceptChatInvite('CODE01');
    expect(mocks.acceptInvite).toHaveBeenCalledWith('CODE01');
    expect(result).toMatchObject({ id: 'r3' });
  });

  it('declineChatInvite 應委派 shared M3 declineInvite', async () => {
    mocks.declineInvite.mockResolvedValueOnce({ id: 'i2', status: 'declined' });
    const result = await declineChatInvite('CODE02');
    expect(mocks.declineInvite).toHaveBeenCalledWith('CODE02');
    expect(result).toMatchObject({ id: 'i2', status: 'declined' });
  });

  it('leaveChatRoom 應委派 shared M3 leaveRoom', async () => {
    mocks.leaveRoom.mockResolvedValueOnce({ id: 'r1', status: 'left' });
    const result = await leaveChatRoom('r1');
    expect(mocks.leaveRoom).toHaveBeenCalledWith('r1');
    expect(result).toMatchObject({ id: 'r1', status: 'left' });
  });

  it('kickChatParticipantB 應委派 shared M3 kickParticipantB', async () => {
    mocks.kickParticipantB.mockResolvedValueOnce({ id: 'r1', status: 'active' });
    const result = await kickChatParticipantB('r1');
    expect(mocks.kickParticipantB).toHaveBeenCalledWith('r1');
    expect(result).toMatchObject({ id: 'r1', status: 'active' });
  });

  it('listChatMessages 應委派 shared M3 listMessages 並返回 shared normalize 結果', async () => {
    mocks.listMessages.mockResolvedValueOnce({
      messages: [{ id: 'm1', content: 'hello' }],
      nextCursor: 'cursor-1',
    });
    const result = await listChatMessages('r1', { limit: 30 });
    expect(mocks.listMessages).toHaveBeenCalledWith('r1', { limit: 30 });
    expect(result.messages).toHaveLength(1);
    expect(result.nextCursor).toBe('cursor-1');
  });

  it('listChatMessages 未傳 params 時應委派空物件', async () => {
    mocks.listMessages.mockResolvedValueOnce({ messages: [], nextCursor: null });
    await listChatMessages('r1');
    expect(mocks.listMessages).toHaveBeenCalledWith('r1', {});
  });

  it('sendChatMessage 應委派 shared M3 sendMessage', async () => {
    mocks.sendMessage.mockResolvedValueOnce({ id: 'm2', content: 'ok' });
    const result = await sendChatMessage('r1', { content: 'ok' });
    expect(mocks.sendMessage).toHaveBeenCalledWith('r1', { content: 'ok' });
    expect(result).toMatchObject({ id: 'm2' });
  });

  it('requestChatJudgment 應委派 shared M3 requestJudgment', async () => {
    mocks.requestJudgment.mockResolvedValueOnce({ roomId: 'r1', caseId: 'c1', status: 'judgment_requested' });
    const result = await requestChatJudgment('r1', { included_message_ids: ['m1', 'm2'] });
    expect(mocks.requestJudgment).toHaveBeenCalledWith('r1', { included_message_ids: ['m1', 'm2'] });
    expect(result).toMatchObject({ roomId: 'r1', caseId: 'c1' });
  });

  it('requestChatJudgment 未傳 payload 時應委派空物件，長超時由 shared M3 contract 保護', async () => {
    mocks.requestJudgment.mockResolvedValueOnce({ roomId: 'r1', caseId: 'c1', status: 'judgment_requested' });
    await requestChatJudgment('r1');
    expect(mocks.requestJudgment).toHaveBeenCalledWith('r1', {});
  });

  it('getChatJudgmentStatus 應委派 shared M3 getJudgmentStatus', async () => {
    mocks.getJudgmentStatus.mockResolvedValueOnce({ roomStatus: 'judgment_requested' });
    const result = await getChatJudgmentStatus('r1');
    expect(mocks.getJudgmentStatus).toHaveBeenCalledWith('r1');
    expect(result).toMatchObject({ roomStatus: 'judgment_requested' });
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
      expect.objectContaining({ code: 'HTTP_500', message: '即時連線請求失敗（狀態碼 500）', status: 500 })
    );
    vi.unstubAllGlobals();
  });

  it('connectChatStream fallback 應跟隨英文 locale', async () => {
    await setLocaleReady('en-US');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error('Invalid JSON')),
    }));
    const onError = vi.fn();
    await connectChatStream('r1', { onError });
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'HTTP_503',
        message: 'Real-time connection request failed (status 503)',
        status: 503,
      })
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
      expect.objectContaining({
        code: 'FORBIDDEN',
        message: '即時連線請求失敗（狀態碼 403）',
        status: 403,
      })
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
      expect.objectContaining({ code: 'STREAM_BODY_MISSING', message: '即時連線回應內容不可讀，請稍後再試' })
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
      expect.objectContaining({ code: 'STREAM_DISCONNECTED', message: '即時連線已中斷，請稍後再試' })
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
